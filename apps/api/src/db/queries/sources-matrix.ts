/**
 * sources-matrix.ts — /admin/sources 线路矩阵聚合查询（ADR-117 / CHG-SN-5-11-PATCH-2）
 *
 * D-117-7 / -3 修订（2026-05-13 CHG-SN-5-11-PATCH-2）：类型契约迁移至 `@resovo/types`
 * `sources-matrix.types.ts`（共享层），本文件仅 re-export + 提供 DB 查询。
 *
 * 查询按 ADR-114-NEGATED 复合键约束：(source_site_key, source_name) 是线路的唯一标识。
 * 聚合业务逻辑（aggregateSignal）已迁至 Service 层（SourcesMatrixService），不在 DB 查询层。
 */

import type { Pool } from 'pg'
import type {
  DualSignalState,
  SourceSegment,
  VideoGroupRow,
  VideoGroupListResult,
  VideoGroupListParams,
  VideoGroupStats,
  EpisodeCell,
  LineMatrixRow,
  SourceLineAlias,
  SourceRouteBySite,
} from '@resovo/types'

// re-export 共享类型，保持向后兼容（apps/api 内部消费方）
export type {
  DualSignalState,
  SourceSegment,
  VideoGroupRow,
  VideoGroupListResult,
  VideoGroupListParams,
  VideoGroupStats,
  EpisodeCell,
  LineMatrixRow,
  SourceLineAlias,
  SourceRouteBySite,
}

/**
 * VideoGroupRowRaw — DB 查询层中间形态：probeStatuses/renderStatuses 是原始状态数组，
 * 由 Service 层（SourcesMatrixService）通过 aggregateSignal 派生 VideoGroupRow.probeStatus/renderStatus。
 *
 * CHG-SN-5-11-PATCH-2 P0-2 完成 Service 抽出：DB 查询层不持有业务规则。
 */
export interface VideoGroupRowRaw extends Omit<VideoGroupRow, 'probeStatus' | 'renderStatus'> {
  readonly probeStatuses: readonly string[]
  readonly renderStatuses: readonly string[]
}

