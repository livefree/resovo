/**
 * sources-matrix.ts — /admin/sources 视频分组聚合查询（ADR-117 / CHG-VSR-3）
 *
 * D-117-7 / -3 修订（2026-05-13 CHG-SN-5-11-PATCH-2）：类型契约迁移至 `@resovo/types`
 * `sources-matrix.types.ts`（共享层），本文件仅 re-export + 提供 DB 查询。
 *
 * CHG-VSR-3 / ADR-117 AMENDMENT 3（D-117-VSR3-7）：拆分单一关注点——
 * 别名 CRUD → `source-line-aliases.ts` / routes-by-site + 行 mutations → `source-routes.ts`
 * / 单视频矩阵 → `video-matrix.ts`；本文件仅保留视频分组 KPI 统计 + 列表（含派生列 / KPI②维度）。
 *
 * 查询按 ADR-114-NEGATED 复合键约束：(source_site_key, source_name) 是线路的唯一标识。
 * 聚合业务逻辑（aggregateSignal）已迁至 Service 层（SourcesMatrixService），不在 DB 查询层。
 */

import type { Pool } from 'pg'
import type {
  ResolutionTier,
  VideoGroupRow,
  VideoGroupListResult,
  VideoGroupListParams,
  VideoGroupStats,
} from '@resovo/types'

// re-export 共享类型，保持向后兼容（apps/api 内部消费方）
export type {
  VideoGroupRow,
  VideoGroupListResult,
  VideoGroupListParams,
  VideoGroupStats,
}

/**
 * VideoGroupRowRaw — DB 查询层中间形态：probeStatuses/renderStatuses 是原始状态数组，
 * 由 Service 层（SourcesMatrixService）通过 aggregateSignal 派生 VideoGroupRow.probeStatus/renderStatus。
 *
 * CHG-SN-5-11-PATCH-2 P0-2 完成 Service 抽出：DB 查询层不持有业务规则。
 * CHG-VSR-3：派生列（activeSourceCount / qualityHighest 等，VideoGroupRow optional 字段）
 * 在本层直接产出，由 Service map 显式透传（D-117-VSR3 派生列双层透传）。
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
  // HOTFIX-PATCH-2B-FIX1（2026-05-25）：cell 显示该行跨的站点列表（STRING_AGG DISTINCT csv）
  site_keys: string | null
  // ── CHG-VSR-3 派生列（D-117-VSR3-1..3）：bigint COUNT 经 node-pg 回传为 string ──
  active_source_count: string
  disabled_count: string
  connect_fail_count: string
  render_fail_count: string
  pending_probe_count: string
  quality_coverage: string | number | null
  latency_median_ms: string | number | null
  quality_highest: string | null
  needs_source: boolean
  is_published: boolean
  last_checked_at: string | null
}

/**
 * D-117-VSR3-1：`quality_rank` CASE 7 档单一定义（Q1 SELECT 派生列 / Q2 stats 子查询 / Q3
 * quickFilters low_quality EXISTS 三处共用，禁散落）。逐源 `quality_detected ?? quality` 回退口径
 * （CHG-VSR-1 注释）；**勿照搬 LinesPanel `pickHighestQuality`**（aggregate.ts，仅 quality_detected、丢 quality 回退）。
 *
 * alias 参数化以适配不同 video_sources 别名（主查询 `vs` / EXISTS 子查询 `vsN`，避免别名遮蔽既有 vsN 约定）。
 * alias 值由本模块硬编码（非用户输入），无注入面。档位序：4K=7 …… 240P=1 / 无共享常量（producer 在 SQL CASE 实现）。
 */
const QUALITY_RANK_EXPR = (alias: string): string =>
  `CASE COALESCE(${alias}.quality_detected, ${alias}.quality) ` +
  `WHEN '4K' THEN 7 WHEN '2K' THEN 6 WHEN '1080P' THEN 5 WHEN '720P' THEN 4 ` +
  `WHEN '480P' THEN 3 WHEN '360P' THEN 2 WHEN '240P' THEN 1 ELSE NULL END`

// ── 查询：视频分组 KPI 统计 ───────────────────────────────────────

