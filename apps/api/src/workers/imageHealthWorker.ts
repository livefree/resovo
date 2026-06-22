/**
 * imageHealthWorker.ts — 图片 URL 健康巡检 Worker
 *
 * 规则：
 *   - URL 语法合法 → HEAD 请求（300ms 超时）→ 尺寸检查
 *   - P0：宽 ≥ 300 + 2:3 比例 ±10%（poster）
 *   - P1：宽 ≥ 640 + 16:9 比例 ±10%（backdrop）
 *   - 并发度 5；同 domain 间隔 ≥ 200ms；连续 3 次失败 → broken
 *   - 写回 media_catalog.<kind>_status + broken_image_events
 */

import type Bull from 'bull'
import { imageHealthQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import {
  upsertBrokenImageEvent,
  updateCatalogImageStatus,
} from '@/api/db/queries/imageHealth'
import type { ImageKind } from '@/types'
import { baseLogger, withJob } from '@/api/lib/logger'

const workerLog = baseLogger.child({ worker: 'image-health-worker' })

// ── 类型 ──────────────────────────────────────────────────────────

export type ImageHealthQueue = typeof imageHealthQueue

export interface ImageHealthJobData {
  type: 'health-check' | 'blurhash-extract'
  catalogId: string
  videoId: string
  kind: ImageKind
  url: string
}

// ── Domain 限速（同 domain 间隔 ≥ 200ms，per-domain promise 串行锁）───────

const domainQueue = new Map<string, Promise<void>>()
const DOMAIN_INTERVAL_MS = 200

/**
 * 通过 per-domain promise 链把同一 domain 的请求串行化，保证间隔 ≥ 200ms。
 * 每个调用挂在前一个 promise 后面，前一个完成 200ms 后才解锁当前调用。
 */
function waitForDomainSlot(domain: string): Promise<void> {
  const prev = domainQueue.get(domain) ?? Promise.resolve()
  const next = prev.then(
    () => new Promise<void>(resolve => setTimeout(resolve, DOMAIN_INTERVAL_MS))
  )
  // 保存当前任务完成后的 promise（去掉延迟尾巴），供下一个调用挂载
  domainQueue.set(domain, next.then(() => undefined))
  return next
}

// ── 尺寸验证 ──────────────────────────────────────────────────────

interface DimensionSpec {
  minWidth: number
  targetRatioW: number
  targetRatioH: number
  tolerancePct: number   // ±n%
}

const DIMENSION_SPECS: Partial<Record<ImageKind, DimensionSpec>> = {
  poster: { minWidth: 300, targetRatioW: 2, targetRatioH: 3, tolerancePct: 10 },
  backdrop: { minWidth: 640, targetRatioW: 16, targetRatioH: 9, tolerancePct: 10 },
}

function checkAspectRatio(
  width: number,
  height: number,
  spec: DimensionSpec
): boolean {
  if (width < spec.minWidth) return false
  const actual = width / height
  const target = spec.targetRatioW / spec.targetRatioH
  const tolerance = target * (spec.tolerancePct / 100)
  return Math.abs(actual - target) <= tolerance
}

// ── HEAD 请求（300ms 超时）────────────────────────────────────────

async function headRequest(url: string): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 300)
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal })
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  } finally {
    clearTimeout(timer)
  }
}

// ── 尺寸/解码判别结果（ADR-213 D-213-9：区分确定性失败 vs 瞬态）──────────
// 取代旧「内存连败计数器」（进程重启重置 → broken 非确定性，ADR-213 D-213-5 弃用）：
//   确定性失败（HTTP 404/5xx / sharp 解码失败）单次即判 broken；
//   瞬态失败（fetch 网络/超时/abort/DNS/TLS）不改 status、不写 checked_at（消 timeout 误报）。
interface DimensionResult {
  width: number
  height: number
  failure?: 'http_4xx' | 'http_5xx' | 'decode' | 'transient'
}

// ── 单图健康检查逻辑 ──────────────────────────────────────────────

