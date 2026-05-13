/**
 * sources-matrix.ts — /admin/sources 线路矩阵聚合查询（CHG-SN-5-11）
 *
 * 查询按 ADR-114-NEGATED 复合键约束：(source_site_key, source_name) 是线路的唯一标识
 */

import type { Pool } from 'pg'

// ── 外部类型契约 ──────────────────────────────────────────────────

export type SourceSegment = 'grouped' | 'dead' | 'correction' | 'orphan'
export type SignalStatus = 'ok' | 'partial' | 'dead' | 'pending'

export interface VideoGroupRow {
  videoId: string
  title: string
  shortId: string
  type: string
  year: number | null
  coverUrl: string | null
  lineCount: number
  sourceCount: number
  probeStatus: SignalStatus
  renderStatus: SignalStatus
  updatedAt: string
}

export interface VideoGroupListResult {
  data: VideoGroupRow[]
  total: number
  page: number
  limit: number
}

export interface VideoGroupListParams {
  page?: number
  limit?: number
  keyword?: string
  segment?: SourceSegment
  siteKey?: string
  probeStatus?: string
  renderStatus?: string
}

export interface VideoGroupStats {
  total: number
  active: number
  dead: number
  orphan: number
}

export interface EpisodeCell {
  episodeNumber: number
  sourceId: string
  sourceUrl: string
  probeStatus: SignalStatus
  renderStatus: SignalStatus
  isActive: boolean
}

export interface LineMatrixRow {
  sourceSiteKey: string
  sourceName: string
  displayName: string | null
  episodes: EpisodeCell[]
}

export interface SourceLineAlias {
  sourceSiteKey: string
  sourceName: string
  displayName: string
  updatedAt: string
}

// ── 内部 DB 行类型 ────────────────────────────────────────────────

interface DbVideoGroupRow {
  video_id: string
  title: string
  short_id: string
  type: string
  year: number | null
  cover_url: string | null
  line_count: string
  source_count: string
  probe_status: string
  render_status: string
  updated_at: string
}

interface DbEpisodeCellRow {
  episode_number: number
  source_id: string
  source_url: string
  probe_status: string
  render_status: string
  is_active: boolean
  source_site_key: string | null
  source_name: string
  display_name: string | null
}

interface DbAliasRow {
  source_site_key: string
  source_name: string
  display_name: string
  updated_at: string
}

// ── 聚合信号状态推导 ──────────────────────────────────────────────

function aggregateSignal(statuses: string[]): SignalStatus {
  if (statuses.length === 0) return 'pending'
  if (statuses.every((s) => s === 'ok')) return 'ok'
  if (statuses.every((s) => s === 'dead')) return 'dead'
  if (statuses.some((s) => s === 'ok' || s === 'partial')) return 'partial'
  return 'pending'
}

// ── 查询：视频分组 KPI 统计 ───────────────────────────────────────

export async function getVideoGroupStats(db: Pool): Promise<VideoGroupStats> {
  const result = await db.query<{
    total: string
    active: string
    dead: string
    orphan: string
  }>(
    `SELECT
       COUNT(DISTINCT v.id)::TEXT AS total,
       COUNT(DISTINCT v.id) FILTER (WHERE v.source_check_status IN ('ok', 'partial'))::TEXT AS active,
       COUNT(DISTINCT v.id) FILTER (WHERE v.source_check_status = 'all_dead')::TEXT AS dead,
       COUNT(DISTINCT v.id) FILTER (WHERE v.source_check_status = 'all_dead' AND v.is_published = false)::TEXT AS orphan
     FROM videos v
     WHERE v.deleted_at IS NULL
       AND EXISTS (
         SELECT 1 FROM video_sources vs
         WHERE vs.video_id = v.id AND vs.deleted_at IS NULL
       )`,
  )
  const row = result.rows[0]
  return {
    total: parseInt(row?.total ?? '0', 10),
    active: parseInt(row?.active ?? '0', 10),
    dead: parseInt(row?.dead ?? '0', 10),
    orphan: parseInt(row?.orphan ?? '0', 10),
  }
}