/**
 * KPI 统计（D-117-VSR3-4）：①维度（source_check_status）口径**零变更**保留 total/active/dead/orphan，
 * ②维度（video_sources 探测/质量聚合）新增 abnormal/needsSource/pendingProbe/lowQuality。
 *
 * **BLOCKER 结构约束**：①（videos 单行属性）与②（video_sources 聚合 / lowQuality 需视频级 MAX）
 * **禁同层 FILTER 双算** → 走 per-video 子查询 g（每视频一行）+ 外层 COUNT FILTER。
 * total=有源视频数（INNER JOIN 天然），与旧 `EXISTS(video_sources)` 等价（单测逐值回归断言）。
 */
export async function getVideoGroupStats(db: Pool): Promise<VideoGroupStats> {
  const result = await db.query<{
    total: string
    active: string
    dead: string
    orphan: string
    abnormal: string
    needs_source: string
    pending_probe: string
    low_quality: string
  }>(
    `SELECT
       COUNT(*)::TEXT AS total,
       COUNT(*) FILTER (WHERE g.source_check_status IN ('ok', 'partial'))::TEXT AS active,
       COUNT(*) FILTER (WHERE g.source_check_status = 'all_dead')::TEXT AS dead,
       COUNT(*) FILTER (WHERE g.source_check_status = 'all_dead' AND g.is_published = false)::TEXT AS orphan,
       COUNT(*) FILTER (WHERE g.has_abnormal)::TEXT AS abnormal,
       COUNT(*) FILTER (WHERE g.needs_source)::TEXT AS needs_source,
       COUNT(*) FILTER (WHERE g.has_pending)::TEXT AS pending_probe,
       COUNT(*) FILTER (WHERE g.quality_rank_max < 4)::TEXT AS low_quality
     FROM (
       SELECT
         v.id,
         v.source_check_status,
         v.is_published,
         bool_or(vs.probe_status = 'dead' OR vs.render_status = 'dead') AS has_abnormal,
         bool_or(vs.probe_status = 'pending') AS has_pending,
         (COUNT(*) FILTER (WHERE vs.is_active AND vs.probe_status <> 'dead' AND vs.render_status <> 'dead') = 0) AS needs_source,
         MAX(${QUALITY_RANK_EXPR('vs')}) AS quality_rank_max
       FROM videos v
       JOIN video_sources vs ON vs.video_id = v.id AND vs.deleted_at IS NULL
       WHERE v.deleted_at IS NULL
       GROUP BY v.id, v.source_check_status, v.is_published
     ) g`,
  )
  const row = result.rows[0]
  return {
    total: parseInt(row?.total ?? '0', 10),
    active: parseInt(row?.active ?? '0', 10),
    dead: parseInt(row?.dead ?? '0', 10),
    orphan: parseInt(row?.orphan ?? '0', 10),
    // CHG-VSR-3 ②维度（探测/质量）
    abnormal: parseInt(row?.abnormal ?? '0', 10),
    needsSource: parseInt(row?.needs_source ?? '0', 10),
    pendingProbe: parseInt(row?.pending_probe ?? '0', 10),
    lowQuality: parseInt(row?.low_quality ?? '0', 10),
  }
}

// ── 查询：视频分组列表 ────────────────────────────────────────────