export async function checkImageHealth(data: ImageHealthJobData): Promise<void> {
  const { catalogId, videoId, kind, url } = data
  const sizedKind = kind as 'poster' | 'backdrop' | 'logo' | 'banner_backdrop'
  // 确定性出口写 status；updateCatalogImageStatus 内据 status∈{ok,low_quality,broken} 同步写 checked_at（D-213-5）
  const writeStatus = (status: 'ok' | 'low_quality' | 'broken') =>
    updateCatalogImageStatus(db, [{ catalogId, kind: sizedKind, status }])

  // URL 语法非法 = 确定性破损
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    await upsertBrokenImageEvent(db, { videoId, imageKind: kind, url, eventType: 'fetch_404' })
    await writeStatus('broken')
    return
  }

  await waitForDomainSlot(parsedUrl.hostname)
  const { ok, status } = await headRequest(url)

  if (!ok) {
    // HEAD 404/5xx = 确定性破损（单次即判，无内存连败计数器）；
    // status===0（网络/超时/abort）= 瞬态 → 记遥测、保留上次 status + checked_at（D-213-5，消 timeout 误报）
    if (status === 404 || status >= 500) {
      await upsertBrokenImageEvent(db, { videoId, imageKind: kind, url, eventType: status === 404 ? 'fetch_404' : 'fetch_5xx' })
      await writeStatus('broken')
      return
    }
    await upsertBrokenImageEvent(db, { videoId, imageKind: kind, url, eventType: 'timeout' })
    return
  }

  // HEAD ok：有尺寸约束 kind（poster/backdrop）再 GET+sharp 取尺寸；logo/banner 无约束 → 直接 ok
  const spec = DIMENSION_SPECS[kind]
  if (spec) {
    const dim = await fetchImageDimensions(url)
    if (dim.failure) {
      if (dim.failure === 'transient') {
        // GET 瞬态失败：遥测 + 不改 status/checked_at（worker 侧瞬态，浏览器可能仍可渲染）
        await upsertBrokenImageEvent(db, { videoId, imageKind: kind, url, eventType: 'timeout' })
        return
      }
      // http_4xx/http_5xx/decode = body 取不到/解不开 = 确定性真破损（D-213-9 消「width===0 假阴性」）
      const eventType = dim.failure === 'http_5xx' ? 'fetch_5xx' : dim.failure === 'http_4xx' ? 'fetch_404' : 'decode_fail'
      await upsertBrokenImageEvent(db, { videoId, imageKind: kind, url, eventType })
      await writeStatus('broken')
      return
    }
    // body 取回解码成功（width>0）：仅尺寸/比例不达标 → low_quality（图能用、质量不合）
    if (!checkAspectRatio(dim.width, dim.height, spec)) {
      const eventType = dim.width < spec.minWidth ? 'dimension_too_small' : 'aspect_mismatch'
      await upsertBrokenImageEvent(db, { videoId, imageKind: kind, url, eventType })
      await writeStatus('low_quality')
      return
    }
  }

  await writeStatus('ok')
}

// ── 获取图片尺寸（GET + sharp）───────────────────────────────────

async function fetchImageDimensions(url: string): Promise<DimensionResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  let buf: Buffer
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      // GET HTTP 错误 = 确定性（D-213-9）：5xx→http_5xx，其余 4xx→http_4xx
      return { width: 0, height: 0, failure: res.status >= 500 ? 'http_5xx' : 'http_4xx' }
    }
    buf = Buffer.from(await res.arrayBuffer())
  } catch {
    // fetch 网络/超时/abort/DNS/TLS = 瞬态（worker 侧失败，非「body 确定取不到」）
    return { width: 0, height: 0, failure: 'transient' }
  } finally {
    clearTimeout(timer)
  }
  // body 取回成功 → 解码取尺寸；sharp 抛或尺寸缺失 = 确定性解码失败
  try {
    const sharp = (await import('sharp')).default
    const meta = await sharp(buf).metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    if (width === 0 || height === 0) return { width: 0, height: 0, failure: 'decode' }
    return { width, height }
  } catch {
    return { width: 0, height: 0, failure: 'decode' }
  }
}

// ── Worker 注册 ───────────────────────────────────────────────────

export function registerImageHealthWorker(concurrency = 5): void {
  imageHealthQueue.process('health-check', concurrency, async (job: Bull.Job<ImageHealthJobData>) => {
    await checkImageHealth(job.data)
    withJob(workerLog, job).info({ kind: job.data.kind }, 'job done')
  })

  imageHealthQueue.on('failed', (job: Bull.Job<ImageHealthJobData>, err: Error) => {
    withJob(workerLog, job).warn({ attempt: job.attemptsMade, err }, 'job failed')
  })

  workerLog.info({ concurrency }, 'registered')
}
