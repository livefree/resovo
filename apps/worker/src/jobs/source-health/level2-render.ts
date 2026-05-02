import type { Pool } from 'pg'
import type pino from 'pino'
import { config } from '../../config'
import { shouldSkipSite, recordFailure, recordSuccess } from '../../lib/circuit-breaker'
import { parseM3u8, parseMp4Moov, parseMpd } from '../../lib/parsers'
import { withRetry } from '../../lib/retry-backoff'
import { emitMetric } from '../../observability/metrics'
import type { VideoSource, QualityDetected, ProbeStatus } from '../../types'

const TIMEOUT_MS = config.probe.level2TimeoutMs

type RenderResult = {
  status: ProbeStatus
  width: number | null
  height: number | null
  quality_detected: QualityDetected | null
  error_detail: string | null
}

export async function runLevel2Render(pool: Pool, log: pino.Logger): Promise<void> {
  const sources = await loadLevel2Candidates(pool)
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

async function checkHls(source: VideoSource, signal: AbortSignal): Promise<RenderResult> {
  const res = await fetch(source.source_url, { signal, headers: { 'User-Agent': 'Resovo-HealthWorker/1.0' } })
  if (!res.ok) return { status: 'dead', width: null, height: null, quality_detected: null, error_detail: `HTTP ${res.status}` }
  const text = await res.text()
  const { variants, isMaster, maxResolutionHeight } = parseM3u8(text)

  if (isMaster && variants.length === 0) {
    return { status: 'partial', width: null, height: null, quality_detected: null, error_detail: 'no variants in master' }
  }

  const height = maxResolutionHeight
  const quality = height !== null ? heightToQuality(height) : null
  const width = variants[0]?.resolution ? parseWidth(variants[0].resolution) : null
  return { status: 'ok', width, height, quality_detected: quality, error_detail: null }
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
  const arrayBuf = await res.arrayBuffer()
  const buf = Buffer.from(arrayBuf)
  const { width, height } = parseMp4Moov(buf)
  const quality = height !== null ? heightToQuality(height) : null
  return { status: 'ok', width, height, quality_detected: quality, error_detail: null }
}

async function checkDash(source: VideoSource, signal: AbortSignal): Promise<RenderResult> {
  const res = await fetch(source.source_url, { signal, headers: { 'User-Agent': 'Resovo-HealthWorker/1.0' } })
  if (!res.ok) return { status: 'dead', width: null, height: null, quality_detected: null, error_detail: `HTTP ${res.status}` }
  const xml = await res.text()
  const { maxResolutionHeight } = parseMpd(xml)
  const quality = maxResolutionHeight !== null ? heightToQuality(maxResolutionHeight) : null
  return { status: 'ok', width: null, height: maxResolutionHeight, quality_detected: quality, error_detail: null }
}

export function heightToQuality(height: number): QualityDetected {
  if (height >= 2160) return '4K'
  if (height >= 1440) return '2K'
  if (height >= 1080) return '1080P'
  if (height >= 720) return '720P'
  if (height >= 480) return '480P'
  if (height >= 360) return '360P'
  return '240P'
}

function parseWidth(resolution: string): number | null {
  const m = resolution.match(/^(\d+)x/)
  return m ? parseInt(m[1], 10) : null
}

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

async function loadLevel2Candidates(pool: Pool): Promise<VideoSource[]> {
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
