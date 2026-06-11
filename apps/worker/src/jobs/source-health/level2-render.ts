import type { Pool } from 'pg'
import type pino from 'pino'
import { config } from '../../config'
import { shouldSkipSite, recordFailure, recordSuccess } from '../../lib/circuit-breaker'
import {
  parseM3u8,
  parseMp4Moov,
  parseMpd,
  evaluateHls,
  evaluateMp4,
  evaluateMpd,
  type MediaProbeVerdict,
} from '@resovo/media-probe'
import { withRetry } from '../../lib/retry-backoff'
import { emitMetric } from '../../observability/metrics'
import type { VideoSource, QualityDetected, ProbeStatus } from '../../types'

const TIMEOUT_MS = config.probe.level2TimeoutMs

// manifest 文本（m3u8/mpd）读取上限——正常 manifest 为 KB 级，2MB 防 URL 指向大文件
const MANIFEST_MAX_BYTES = 2 * 1024 * 1024

type RenderResult = {
  status: ProbeStatus
  width: number | null
  height: number | null
  quality_detected: QualityDetected | null
  error_detail: string | null
}

/**
 * SRCHEALTH-P1-5（F2）：可选 sourceIds 定向重测——feedback recheck 消费，
 * 不再依赖全局 candidates（按 last_rendered_at 取 100 条）覆盖信号源。
 * 省略 opts → 既有 cron 全局行为不变。
 */
export async function runLevel2Render(
  pool: Pool,
  log: pino.Logger,
  opts?: { readonly sourceIds?: readonly string[] },
): Promise<void> {
  const sources = await loadLevel2Candidates(pool, opts?.sourceIds)
  log.info({ metric: 'render.started', value: sources.length }, 'Level2 render started')

  for (const source of sources) {
    const siteId = extractSiteId(source.source_url)
    if (shouldSkipSite(siteId)) {
      log.warn({ source_id: source.id, site_id: siteId }, 'circuit breaker active, skipping render')
      emitMetric(log, 'probe.skipped_circuit', 1, { site_id: siteId, level: 2 })
      continue
    }

    await renderOneSource(pool, log, source, siteId)
  }
}

async function renderOneSource(
  pool: Pool,
  log: pino.Logger,
  source: VideoSource,
  siteId: string,
): Promise<void> {
  try {
    const result = await withRetry(
      () => renderCheck(source),
      (attempt, err) => log.warn({ source_id: source.id, attempt, err }, 'render retry'),
    )

    if (result.status === 'ok') {
      recordSuccess(siteId)
    } else {
      recordFailure(siteId)
    }

    await updateSourceRender(pool, source.id, result)
    await writeHealthEvent(pool, source, result)
    emitMetric(log, 'render.completed', 1, {
      source_id: source.id,
      status: result.status,
      height: result.height ?? 0,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    recordFailure(siteId)
    await updateSourceRender(pool, source.id, {
      status: 'dead',
      width: null,
      height: null,
      quality_detected: null,
      error_detail: msg,
    })
    emitMetric(log, 'render.failed', 1, { source_id: source.id, error: msg })
    log.error({ source_id: source.id, err: msg }, 'Level2 render error')
  }
}

async function renderCheck(source: VideoSource): Promise<RenderResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    if (source.type === 'hls') return await checkHls(source, controller.signal)
    if (source.type === 'mp4') return await checkMp4(source, controller.signal)
    if (source.type === 'dash') return await checkDash(source, controller.signal)
    return { status: 'dead', width: null, height: null, quality_detected: null, error_detail: 'unknown source type' }
  } finally {
    clearTimeout(timer)
  }
}

// SRCHEALTH-P1-3：解析 + 判定收口 @resovo/media-probe（api 手动试播同源），
// 本文件只保留 IO 编排（fetch / timeout / Range / UA）+ verdict → DB 字段映射。
function verdictToRenderResult(v: MediaProbeVerdict): RenderResult {
  return {
    status: v.status,
    width: v.width,
    height: v.height,
    quality_detected: v.quality,
    error_detail: v.errorDetail,
  }
}

// 响应体限量流式读取——与 apps/api/src/lib/render-check-manifest.ts readBodyLimited 双副本同步
// （IO 编排层，A2 裁决不进 @resovo/media-probe；改动须双向同步，ADR-107 §4 双副本
// 范式）。读满 maxBytes 即 cancel 流：服务器忽略 Range 返回 200 全量（或 URL 指向
// 大文件）时，text()/arrayBuffer() 会把整个视频缓冲进内存（Codex review 拦截项）。
async function readBodyLimited(res: Response, maxBytes: number): Promise<Buffer> {
  const body = res.body
  if (body === null) return Buffer.alloc(0)
  const reader = body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(Buffer.from(value))
      total += value.byteLength
    }
  } finally {
    reader.cancel().catch(() => {})
  }
  return Buffer.concat(chunks).subarray(0, maxBytes)
}

