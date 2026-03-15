/**
 * verifyWorker.ts — 播放源链接验证队列消费者
 * CRAWLER-01: 处理 verify-queue 任务
 * HEAD 请求检测 URL 可达性；更新 is_active + last_checked
 */

import type Bull from 'bull'
import { verifyQueue } from '@/api/lib/queue'

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
 * 200 → active=true；4xx/5xx/超时 → active=false
 */
export async function checkUrl(url: string): Promise<{ isActive: boolean; statusCode: number | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Resovo-Verifier/1.0' },
    })
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

  // 更新数据库（CRAWLER-03 实装，此处为占位）
  // await videoSourcesQueries.updateActiveStatus(db, sourceId, { isActive, lastChecked: new Date() })

  process.stderr.write(
    `[verify-worker] source ${sourceId}: ${url} → ${isActive ? 'active' : 'inactive'} (${statusCode ?? 'timeout'})\n`
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
    process.stderr.write(
      `[verify-worker] job ${job.id} completed: source ${result.sourceId} → ` +
        `${result.isActive ? 'active' : 'inactive'} (${result.durationMs}ms)\n`
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
