import type { Pool } from 'pg'
import type pino from 'pino'
import { config } from '../../config'
import { shouldSkipSite, recordFailure, recordSuccess } from '../../lib/circuit-breaker'
import { parseM3u8 } from '../../lib/parsers'
import { emitMetric } from '../../observability/metrics'
import type { VideoSource, ProbeStatus } from '../../types'

const FETCH_TIMEOUT_MS = config.probe.timeoutMs

type Level1Input = { sources: VideoSource[] }

export async function runLevel1Probe(pool: Pool, log: pino.Logger, input: Level1Input): Promise<void> {
  const { sources } = input
  log.info({ metric: 'probe.started', value: sources.length }, 'Level1 probe started')

  for (const source of sources) {
    const siteId = extractSiteId(source.source_url)
    if (shouldSkipSite(siteId)) {
      log.warn({ source_id: source.id, site_id: siteId }, 'circuit breaker active, skipping source')
      await writeHealthEvent(pool, {
        source_id: source.id,
        video_id: source.video_id,
        origin: 'circuit_breaker',
        error_detail: 'circuit breaker active',
        http_code: null,
        latency_ms: null,
        new_status: 'dead',
      })
      emitMetric(log, 'probe.skipped_circuit', 1, { site_id: siteId })
      continue
    }

    await probeOneSource(pool, log, source, siteId)
  }
}

async function probeOneSource(
  pool: Pool,
  log: pino.Logger,
  source: VideoSource,
  siteId: string,
): Promise<void> {
  const start = Date.now()
  try {
    const { httpCode, latencyMs, newStatus } = await fetchProbeStatus(source)
    const latency = latencyMs ?? Date.now() - start

    if (newStatus === 'ok') {
      recordSuccess(siteId)
    } else {
      recordFailure(siteId)
    }

    await updateSourceProbe(pool, source.id, newStatus, latency)
    await writeHealthEvent(pool, {
      source_id: source.id,
      video_id: source.video_id,
      origin: 'level1_probe',
      error_detail: null,
      http_code: httpCode,
      latency_ms: latency,
      new_status: newStatus,
    })

    emitMetric(log, 'probe.completed', 1, {
      source_id: source.id,
      status: newStatus,
      latency_ms: latency,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    recordFailure(siteId)
    await updateSourceProbe(pool, source.id, 'dead', null)
    await writeHealthEvent(pool, {
      source_id: source.id,
      video_id: source.video_id,
      origin: 'level1_probe',
      error_detail: msg,
      http_code: null,
      latency_ms: null,
      new_status: 'dead',
    })
    emitMetric(log, 'probe.failed', 1, { source_id: source.id, error: msg })
    log.error({ source_id: source.id, err: msg }, 'Level1 probe error')
  }
}

async function fetchProbeStatus(
  source: VideoSource,
): Promise<{ httpCode: number | null; latencyMs: number; newStatus: ProbeStatus }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const start = Date.now()
  try {
    if (source.type === 'hls') {
      const res = await fetch(source.source_url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': 'Resovo-HealthWorker/1.0' },
      })
      const latencyMs = Date.now() - start
      if (!res.ok) {
        return { httpCode: res.status, latencyMs, newStatus: 'dead' }
      }
      const text = await res.text()
      const { variants, isMaster } = parseM3u8(text)
      const reachable = isMaster ? variants.length > 0 : text.includes('#EXTINF')
      return { httpCode: res.status, latencyMs, newStatus: reachable ? 'ok' : 'partial' }
    }

    const res = await fetch(source.source_url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Resovo-HealthWorker/1.0' },
    })
    const latencyMs = Date.now() - start
    return { httpCode: res.status, latencyMs, newStatus: res.ok ? 'ok' : 'dead' }
  } finally {
    clearTimeout(timer)
  }
}

async function updateSourceProbe(
  pool: Pool,
  sourceId: string,
  status: ProbeStatus,
  latencyMs: number | null,
): Promise<void> {
  await pool.query(
    `UPDATE video_sources
     SET probe_status = $1, latency_ms = COALESCE($2, latency_ms), last_probed_at = NOW()
     WHERE id = $3`,
    [status, latencyMs, sourceId],
  )
}

async function writeHealthEvent(
  pool: Pool,
  event: {
    source_id: string
    video_id: string
    origin: string
    error_detail: string | null
    http_code: number | null
    latency_ms: number | null
    new_status: string
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO source_health_events
       (video_id, source_id, origin, new_status, error_detail, http_code, latency_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      event.video_id,
      event.source_id,
      event.origin,
      event.new_status,
      event.error_detail,
      event.http_code,
      event.latency_ms,
    ],
  )
}

export function extractSiteId(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url.slice(0, 64)
  }
}

export async function loadActiveSources(pool: Pool): Promise<VideoSource[]> {
  const result = await pool.query<VideoSource>(
    `SELECT id, video_id, source_url, type, is_active,
            probe_status, render_status, quality_detected,
            last_probed_at, last_rendered_at
     FROM video_sources
     WHERE is_active = true AND deleted_at IS NULL
     ORDER BY last_probed_at ASC NULLS FIRST`,
  )
  return result.rows
}