async function checkHls(source: VideoSource, signal: AbortSignal): Promise<RenderResult> {
  const res = await fetch(source.source_url, { signal, headers: { 'User-Agent': 'Resovo-HealthWorker/1.0' } })
  if (!res.ok) return { status: 'dead', width: null, height: null, quality_detected: null, error_detail: `HTTP ${res.status}` }
  const text = (await readBodyLimited(res, MANIFEST_MAX_BYTES)).toString('utf8')
  return verdictToRenderResult(evaluateHls(parseM3u8(text)))
}

async function checkMp4(source: VideoSource, signal: AbortSignal): Promise<RenderResult> {
  const rangeEnd = config.probe.mp4RangeBytes - 1
  const res = await fetch(source.source_url, {
    signal,
    headers: {
      'Range': `bytes=0-${rangeEnd}`,
      'User-Agent': 'Resovo-HealthWorker/1.0',
    },
  })
  if (!res.ok && res.status !== 206) {
    return { status: 'dead', width: null, height: null, quality_detected: null, error_detail: `HTTP ${res.status}` }
  }
  const buf = await readBodyLimited(res, config.probe.mp4RangeBytes)
  return verdictToRenderResult(evaluateMp4(parseMp4Moov(buf)))
}

async function checkDash(source: VideoSource, signal: AbortSignal): Promise<RenderResult> {
  const res = await fetch(source.source_url, { signal, headers: { 'User-Agent': 'Resovo-HealthWorker/1.0' } })
  if (!res.ok) return { status: 'dead', width: null, height: null, quality_detected: null, error_detail: `HTTP ${res.status}` }
  const xml = (await readBodyLimited(res, MANIFEST_MAX_BYTES)).toString('utf8')
  return verdictToRenderResult(evaluateMpd(parseMpd(xml)))
}

// TODO(SRCHEALTH-P3-3-B): 与 level1-probe.ts extractSiteId 同款本地副本——
// 切换到 @resovo/media-probe extractHostname 时一并消除（P3-3-A 裁决 B/C 登记）。
function extractSiteId(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url.slice(0, 64)
  }
}

async function updateSourceRender(pool: Pool, sourceId: string, result: RenderResult): Promise<void> {
  await pool.query(
    `UPDATE video_sources
     SET render_status = $1,
         resolution_width = $2,
         resolution_height = $3,
         quality_detected = $4,
         quality_source = CASE WHEN $2 IS NOT NULL THEN 'manifest_parse' ELSE quality_source END,
         detected_at = CASE WHEN $2 IS NOT NULL THEN NOW() ELSE detected_at END,
         last_rendered_at = NOW()
     WHERE id = $5`,
    [result.status, result.width, result.height, result.quality_detected, sourceId],
  )
}

async function writeHealthEvent(pool: Pool, source: VideoSource, result: RenderResult): Promise<void> {
  await pool.query(
    `INSERT INTO source_health_events
       (video_id, source_id, origin, new_status, error_detail, http_code, latency_ms)
     VALUES ($1, $2, $3, $4, $5, NULL, NULL)`,
    [source.video_id, source.id, 'level2_render', result.status, result.error_detail],
  )
}

async function loadLevel2Candidates(pool: Pool, sourceIds?: readonly string[]): Promise<VideoSource[]> {
  // SRCHEALTH-P1-5：定向模式——仅测指定源（feedback recheck 已先跑 level1，
  // probe_status='ok' 守卫保留：probe dead 的源连不通，render 重测无意义）
  if (sourceIds !== undefined) {
    if (sourceIds.length === 0) return []
    const result = await pool.query<VideoSource>(
      `SELECT id, video_id, source_url, type, is_active,
              probe_status, render_status, quality_detected,
              last_probed_at, last_rendered_at
       FROM video_sources
       WHERE id = ANY($1::uuid[])
         AND is_active = true
         AND deleted_at IS NULL
         AND probe_status = 'ok'`,
      [sourceIds],
    )
    return result.rows
  }

  const result = await pool.query<VideoSource>(
    `SELECT id, video_id, source_url, type, is_active,
            probe_status, render_status, quality_detected,
            last_probed_at, last_rendered_at
     FROM video_sources
     WHERE is_active = true
       AND deleted_at IS NULL
       AND probe_status = 'ok'
       AND (
         render_status = 'pending'
         OR render_status = 'dead'
         OR quality_detected IS NULL
       )
     ORDER BY last_rendered_at ASC NULLS FIRST
     LIMIT 100`,
  )
  return result.rows
}