// ADR-150 阶段 5 EP-4（2026-05-24）：sources sort 全栈白名单（与 PATCH-2 + distinct-whitelist 同范式）
// 字段映射：column.id → SQL ORDER BY 表达式（含 SELECT alias / 表前缀 / aggregate function）
// CHG-VSR-3 / D-117-VSR3-6：新增 activeSources/quality/lastChecked 走 SELECT 别名引用（裸标识符，IDENT 正则零放宽）
const SOURCES_SORT_FIELD_MAP: Record<string, string> = {
  video: 'v.title',              // column.id 'video' / cell 显示 title + cover 复合
  lineCount: 'line_count',       // SELECT alias / COUNT(DISTINCT line_key)
  sourceCount: 'source_count',   // SELECT alias / COUNT(vs.id)
  updated_at: 'MAX(vs.updated_at)', // 默认 fallback / aggregate
  activeSources: 'active_source_count', // SELECT alias / COUNT FILTER is_active（数值序，无 ::TEXT cast）
  quality: 'quality_rank_max',          // SELECT alias / MAX(quality_rank) int
  // Codex stop-time review FIX：排序走真实 timestamptz 别名 last_checked_sort（不可用 ::TEXT 的 last_checked_at——
  // 文本排序依赖 session DateStyle 非时序安全；与既有 updated_at 走 MAX(vs.updated_at) 时间戳同范式）
  lastChecked: 'last_checked_sort',     // SELECT alias / COALESCE(MAX(last_probed_at), MAX(updated_at)) timestamptz
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

  // CHG-VSR-5-B：旧 segment 四 Tab 查询分支（dead/correction/orphan，维度①/user_submissions）已删——
  // 由 quickFilters（维度②）+ lowQuality 取代（设计 §3.5「旧 Tab 退场说明」/ §5.1 用户投稿下线）。

  // HOTFIX-PATCH-2B（2026-05-25）：siteKey 数组 EXISTS ANY()（单值 → 多选 / distinct 端点首次消费实证）
  if (params.siteKey && params.siteKey.length > 0) {
    conditions.push(
      `EXISTS (SELECT 1 FROM video_sources vs2 WHERE vs2.video_id = v.id AND COALESCE(vs2.source_site_key, v.site_key) = ANY($${idx++}::TEXT[]) AND vs2.deleted_at IS NULL)`,
    )
    paramValues.push(params.siteKey)
  }

  // HOTFIX-PATCH-2A §2-EXT-1（2026-05-25）：probeStatus enum filter 多选 EXISTS ANY()
  // 语义"含至少一条线路 probe_status=X 的视频"（raw / 不严格等同 SignalPill 聚合显示）
  if (params.probeStatus && params.probeStatus.length > 0) {
    conditions.push(
      `EXISTS (SELECT 1 FROM video_sources vs3 WHERE vs3.video_id = v.id AND vs3.probe_status = ANY($${idx++}::TEXT[]) AND vs3.deleted_at IS NULL)`,
    )
    paramValues.push(params.probeStatus)
  }

  // HOTFIX-PATCH-2A §2-EXT-2（2026-05-25）：renderStatus enum filter 多选 EXISTS ANY()
  if (params.renderStatus && params.renderStatus.length > 0) {
    conditions.push(
      `EXISTS (SELECT 1 FROM video_sources vs4 WHERE vs4.video_id = v.id AND vs4.render_status = ANY($${idx++}::TEXT[]) AND vs4.deleted_at IS NULL)`,
    )
    paramValues.push(params.renderStatus)
  }

  // CHG-VSR-3 / D-117-VSR3-5：quickFilters 谓词全落 WHERE EXISTS（探测维度② / 质量），多卡可组合 AND。
  // 无 param 值（谓词常量 / QUALITY_RANK_EXPR 硬编码 alias），不占 $idx。
  const quickFilters = new Set(params.quickFilters ?? [])
  if (quickFilters.has('has_abnormal')) {
    conditions.push(
      `EXISTS (SELECT 1 FROM video_sources vs5 WHERE vs5.video_id = v.id AND (vs5.probe_status = 'dead' OR vs5.render_status = 'dead') AND vs5.deleted_at IS NULL)`,
    )
  }
  if (quickFilters.has('pending_probe')) {
    conditions.push(
      `EXISTS (SELECT 1 FROM video_sources vs6 WHERE vs6.video_id = v.id AND vs6.probe_status = 'pending' AND vs6.deleted_at IS NULL)`,
    )
  }
  if (quickFilters.has('needs_source')) {
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM video_sources vs7 WHERE vs7.video_id = v.id AND vs7.is_active AND vs7.probe_status <> 'dead' AND vs7.render_status <> 'dead' AND vs7.deleted_at IS NULL)`,
    )
  }
  // D-117-VSR3-5：`lowQuality` 列筛选 与 quickFilters 'low_quality' **入口归一**（OR 合流单份谓词，不双 push）。
  // 低质量 = 含已知质量（COALESCE 非空）AND 无任何源 rank>=4（即最高 < 720P）；质量未知（全空）不命中（NOT EXISTS 自然成立但前置 EXISTS 已知质量过滤掉）。
  const wantLowQuality = params.lowQuality === true || quickFilters.has('low_quality')
  if (wantLowQuality) {
    conditions.push(
      `EXISTS (SELECT 1 FROM video_sources vs8 WHERE vs8.video_id = v.id AND COALESCE(vs8.quality_detected, vs8.quality) IS NOT NULL AND vs8.deleted_at IS NULL) ` +
      `AND NOT EXISTS (SELECT 1 FROM video_sources vs9 WHERE vs9.video_id = v.id AND (${QUALITY_RANK_EXPR('vs9')}) >= 4 AND vs9.deleted_at IS NULL)`,
    )
  }

  const whereClause = conditions.map((c) => `(${c})`).join(' AND ')

  // HOTFIX-PATCH-2A §1-BUG-3（2026-05-25）：updatedAt 日期范围（HAVING / GROUP BY 后过滤）
  const havingClauses: string[] = []
  if (params.updatedAtFrom) {
    havingClauses.push(`MAX(vs.updated_at) >= $${idx++}::DATE`)
    paramValues.push(params.updatedAtFrom)
  }
  if (params.updatedAtTo) {
    // 含到日（+1 天 / < INTERVAL '1 day'）
    havingClauses.push(`MAX(vs.updated_at) < ($${idx++}::DATE + INTERVAL '1 day')`)
    paramValues.push(params.updatedAtTo)
  }
  // CHG-VSR-3：lastChecked 日期范围（MAX(last_probed_at) HAVING / 与 updatedAt 同范式 / CHG-VSR-1 "卡 3 实现"）
  if (params.lastCheckedFrom) {
    havingClauses.push(`MAX(vs.last_probed_at) >= $${idx++}::DATE`)
    paramValues.push(params.lastCheckedFrom)
  }
  if (params.lastCheckedTo) {
    havingClauses.push(`MAX(vs.last_probed_at) < ($${idx++}::DATE + INTERVAL '1 day')`)
    paramValues.push(params.lastCheckedTo)
  }
  const havingClause = havingClauses.length > 0 ? `HAVING ${havingClauses.join(' AND ')}` : ''

  // ADR-150 阶段 5 EP-4：sort 字段白名单 lookup / fallback MAX(vs.updated_at) DESC（默认行为不变）
  const sortCol = (params.sortField && SOURCES_SORT_FIELD_MAP[params.sortField]) ?? 'MAX(vs.updated_at)'
  const sortDir = params.sortDir === 'asc' ? 'ASC' : 'DESC'

  // HOTFIX-PATCH-2A §1-BUG-3：count SQL HAVING 支持（updatedAt/lastChecked range filter 时走聚合子查询）
  // havingClauses 非空 → 嵌套子查询 COUNT(*) / 否则保留原 COUNT(DISTINCT v.id) 形态（性能优势）
  const countSql = havingClauses.length > 0
    ? `SELECT COUNT(*)::TEXT AS cnt FROM (
         SELECT v.id FROM videos v
         JOIN video_sources vs ON vs.video_id = v.id AND vs.deleted_at IS NULL
         WHERE ${whereClause}
         GROUP BY v.id
         ${havingClause}
       ) sub`
    : `SELECT COUNT(DISTINCT v.id)::TEXT AS cnt FROM videos v WHERE ${whereClause}`

  const countResult = await db.query<{ cnt: string }>(countSql, paramValues)
  const total = parseInt(countResult.rows[0]?.cnt ?? '0', 10)

  // CHG-SN-5-13-PATCH-2: year + cover_url 已 migration 029 迁移到 media_catalog；需 JOIN（参 videos.ts VIDEO_JOIN）
  // CHG-VSR-3：派生列单趟聚合 FILTER（D-117-VSR3-1..3）。GROUP BY 追加 v.is_published（D-1）。
  // quality_rank_max（仅 ORDER BY 用，不映射 DTO）/ quality_highest=CASE MAX(rank) 反查 label（D-2）。
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
       MAX(vs.updated_at)::TEXT AS updated_at,
       STRING_AGG(DISTINCT COALESCE(vs.source_site_key, v.site_key), ',' ORDER BY COALESCE(vs.source_site_key, v.site_key)) AS site_keys,
       COUNT(vs.id) FILTER (WHERE vs.is_active = true) AS active_source_count,
       COUNT(vs.id) FILTER (WHERE vs.is_active = false) AS disabled_count,
       COUNT(vs.id) FILTER (WHERE vs.probe_status = 'dead') AS connect_fail_count,
       COUNT(vs.id) FILTER (WHERE vs.render_status = 'dead') AS render_fail_count,
       COUNT(vs.id) FILTER (WHERE vs.probe_status = 'pending') AS pending_probe_count,
       (COUNT(*) FILTER (WHERE vs.quality_detected IS NOT NULL)::FLOAT / NULLIF(COUNT(*), 0)) AS quality_coverage,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.latency_ms) AS latency_median_ms,
       MAX(${QUALITY_RANK_EXPR('vs')}) AS quality_rank_max,
       CASE MAX(${QUALITY_RANK_EXPR('vs')})
         WHEN 7 THEN '4K' WHEN 6 THEN '2K' WHEN 5 THEN '1080P' WHEN 4 THEN '720P'
         WHEN 3 THEN '480P' WHEN 2 THEN '360P' WHEN 1 THEN '240P' ELSE NULL END AS quality_highest,
       (COUNT(vs.id) FILTER (WHERE vs.is_active AND vs.probe_status <> 'dead' AND vs.render_status <> 'dead') = 0) AS needs_source,
       v.is_published AS is_published,
       COALESCE(MAX(vs.last_probed_at), MAX(vs.updated_at))::TEXT AS last_checked_at,
       -- Codex review FIX：真实 timestamptz 列，仅供 ORDER BY lastChecked 时序安全排序（DTO 读 ::TEXT 的 last_checked_at）
       COALESCE(MAX(vs.last_probed_at), MAX(vs.updated_at)) AS last_checked_sort
     FROM videos v
     JOIN media_catalog mc ON mc.id = v.catalog_id
     JOIN video_sources vs ON vs.video_id = v.id AND vs.deleted_at IS NULL
     WHERE ${whereClause}
     GROUP BY v.id, mc.year, mc.cover_url, v.is_published
     ${havingClause}
     ORDER BY ${sortCol} ${sortDir} NULLS LAST
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...paramValues, limit, offset],
  )

  // 返回 raw 状态数组；Service 层负责 aggregateSignal 派生最终 probeStatus/renderStatus
  // CHG-SN-5-11-PATCH-2 P0-2：业务规则归口 Service，DB 查询层不持有
  // CHG-VSR-3：派生列在本层产出（D-117-VSR3 派生列双层透传：raw map + Service map 均显式枚举）
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
    // HOTFIX-PATCH-2B-FIX1（2026-05-25）：站点列表派生（STRING_AGG csv → 数组 / 去重已 SQL 保证 / 升序）
    siteKeys: (row.site_keys ?? '').split(',').filter(Boolean),
    // ── CHG-VSR-3 派生列（bigint COUNT → string → parseInt）──
    activeSourceCount: parseInt(row.active_source_count, 10),
    disabledCount: parseInt(row.disabled_count, 10),
    connectFailCount: parseInt(row.connect_fail_count, 10),
    renderFailCount: parseInt(row.render_fail_count, 10),
    pendingProbeCount: parseInt(row.pending_probe_count, 10),
    qualityCoverage: row.quality_coverage == null ? undefined : Number(row.quality_coverage),
    latencyMedianMs: row.latency_median_ms == null ? null : Math.round(Number(row.latency_median_ms)),
    // D-2：CASE MAX(rank) 在 SQL 反查 label，本层仅断言 ResolutionTier（CASE 仅产 7 档或 NULL，断言安全）
    qualityHighest: (row.quality_highest as ResolutionTier | null) ?? null,
    needsSource: row.needs_source,
    isPublished: row.is_published,
    lastCheckedAt: row.last_checked_at,
  }))

  return { data, total, page, limit }
}
