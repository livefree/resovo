import type { Pool } from 'pg'
import type pino from 'pino'
import { config } from '../../config'
import { shouldSkipSite, recordFailure, recordSuccess } from '../../lib/circuit-breaker'
import { persistCircuitTransition } from './host-health'
import { extractHostname, parseM3u8 } from '@resovo/media-probe'
import { emitMetric } from '../../observability/metrics'
import type { VideoSource, ProbeStatus } from '../../types'

const FETCH_TIMEOUT_MS = config.probe.timeoutMs

type Level1Input = { sources: VideoSource[] }

export async function runLevel1Probe(pool: Pool, log: pino.Logger, input: Level1Input): Promise<void> {
  const { sources } = input
  log.info({ metric: 'probe.started', value: sources.length }, 'Level1 probe started')

  for (const source of sources) {
    // P3-3-B1 裁决 E：hostname 语义真源 = extractHostname（与 video_sources.source_hostname
    // byte-identical 方可 JOIN host_health）；null（无有效 hostname）不进熔断统计直接探测——
    // 不可 JOIN 的孤儿 key 会污染内存 Map 与 host_health
    const hostname = extractHostname(source.source_url)
    if (hostname !== null && shouldSkipSite(hostname)) {
      log.warn({ source_id: source.id, site_id: hostname }, 'circuit breaker active, skipping source')
      await writeHealthEvent(pool, {
        source_id: source.id,
        video_id: source.video_id,
        origin: 'circuit_breaker',
        error_detail: 'circuit breaker active',
        http_code: null,
        latency_ms: null,
        new_status: 'dead',
      })
      emitMetric(log, 'probe.skipped_circuit', 1, { site_id: hostname })
      continue
    }

    await probeOneSource(pool, log, source, hostname)
  }
}

async function probeOneSource(
  pool: Pool,
  log: pino.Logger,
  source: VideoSource,
  hostname: string | null,
): Promise<void> {
  const start = Date.now()
  try {
    const { httpCode, latencyMs, newStatus } = await fetchProbeStatus(source)
    const latency = latencyMs ?? Date.now() - start

    if (hostname !== null) {
      const transition = newStatus === 'ok' ? recordSuccess(hostname) : recordFailure(hostname)
      await persistCircuitTransition(pool, log, hostname, transition)
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
    if (hostname !== null) {
      await persistCircuitTransition(pool, log, hostname, recordFailure(hostname))
    }
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

/**
 * SRCHEALTH-P1-5（F2）：按 id 集合加载源 — feedback recheck 定向 level1 重探入口。
 * 与 loadActiveSources 同口径（is_active + 未删除），仅加 id 过滤。
 */
export async function loadSourcesByIds(pool: Pool, sourceIds: readonly string[]): Promise<VideoSource[]> {
  if (sourceIds.length === 0) return []
  const result = await pool.query<VideoSource>(
    `SELECT id, video_id, source_url, type, is_active,
            probe_status, render_status, quality_detected,
            last_probed_at, last_rendered_at
     FROM video_sources
     WHERE id = ANY($1::uuid[]) AND is_active = true AND deleted_at IS NULL`,
    [sourceIds],
  )
  return result.rows
}
