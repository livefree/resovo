/**
 * verifyWorker.ts — 播放源链接验证队列消费者
 * CRAWLER-01: 处理 verify-queue 任务
 * HEAD 请求检测 URL 可达性；更新 is_active + last_checked
 */

import type Bull from 'bull'
import { verifyQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import { updateSourceActiveStatus } from '@/api/db/queries/sources'
import { syncSourceCheckStatusFromSources } from '@/api/db/queries/videos'
import { baseLogger, withJob } from '@/api/lib/logger'

const workerLog = baseLogger.child({ worker: 'verify-worker' })

// ── 任务类型 ──────────────────────────────────────────────────────

export type VerifyJobType = 'verify-source' | 'verify-single'

export interface VerifyJobData {
  type: VerifyJobType
  /** video_sources.id */
  sourceId: string
  /** 需要验证的 URL */
  url: string
  /** 是否为用户举报触发（高优先级） */
  isUserReport?: boolean
}

export interface VerifyJobResult {
  sourceId: string
  url: string
  isActive: boolean
  statusCode: number | null
  durationMs: number
}

// ── 验证逻辑 ──────────────────────────────────────────────────────

const TIMEOUT_MS = 10_000  // 10 秒超时

/**
 * 发送 HEAD 请求检测 URL 可达性。
 * 200 → active=true；4xx/5xx/超时 → active=false。
 * CHG-406: 对 .m3u8 URL，HEAD 失败后追加 GET fallback
 * （部分防爬站点屏蔽 HEAD 但实际可播）。
 */
export async function checkUrl(url: string): Promise<{ isActive: boolean; statusCode: number | null }> {
  const headResult = await fetchWithTimeout(url, 'HEAD')
  if (headResult.isActive) return headResult

  // m3u8 GET fallback：HEAD 失败时尝试 GET 验证内容类型
  if (/\.m3u8(\?.*)?$/i.test(url)) {
    const getResult = await fetchWithTimeout(url, 'GET')
    if (getResult.isActive) return getResult
  }

  return headResult
}

async function fetchWithTimeout(
  url: string,
  method: 'HEAD' | 'GET',
): Promise<{ isActive: boolean; statusCode: number | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: { 'User-Agent': 'Resovo-Verifier/1.0' },
    })
    if (method === 'GET' && res.ok) {
      const ct = res.headers.get('content-type') ?? ''
      const isM3u8 = ct.includes('mpegurl') || ct.includes('x-mpegurl') || ct.includes('vnd.apple')
      return { isActive: isM3u8, statusCode: res.status }
    }
    return { isActive: res.ok, statusCode: res.status }
  } catch {
    return { isActive: false, statusCode: null }
  } finally {
    clearTimeout(timer)
  }
}

// ── Worker 处理函数 ───────────────────────────────────────────────

async function processVerifyJob(job: Bull.Job<VerifyJobData>): Promise<VerifyJobResult> {
  const { sourceId, url } = job.data
  const start = Date.now()

  const { isActive, statusCode } = await checkUrl(url)

  await updateSourceActiveStatus(db, sourceId, isActive)

  // CHG-404: 验证完成后即时聚合 source_check_status，无需等待 maintenance job
  try {
    const row = await db.query<{ video_id: string }>(
      'SELECT video_id FROM video_sources WHERE id = $1',
      [sourceId],
    )
    if (row.rows[0]) {
      await syncSourceCheckStatusFromSources(db, row.rows[0].video_id)
    }
  } catch (err) {
    const jobLog = withJob(workerLog, job)
    jobLog.warn({ err, source_id: sourceId }, 'syncSourceCheckStatus failed')
  }

  withJob(workerLog, job).info(
    { source_id: sourceId, is_active: isActive, status_code: statusCode ?? null },
    'source verified'
  )

  return {
    sourceId,
    url,
    isActive,
    statusCode,
    durationMs: Date.now() - start,
  }
}

// ── Worker 注册 ───────────────────────────────────────────────────

/**
 * 注册验证 Worker 到 verifyQueue。
 * 在 Fastify 服务启动后调用一次。
 * @param concurrency 并发数（默认 5，控制对外请求频率）
 */
export function registerVerifyWorker(concurrency = 5): void {
  verifyQueue.process(concurrency, processVerifyJob)

  verifyQueue.on('completed', (job: Bull.Job<VerifyJobData>, result: VerifyJobResult) => {
    withJob(workerLog, job).info(
      { source_id: result.sourceId, is_active: result.isActive, duration_ms: result.durationMs },
      'job completed'
    )
  })
}

// ── 便捷入队函数 ──────────────────────────────────────────────────

/** 添加批量验证任务（定时触发） */
export async function enqueueVerifySource(
  sourceId: string,
  url: string
): Promise<Bull.Job<VerifyJobData>> {
  return verifyQueue.add({ type: 'verify-source', sourceId, url })
}

/** 添加用户举报触发的高优先级单条验证 */
export async function enqueueVerifySingle(
  sourceId: string,
  url: string
): Promise<Bull.Job<VerifyJobData>> {
  return verifyQueue.add(
    { type: 'verify-single', sourceId, url, isUserReport: true },
    { priority: 1 }  // 最高优先级（数字越小越高）
  )
}
