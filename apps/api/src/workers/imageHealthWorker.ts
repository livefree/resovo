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

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
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

// ── 连续失败计数（内存，进程重启重置，可接受）────────────────────

const consecutiveFailures = new Map<string, number>()
const MAX_CONSECUTIVE_FAIL = 3

function recordFailure(key: string): number {
  const n = (consecutiveFailures.get(key) ?? 0) + 1
  consecutiveFailures.set(key, n)
  return n
}

function clearFailure(key: string): void {
  consecutiveFailures.delete(key)
}

// ── 单图健康检查逻辑 ──────────────────────────────────────────────

export async function checkImageHealth(data: ImageHealthJobData): Promise<void> {
  const { catalogId, videoId, kind, url } = data
  const failKey = `${catalogId}:${kind}`

  // URL 语法校验
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    await upsertBrokenImageEvent(db, { videoId, imageKind: kind, url, eventType: 'fetch_404' })
    await updateCatalogImageStatus(db, [{ catalogId, kind: kind as 'poster' | 'backdrop' | 'logo' | 'banner_backdrop', status: 'broken' }])
    return
  }

  const domain = parsedUrl.hostname
  await waitForDomainSlot(domain)

  const { ok, status } = await headRequest(url)

  if (!ok) {
    const eventType = status === 404 ? 'fetch_404' : status >= 500 ? 'fetch_5xx' : 'timeout'
    await upsertBrokenImageEvent(db, { videoId, imageKind: kind, url, eventType })

    const failures = recordFailure(failKey)
    if (failures >= MAX_CONSECUTIVE_FAIL) {
      await updateCatalogImageStatus(db, [{ catalogId, kind: kind as 'poster' | 'backdrop' | 'logo' | 'banner_backdrop', status: 'broken' }])
    }
    return
  }

  clearFailure(failKey)

  // 有尺寸约束的种类才做 GET + 尺寸检查
  const spec = DIMENSION_SPECS[kind]
  if (spec) {
    const { width, height } = await fetchImageDimensions(url)
    if (width === 0 || !checkAspectRatio(width, height, spec)) {
      const eventType = width < spec.minWidth ? 'dimension_too_small' : 'aspect_mismatch'
      await upsertBrokenImageEvent(db, { videoId, imageKind: kind, url, eventType })
      await updateCatalogImageStatus(db, [{ catalogId, kind: kind as 'poster' | 'backdrop' | 'logo' | 'banner_backdrop', status: 'low_quality' }])
      return
    }
  }

  await updateCatalogImageStatus(db, [{ catalogId, kind: kind as 'poster' | 'backdrop' | 'logo' | 'banner_backdrop', status: 'ok' }])
}

// ── 获取图片尺寸（GET + sharp）───────────────────────────────────

async function fetchImageDimensions(url: string): Promise<{ width: number; height: number }> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    let buf: Buffer
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) return { width: 0, height: 0 }
      buf = Buffer.from(await res.arrayBuffer())
    } finally {
      clearTimeout(timer)
    }
    const sharp = (await import('sharp')).default
    const meta = await sharp(buf).metadata()
    return { width: meta.width ?? 0, height: meta.height ?? 0 }
  } catch {
    return { width: 0, height: 0 }
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
