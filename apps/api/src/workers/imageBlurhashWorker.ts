/**
 * imageBlurhashWorker.ts — BlurHash + 主色提取 Worker
 *
 * 规则：
 *   - 下载原图 → 缩略 100×100 → 计算 BlurHash
 *   - k-means 2 色聚类 → 取亮度居中色 → 转 OKLCH
 *   - OKLCH L < 15 或 L > 90 → primary_color = null（过暗/过亮）
 *   - 失败不阻断（写 null，不抛异常传播到队列）
 */

import type Bull from 'bull'
import { imageHealthQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import { updateCatalogImageBlurhash } from '@/api/db/queries/imageHealth'
import type { ImageKind } from '@/types'
import type { ImageHealthJobData } from '@/api/workers/imageHealthWorker'
import { baseLogger, withJob } from '@/api/lib/logger'

const workerLog = baseLogger.child({ worker: 'blurhash-worker' })

// ── BlurHash 计算 ─────────────────────────────────────────────────

async function computeBlurhash(buf: Buffer): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default
    const { encode } = await import('blurhash')

    const { data, info } = await sharp(buf)
      .resize(100, 100, { fit: 'cover' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const hash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3)
    return hash
  } catch {
    return null
  }
}

// ── 主色提取（k-means，OKLCH 空间）──────────────────────────────

interface RgbPixel { r: number; g: number; b: number }

function samplePixels(data: Buffer, width: number, height: number, step = 8): RgbPixel[] {
  const pixels: RgbPixel[] = []
  for (let i = 0; i < width * height; i += step) {
    const offset = i * 3
    pixels.push({ r: data[offset], g: data[offset + 1], b: data[offset + 2] })
  }
  return pixels
}

function kmeans2(pixels: RgbPixel[], iterations = 10): [RgbPixel, RgbPixel] {
  // 用第 1/3 和 2/3 分位像素作初始中心
  const sorted = [...pixels].sort((a, b) => a.r + a.g + a.b - b.r - b.g - b.b)
  let c1 = sorted[Math.floor(sorted.length / 3)]
  let c2 = sorted[Math.floor((sorted.length * 2) / 3)]

  for (let iter = 0; iter < iterations; iter++) {
    const g1: RgbPixel[] = []
    const g2: RgbPixel[] = []

    for (const p of pixels) {
      const d1 = (p.r - c1.r) ** 2 + (p.g - c1.g) ** 2 + (p.b - c1.b) ** 2
      const d2 = (p.r - c2.r) ** 2 + (p.g - c2.g) ** 2 + (p.b - c2.b) ** 2
      ;(d1 <= d2 ? g1 : g2).push(p)
    }

    const mean = (arr: RgbPixel[], fallback: RgbPixel): RgbPixel =>
      arr.length === 0
        ? fallback
        : {
            r: Math.round(arr.reduce((s, p) => s + p.r, 0) / arr.length),
            g: Math.round(arr.reduce((s, p) => s + p.g, 0) / arr.length),
            b: Math.round(arr.reduce((s, p) => s + p.b, 0) / arr.length),
          }

    c1 = mean(g1, c1)
    c2 = mean(g2, c2)
  }
  return [c1, c2]
}

/** sRGB → linear（gamma correction） */
function toLinear(v: number): number {
  const n = v / 255
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
}

/** RGB → OKLCH L（0–100）近似，供测试用 */
export function oklchLuminance(r: number, g: number, b: number): number {
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
  return Math.cbrt(y) * 100
}

function oklchL(r: number, g: number, b: number): number {
  return oklchLuminance(r, g, b)
}

function rgbToHex(p: RgbPixel): string {
  return '#' + [p.r, p.g, p.b].map(v => v.toString(16).padStart(2, '0')).join('')
}

async function extractPrimaryColor(buf: Buffer): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default

    const { data, info } = await sharp(buf)
      .resize(50, 50, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const pixels = samplePixels(data, info.width, info.height)
    if (pixels.length === 0) return null

    const [c1, c2] = kmeans2(pixels)

    // 取亮度居中（更接近 50 的那个）
    const l1 = oklchL(c1.r, c1.g, c1.b)
    const l2 = oklchL(c2.r, c2.g, c2.b)

    const pick = Math.abs(l1 - 50) <= Math.abs(l2 - 50) ? c1 : c2
    const L = oklchL(pick.r, pick.g, pick.b)

    // 过暗（L<15）或过亮（L>90）→ null
    if (L < 15 || L > 90) return null

    return rgbToHex(pick)
  } catch {
    return null
  }
}

// ── 单图处理逻辑 ──────────────────────────────────────────────────

export async function extractBlurhashAndColor(data: ImageHealthJobData): Promise<void> {
  const { catalogId, kind, url } = data

  // 仅处理支持 blurhash 的种类
  if (!['poster', 'backdrop', 'banner_backdrop'].includes(kind)) return

  let buf: Buffer | null = null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) return
      buf = Buffer.from(await res.arrayBuffer())
    } finally {
      clearTimeout(timer)
    }
  } catch {
    // 下载失败不阻断
    return
  }

  const [blurhash, primaryColor] = await Promise.all([
    computeBlurhash(buf),
    extractPrimaryColor(buf),
  ])

  await updateCatalogImageBlurhash(db, {
    catalogId,
    kind: kind as 'poster' | 'backdrop' | 'banner_backdrop',
    blurhash,
    primaryColor,
  })
}

// ── Worker 注册 ───────────────────────────────────────────────────

export function registerBlurhashWorker(concurrency = 3): void {
  imageHealthQueue.process('blurhash-extract', concurrency, async (job: Bull.Job<ImageHealthJobData>) => {
    await extractBlurhashAndColor(job.data)
    withJob(workerLog, job).info({ kind: job.data.kind }, 'job done')
  })

  imageHealthQueue.on('failed', (job: Bull.Job<ImageHealthJobData>, err: Error) => {
    withJob(workerLog, job).warn({ attempt: job.attemptsMade, err }, 'job failed')
  })

  workerLog.info({ concurrency }, 'registered')
}