export interface VideoGroupListRawResult {
  readonly data: readonly VideoGroupRowRaw[]
  readonly total: number
  readonly page: number
  readonly limit: number
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

// ADR-150 阶段 5 EP-4（2026-05-24）：sources sort 全栈白名单（与 PATCH-2 + distinct-whitelist 同范式）
// 字段映射：column.id → SQL ORDER BY 表达式（含 SELECT alias / 表前缀 / aggregate function）
const SOURCES_SORT_FIELD_MAP: Record<string, string> = {
  video: 'v.title',              // column.id 'video' / cell 显示 title + cover 复合
  lineCount: 'line_count',       // SELECT alias / COUNT(DISTINCT line_key)
  sourceCount: 'source_count',   // SELECT alias / COUNT(vs.id)
  updated_at: 'MAX(vs.updated_at)', // 默认 fallback / aggregate
}

// AMD2-PATCH-2 风格 SQL identifier 正则启动期断言（防 SQL 注入 / 与 SORT_IDENT_REGEX 同范式）
// 允许：col / table.col / aggregate(...)（含括号空格）
const SOURCES_SORT_IDENT_REGEX = /^(?:[A-Z_]+\([a-z_\.]+\)|[a-z_]+\.[a-z_]+|[a-z_]+)$/
for (const [k, v] of Object.entries(SOURCES_SORT_FIELD_MAP)) {
  if (!SOURCES_SORT_IDENT_REGEX.test(v)) {
    throw new Error(`[sources-matrix] invalid SQL ident "${v}" for sortField=${k}`)
  }
}

export async function listVideoGroups(
  db: Pool,
  params: VideoGroupListParams,
): Promise<VideoGroupListRawResult> {
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

  // ADR-150 阶段 5 EP-4：sort 字段白名单 lookup / fallback MAX(vs.updated_at) DESC（默认行为不变）
  const sortCol = (params.sortField && SOURCES_SORT_FIELD_MAP[params.sortField]) ?? 'MAX(vs.updated_at)'
  const sortDir = params.sortDir === 'asc' ? 'ASC' : 'DESC'

  const countResult = await db.query<{ cnt: string }>(
    `SELECT COUNT(DISTINCT v.id)::TEXT AS cnt
     FROM videos v
     WHERE ${whereClause}`,
    paramValues,
  )
  const total = parseInt(countResult.rows[0]?.cnt ?? '0', 10)

  // CHG-SN-5-13-PATCH-2: year + cover_url 已 migration 029 迁移到 media_catalog；需 JOIN（参 videos.ts VIDEO_JOIN）
  const rowsResult = await db.query<DbVideoGroupRow>(
    `SELECT
       v.id AS video_id,
       v.title,
       v.short_id,
       v.type,
       mc.year,
       mc.cover_url,
       COUNT(DISTINCT (COALESCE(vs.source_site_key, v.site_key), vs.source_name))::TEXT AS line_count,
       COUNT(vs.id)::TEXT AS source_count,
       STRING_AGG(DISTINCT vs.probe_status, ',') AS probe_status,
       STRING_AGG(DISTINCT vs.render_status, ',') AS render_status,
       MAX(vs.updated_at)::TEXT AS updated_at
     FROM videos v
     JOIN media_catalog mc ON mc.id = v.catalog_id
     JOIN video_sources vs ON vs.video_id = v.id AND vs.deleted_at IS NULL
     WHERE ${whereClause}
     GROUP BY v.id, mc.year, mc.cover_url
     ORDER BY ${sortCol} ${sortDir} NULLS LAST
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...paramValues, limit, offset],
  )

  // 返回 raw 状态数组；Service 层负责 aggregateSignal 派生最终 probeStatus/renderStatus
  // CHG-SN-5-11-PATCH-2 P0-2：业务规则归口 Service，DB 查询层不持有
  const data: VideoGroupRowRaw[] = rowsResult.rows.map((row) => ({
    videoId: row.video_id,
    title: row.title,
    shortId: row.short_id,
    type: row.type,
    year: row.year,
    coverUrl: row.cover_url,
    lineCount: parseInt(row.line_count, 10),
    sourceCount: parseInt(row.source_count, 10),
    probeStatuses: (row.probe_status ?? '').split(',').filter(Boolean),
    renderStatuses: (row.render_status ?? '').split(',').filter(Boolean),
    updatedAt: row.updated_at,
  }))

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

  // 中间形态：episodes 为 mutable 数组便于 push，最后通过 readonly cast 返回符合共享类型
  type LineMatrixRowMutable = {
    sourceSiteKey: string
    sourceName: string
    displayName: string | null
    episodes: EpisodeCell[]
  }
  const linesMap = new Map<string, LineMatrixRowMutable>()
  for (const row of rows.rows) {
    const key = `${row.source_site_key ?? ''}::${row.source_name}`
    let line = linesMap.get(key)
    if (!line) {
      line = {
        sourceSiteKey: row.source_site_key ?? '',
        sourceName: row.source_name,
        displayName: row.display_name,
        episodes: [],
      }
      linesMap.set(key, line)
    } else if (row.display_name !== null && line.displayName === null) {
      // 取第一个非 null 别名（LEFT JOIN 同线路各行应相同，但防御性取最新非空值）
      line.displayName = row.display_name
    }
    line.episodes.push({
      episodeNumber: row.episode_number,
      sourceId: row.source_id,
      sourceUrl: row.source_url,
      probeStatus: row.probe_status as DualSignalState,
      renderStatus: row.render_status as DualSignalState,
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

// ── 查询：按 siteKey 聚合线路明细（ADR-117 AMENDMENT 2026-05-19）─────

/**
 * DB 中间形态：probe/render statuses 是 STRING_AGG 拼接的逗号分隔字符串
 * （DISTINCT 已在 SQL 层去重）；Service 层 split + 调用 aggregateSignal 派生 worst。
 */
export interface SourceRouteBySiteRaw extends Omit<SourceRouteBySite, 'probeStatus' | 'renderStatus'> {
  readonly probeStatuses: readonly string[]
  readonly renderStatuses: readonly string[]
}

interface DbRouteBySiteRow {
  source_site_key: string
  source_name: string
  display_name: string | null
  probe_statuses: string | null
  render_statuses: string | null
  avg_latency_ms: string | null
  source_count: string
  active_count: string
  last_probed_at: string | null
}

/**
 * 按 siteKey 聚合 video_sources 行 → 单站点线路明细列表
 * （ADR-117 AMENDMENT 2026-05-19 / CHG-SN-7-REDO-01-E）。
 *
 * 业务规则归口 Service 层：
 *   - SQL 仅 STRING_AGG DISTINCT 拼 raw 状态；Service split + aggregateSignal 派生 worst
 *   - latency 选 AVG 不选 p95（Y2 评估 / 单站点 < 200 线路 / PG percentile_disc 性能受限）
 *   - 软删除过滤 vs.deleted_at IS NULL（与 row 3 getVideoMatrix 一致）
 *   - COALESCE(vs.source_site_key, v.site_key) fallback（migration 046 NULLABLE）
 */
export async function listRoutesBySite(
  db: Pool,
  siteKey: string,
): Promise<readonly SourceRouteBySiteRaw[]> {
  const result = await db.query<DbRouteBySiteRow>(
    `SELECT
       COALESCE(vs.source_site_key, v.site_key)     AS source_site_key,
       vs.source_name                                AS source_name,
       sla.display_name                              AS display_name,
       STRING_AGG(DISTINCT vs.probe_status, ',')     AS probe_statuses,
       STRING_AGG(DISTINCT vs.render_status, ',')    AS render_statuses,
       AVG(vs.latency_ms) FILTER (WHERE vs.latency_ms IS NOT NULL) AS avg_latency_ms,
       COUNT(*)                                      AS source_count,
       COUNT(*) FILTER (WHERE vs.is_active = true)   AS active_count,
       MAX(vs.last_probed_at)                        AS last_probed_at
     FROM video_sources vs
     JOIN videos v ON v.id = vs.video_id
     LEFT JOIN source_line_aliases sla
       ON sla.source_site_key = COALESCE(vs.source_site_key, v.site_key)
      AND sla.source_name     = vs.source_name
     WHERE COALESCE(vs.source_site_key, v.site_key) = $1
       AND vs.deleted_at IS NULL
     GROUP BY COALESCE(vs.source_site_key, v.site_key), vs.source_name, sla.display_name
     ORDER BY vs.source_name ASC`,
    [siteKey],
  )

  return result.rows.map((r): SourceRouteBySiteRaw => ({
    sourceSiteKey: r.source_site_key,
    sourceName: r.source_name,
    displayName: r.display_name,
    probeStatuses: r.probe_statuses ? r.probe_statuses.split(',') : [],
    renderStatuses: r.render_statuses ? r.render_statuses.split(',') : [],
    avgLatencyMs: r.avg_latency_ms != null ? Math.round(Number(r.avg_latency_ms)) : null,
    sourceCount: Number(r.source_count),
    activeCount: Number(r.active_count),
    lastProbedAt: r.last_probed_at,
  }))
}

// ── ADR-117 AMENDMENT 2 2026-05-19 / CHG-SN-7-REDO-01-E2 ──────────
// 行级 3 mutations 支撑 queries（test 样本 / 软删除）

/**
 * 取 (siteKey, sourceName) 线路下的代表性样本（episode 最小、is_active、未删除的一行 source_url + videoId）
 * 用于 row 7 POST test 端点同步快探。
 */
export async function selectRouteSampleSource(
  db: Pool,
  siteKey: string,
  sourceName: string,
): Promise<{ readonly videoId: string; readonly sourceUrl: string } | null> {
  const result = await db.query<{ video_id: string; source_url: string }>(
    `SELECT vs.video_id, vs.source_url
       FROM video_sources vs
       JOIN videos v ON v.id = vs.video_id
      WHERE COALESCE(vs.source_site_key, v.site_key) = $1
        AND vs.source_name = $2
        AND vs.deleted_at IS NULL
        AND vs.is_active = true
      ORDER BY vs.episode_number ASC NULLS LAST
      LIMIT 1`,
    [siteKey, sourceName],
  )
  if (result.rows.length === 0) return null
  return { videoId: result.rows[0].video_id, sourceUrl: result.rows[0].source_url }
}

/**
 * 统计 (siteKey, sourceName) 线路下未删除 video_sources 行数（用于 reprobe queuedCount + 404 判定）
 */
export async function countRouteSources(
  db: Pool,
  siteKey: string,
  sourceName: string,
): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count
       FROM video_sources vs
       JOIN videos v ON v.id = vs.video_id
      WHERE COALESCE(vs.source_site_key, v.site_key) = $1
        AND vs.source_name = $2
        AND vs.deleted_at IS NULL`,
    [siteKey, sourceName],
  )
  return Number(result.rows[0]?.count ?? 0)
}

/**
 * 软删除 (siteKey, sourceName) 线路下所有未删除的 video_sources 行；
 * 返回被删行的 id 列表（供 audit beforeJsonb 引用）。
 * ADR-105 软删除范式（deleted_at = NOW()）+ ADR-117 AMENDMENT 2 §SQL 设计。
 */
export async function softDeleteRouteBySite(
  db: Pool,
  siteKey: string,
  sourceName: string,
): Promise<readonly string[]> {
  const result = await db.query<{ id: string }>(
    `UPDATE video_sources vs
        SET deleted_at = NOW(), updated_at = NOW()
       FROM videos v
      WHERE vs.video_id = v.id
        AND COALESCE(vs.source_site_key, v.site_key) = $1
        AND vs.source_name = $2
        AND vs.deleted_at IS NULL
      RETURNING vs.id`,
    [siteKey, sourceName],
  )
  return result.rows.map((r) => r.id)
}