// ── 查询：视频分组列表 ────────────────────────────────────────────

export async function listVideoGroups(
  db: Pool,
  params: VideoGroupListParams,
): Promise<VideoGroupListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 20))
  const offset = (page - 1) * limit

  const conditions: string[] = [
    'v.deleted_at IS NULL',
    'EXISTS (SELECT 1 FROM video_sources vs0 WHERE vs0.video_id = v.id AND vs0.deleted_at IS NULL)',
  ]
  const paramValues: unknown[] = []
  let idx = 1

  if (params.keyword) {
    conditions.push(`v.title ILIKE $${idx++}`)
    paramValues.push(`%${params.keyword}%`)
  }

  if (params.segment === 'dead') {
    conditions.push(`v.source_check_status = 'all_dead'`)
  } else if (params.segment === 'correction') {
    conditions.push(
      `EXISTS (SELECT 1 FROM video_sources vs1 WHERE vs1.video_id = v.id AND vs1.submitted_by IS NOT NULL AND vs1.deleted_at IS NULL)`,
    )
  } else if (params.segment === 'orphan') {
    conditions.push(`v.source_check_status = 'all_dead' AND v.is_published = false`)
  }

  if (params.siteKey) {
    conditions.push(
      `EXISTS (SELECT 1 FROM video_sources vs2 WHERE vs2.video_id = v.id AND COALESCE(vs2.source_site_key, v.site_key) = $${idx++} AND vs2.deleted_at IS NULL)`,
    )
    paramValues.push(params.siteKey)
  }

  const whereClause = conditions.map((c) => `(${c})`).join(' AND ')

  const countResult = await db.query<{ cnt: string }>(
    `SELECT COUNT(DISTINCT v.id)::TEXT AS cnt
     FROM videos v
     WHERE ${whereClause}`,
    paramValues,
  )
  const total = parseInt(countResult.rows[0]?.cnt ?? '0', 10)

  const rowsResult = await db.query<DbVideoGroupRow>(
    `SELECT
       v.id AS video_id,
       v.title,
       v.short_id,
       v.type,
       v.year,
       v.cover_url,
       COUNT(DISTINCT (COALESCE(vs.source_site_key, v.site_key), vs.source_name))::TEXT AS line_count,
       COUNT(vs.id)::TEXT AS source_count,
       STRING_AGG(DISTINCT vs.probe_status, ',') AS probe_status,
       STRING_AGG(DISTINCT vs.render_status, ',') AS render_status,
       MAX(vs.updated_at)::TEXT AS updated_at
     FROM videos v
     JOIN video_sources vs ON vs.video_id = v.id AND vs.deleted_at IS NULL
     WHERE ${whereClause}
     GROUP BY v.id
     ORDER BY MAX(vs.updated_at) DESC NULLS LAST
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...paramValues, limit, offset],
  )

  const data: VideoGroupRow[] = rowsResult.rows.map((row) => {
    const probeStatuses = (row.probe_status ?? '').split(',').filter(Boolean)
    const renderStatuses = (row.render_status ?? '').split(',').filter(Boolean)
    return {
      videoId: row.video_id,
      title: row.title,
      shortId: row.short_id,
      type: row.type,
      year: row.year,
      coverUrl: row.cover_url,
      lineCount: parseInt(row.line_count, 10),
      sourceCount: parseInt(row.source_count, 10),
      probeStatus: aggregateSignal(probeStatuses),
      renderStatus: aggregateSignal(renderStatuses),
      updatedAt: row.updated_at,
    }
  })

  return { data, total, page, limit }
}

// ── 查询：单视频线路×集数矩阵 ─────────────────────────────────────

export async function getVideoMatrix(
  db: Pool,
  videoId: string,
): Promise<LineMatrixRow[]> {
  const rows = await db.query<DbEpisodeCellRow>(
    `SELECT
       vs.episode_number,
       vs.id AS source_id,
       vs.source_url,
       vs.probe_status,
       vs.render_status,
       vs.is_active,
       COALESCE(vs.source_site_key, v.site_key) AS source_site_key,
       vs.source_name,
       sla.display_name
     FROM video_sources vs
     JOIN videos v ON v.id = vs.video_id
     LEFT JOIN source_line_aliases sla
       ON sla.source_site_key = COALESCE(vs.source_site_key, v.site_key)
      AND sla.source_name = vs.source_name
     WHERE vs.video_id = $1
       AND vs.deleted_at IS NULL
     ORDER BY vs.source_name, vs.episode_number`,
    [videoId],
  )

  const linesMap = new Map<string, LineMatrixRow>()
  for (const row of rows.rows) {
    const key = `${row.source_site_key ?? ''}::${row.source_name}`
    if (!linesMap.has(key)) {
      linesMap.set(key, {
        sourceSiteKey: row.source_site_key ?? '',
        sourceName: row.source_name,
        displayName: row.display_name,
        episodes: [],
      })
    } else if (row.display_name !== null) {
      // 取第一个非 null 别名（LEFT JOIN 同线路各行应相同，但防御性取最新非空值）
      const existing = linesMap.get(key)!
      if (existing.displayName === null) {
        linesMap.set(key, { ...existing, displayName: row.display_name })
      }
    }
    linesMap.get(key)!.episodes.push({
      episodeNumber: row.episode_number,
      sourceId: row.source_id,
      sourceUrl: row.source_url,
      probeStatus: row.probe_status as SignalStatus,
      renderStatus: row.render_status as SignalStatus,
      isActive: row.is_active,
    })
  }

  return Array.from(linesMap.values())
}

// ── 查询：全局别名列表 ────────────────────────────────────────────

export async function listLineAliases(db: Pool): Promise<SourceLineAlias[]> {
  const result = await db.query<DbAliasRow>(
    `SELECT source_site_key, source_name, display_name, updated_at
     FROM source_line_aliases
     ORDER BY source_site_key, source_name`,
  )
  return result.rows.map((r) => ({
    sourceSiteKey: r.source_site_key,
    sourceName: r.source_name,
    displayName: r.display_name,
    updatedAt: r.updated_at,
  }))
}

// ── 查询：单条别名（Service 层 audit before 状态）────────────────────

export async function findLineAlias(
  db: Pool,
  sourceSiteKey: string,
  sourceName: string,
): Promise<SourceLineAlias | null> {
  const result = await db.query<DbAliasRow>(
    `SELECT source_site_key, source_name, display_name, updated_at
     FROM source_line_aliases
     WHERE source_site_key = $1 AND source_name = $2`,
    [sourceSiteKey, sourceName],
  )
  const r = result.rows[0]
  if (!r) return null
  return {
    sourceSiteKey: r.source_site_key,
    sourceName: r.source_name,
    displayName: r.display_name,
    updatedAt: r.updated_at,
  }
}

// ── 写操作：upsert 别名 ───────────────────────────────────────────

export async function upsertLineAlias(
  db: Pool,
  sourceSiteKey: string,
  sourceName: string,
  displayName: string,
  updatedBy: string,
): Promise<SourceLineAlias> {
  const result = await db.query<DbAliasRow>(
    `INSERT INTO source_line_aliases (source_site_key, source_name, display_name, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (source_site_key, source_name)
     DO UPDATE SET display_name = EXCLUDED.display_name,
                   updated_by   = EXCLUDED.updated_by,
                   updated_at   = NOW()
     RETURNING source_site_key, source_name, display_name, updated_at`,
    [sourceSiteKey, sourceName, displayName, updatedBy],
  )
  const r = result.rows[0]
  return {
    sourceSiteKey: r.source_site_key,
    sourceName: r.source_name,
    displayName: r.display_name,
    updatedAt: r.updated_at,
  }
}
