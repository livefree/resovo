/**
 * imageHealth.scan.ts — 封面重扫 / fallback 域切换 / 破损趋势 / 事件解决
 * 从 imageHealth.ts 拆出（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool, PoolClient } from 'pg'

// ── 查询：7 天破损趋势（按日聚合）───────────────────────────────

export interface BrokenTrendPoint {
  date: string   // YYYY-MM-DD
  count: number
}

/**
 * 返回最近 `days` 天（含今天）每天的破损视频数，缺失日期补 0。
 * 结果按日期升序排列。
 */
export async function getBrokenEventsTrend(
  db: Pool,
  days = 7
): Promise<BrokenTrendPoint[]> {
  const result = await db.query<{ day: string; count: string }>(
    `SELECT
       date_trunc('day', first_seen_at)::date::text AS day,
       COUNT(DISTINCT video_id)::int                AS count
     FROM broken_image_events
     WHERE first_seen_at >= NOW() - ($1 || ' days')::interval
       AND resolved_at IS NULL
     GROUP BY day
     ORDER BY day ASC`,
    [days]
  )

  // 生成完整日期序列，缺失日补 0
  const byDay = new Map(result.rows.map(r => [r.day, parseInt(r.count, 10)]))
  const points: BrokenTrendPoint[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    points.push({ date: key, count: byDay.get(key) ?? 0 })
  }
  return points
}

// ── 真·加载失败事件白名单（ADR-210 D-210-6 裁定；ADR-211 problem-images 口径复用）─────────

// 「真·加载失败」event_type（图实际打不开）。排除 timeout（worker 300ms HEAD 超时误报，浏览器能正常
// 加载）+ dimension_too_small/aspect_mismatch（图能加载、仅尺寸/比例不合规，属 low_quality 范畴）。
// problemFilterSql（getProblemImages/getProblemImageCounts）据此判「② 真坏事件」分支。
export const BROKEN_SAMPLE_EVENT_TYPES = [
  'client_load_error', 'empty_src', 'fetch_404', 'fetch_5xx', 'decode_fail',
] as const

// ── 方案 C 健康判定窗口常量（ADR-213，migration 121 落地；P4-C 读端谓词消费）──────────
//
// CLIENT_ERROR_WINDOW_DAYS：浏览器自过期信号窗口（D-213-3）。前台 beacon 写 <kind>_client_error_at，
//   读端 `client_error_at >= NOW()-INTERVAL 'N days'` 内计入真破损（client_error），超窗自动衰减出板，
//   无需写端清理。与 brokenLast7Days（imageHealth.ts，7 天）口径对齐。migration 121 回填同用 7 天。
export const CLIENT_ERROR_WINDOW_DAYS = 7
//
// STALE_CHECK_DAYS：stale-ok 阈值（D-213-9）。status='ok' 但 checked_at 早于此（或 NULL）→ 判 'unknown'
//   （未验证，非 healthy），防 worker 久未确定性复检的 ok 行被当健康（确证假阴性类，Codex round-2 ADV-213-4）。
export const STALE_CHECK_DAYS = 30

// ── 查询：问题图片可视化治理板（ADR-211，supersede ADR-210 破损样本区）────

export const PROBLEM_IMAGE_KINDS = ['poster', 'backdrop', 'logo', 'banner_backdrop'] as const
export type ProblemImageKind = (typeof PROBLEM_IMAGE_KINDS)[number]
export type ProblemImageScope = 'published' | 'all'

/**
 * kind → media_catalog 列名映射（**白名单 Record，ADR-211 MEDIUM-1：禁请求参数裸插值列名**）。
 * 注意 poster 的 URL 列历史名为 `cover_url`（非 poster_url）。值均为代码常量、非请求输入。
 */
const PROBLEM_KIND_COLS: Record<ProblemImageKind, { url: string; status: string }> = {
  poster:          { url: 'cover_url',           status: 'poster_status' },
  backdrop:        { url: 'backdrop_url',        status: 'backdrop_status' },
  logo:            { url: 'logo_url',            status: 'logo_status' },
  banner_backdrop: { url: 'banner_backdrop_url', status: 'banner_backdrop_status' },
}

/** problemReason：UI 分色 + 默认排序优先级（ADR-211 D-211-3 / Codex H-2，broken_event 最先展示）。 */
export type ProblemReason = 'broken_event' | 'broken' | 'low_quality' | 'pending_review' | 'other'

export interface ProblemImageRow {
  videoId: string
  catalogId: string
  title: string
  isPublished: boolean
  kind: ProblemImageKind
  /** <kind>_url，口径已含 IS NOT NULL + btrim<>'' 守卫 → 恒非空非空白 */
  imageUrl: string
  status: string
  problemReason: ProblemReason
  /** poster_source（仅 poster 有意义；secondary 恒 null） */
  source: string | null
  eventType: string | null
  brokenDomain: string | null
  occurrenceCount: number
  lastSeenBrokenAt: string | null
}

export interface ProblemImageCounts {
  poster: number
  backdrop: number
  logo: number
  banner_backdrop: number
}

/**
 * 单 kind 的「问题图片」WHERE 谓词（ADR-211 D-211-2，与 counts 共用确保一致）：
 *   `<kind>_url 非空非空白 AND (status<>'ok' OR 存在未解决真坏事件)`。
 * 列名 + kind 字面量均来自 PROBLEM_KIND_COLS / 常量，非请求输入（防注入）；
 * 真坏事件白名单走参数 `$evtParam`（BROKEN_SAMPLE_EVENT_TYPES）。
 */
function problemFilterSql(kind: ProblemImageKind, evtParam: string): string {
  const { url, status } = PROBLEM_KIND_COLS[kind]
  return `mc.${url} IS NOT NULL AND btrim(mc.${url}) <> '' AND (
    mc.${status} <> 'ok' OR EXISTS (
      SELECT 1 FROM broken_image_events b
      WHERE b.video_id = v.id AND b.image_kind = '${kind}'
        AND b.resolved_at IS NULL AND b.event_type = ANY(${evtParam}::text[])
    ))`
}

/**
 * ADR-211：按 kind/scope 返回「有非空 URL 但可能失效」的问题图片分页集，供问题板看图分诊。
 * - 口径 D-211-2（problemFilterSql）+ LATERAL 取最近未解决真坏事件（domain/原因/次数/时间）。
 * - 默认排序 problemReason 优先级（真坏在前）+ last_seen DESC（Codex H-2 防 low_quality 淹没）。
 * - 已删视频经 JOIN 滤除；offset/limit 加载更多（漂移缓解在前端，Codex H-3）。
 */
export async function getProblemImages(
  db: Pool,
  kind: ProblemImageKind,
  scope: ProblemImageScope,
  offset = 0,
  limit = 48,
): Promise<ProblemImageRow[]> {
  const { url: urlCol, status: statusCol } = PROBLEM_KIND_COLS[kind]
  const publishedFilter = scope === 'published' ? 'AND v.is_published = true' : ''
  const sourceExpr = kind === 'poster' ? 'mc.poster_source' : 'NULL::text'

  const result = await db.query<{
    video_id: string
    catalog_id: string
    title: string
    is_published: boolean
    image_url: string
    status: string
    problem_reason: ProblemReason
    source: string | null
    event_type: string | null
    broken_domain: string | null
    occurrence_count: number | null
    last_seen_broken_at: string | null
  }>(
    `WITH base AS (
       SELECT
         v.id AS video_id, v.catalog_id, v.title, v.is_published,
         mc.${urlCol} AS image_url, mc.${statusCol} AS status, ${sourceExpr} AS source,
         evt.event_type, evt.url AS evt_url, evt.occurrence_count, evt.last_seen_at
       FROM videos v
       JOIN media_catalog mc ON mc.id = v.catalog_id
       LEFT JOIN LATERAL (
         SELECT event_type, url, occurrence_count, last_seen_at
         FROM broken_image_events
         WHERE video_id = v.id AND image_kind = $1
           AND resolved_at IS NULL AND event_type = ANY($2::text[])
         ORDER BY last_seen_at DESC, id DESC
         LIMIT 1
       ) evt ON TRUE
       WHERE v.deleted_at IS NULL
         ${publishedFilter}
         AND mc.${urlCol} IS NOT NULL AND btrim(mc.${urlCol}) <> ''
         AND (mc.${statusCol} <> 'ok' OR evt.event_type IS NOT NULL)
     )
     SELECT
       base.video_id, base.catalog_id, base.title, base.is_published,
       base.image_url, base.status, base.source, base.event_type,
       base.occurrence_count, base.last_seen_at::text AS last_seen_broken_at,
       CASE
         WHEN base.event_type IS NOT NULL THEN 'broken_event'
         WHEN base.status = 'broken'         THEN 'broken'
         WHEN base.status = 'low_quality'    THEN 'low_quality'
         WHEN base.status = 'pending_review' THEN 'pending_review'
         ELSE 'other'
       END AS problem_reason,
       CASE WHEN base.evt_url IS NOT NULL
         THEN regexp_replace(base.evt_url, '^https?://([^/]+).*', '\\1')
         ELSE NULL
       END AS broken_domain
     FROM base
     ORDER BY
       CASE
         WHEN base.event_type IS NOT NULL THEN 1
         WHEN base.status = 'broken'         THEN 2
         WHEN base.status = 'low_quality'    THEN 3
         WHEN base.status = 'pending_review' THEN 4
         ELSE 5
       END,
       base.last_seen_at DESC NULLS LAST,
       base.video_id
     LIMIT $3 OFFSET $4`,
    [kind, [...BROKEN_SAMPLE_EVENT_TYPES], limit, offset],
  )

  return result.rows.map(r => ({
    videoId: r.video_id,
    catalogId: r.catalog_id,
    title: r.title,
    isPublished: r.is_published,
    kind,
    imageUrl: r.image_url,
    status: r.status,
    problemReason: r.problem_reason,
    source: r.source,
    eventType: r.event_type,
    brokenDomain: r.broken_domain,
    occurrenceCount: r.occurrence_count ?? 0,
    lastSeenBrokenAt: r.last_seen_broken_at,
  }))
}

/**
 * ADR-211 D-211-4：4 类问题图片计数（tab badge + 当前 kind 的 total）。
 * 每 kind 一个 COUNT FILTER，谓词与 getProblemImages 共用 problemFilterSql（确保 total 一致）。
 * **per-video 计数**（arch-reviewer 风险 2）：与 getProblemImages 一致按 video 行计，N 个 video 共享
 * 同一问题 catalog 时各计一次（对齐 recent-broken-samples DISTINCT ON video_id 的 per-video 范式）；
 * 4B「加载更多」按 videoId+kind 去重即与此一致，非按 catalog 去重。
 */
export async function getProblemImageCounts(
  db: Pool,
  scope: ProblemImageScope,
): Promise<ProblemImageCounts> {
  const publishedFilter = scope === 'published' ? 'AND v.is_published = true' : ''
  const result = await db.query<{
    poster: number; backdrop: number; logo: number; banner_backdrop: number
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE ${problemFilterSql('poster', '$1')})::int          AS poster,
       COUNT(*) FILTER (WHERE ${problemFilterSql('backdrop', '$1')})::int        AS backdrop,
       COUNT(*) FILTER (WHERE ${problemFilterSql('logo', '$1')})::int            AS logo,
       COUNT(*) FILTER (WHERE ${problemFilterSql('banner_backdrop', '$1')})::int AS banner_backdrop
     FROM videos v
     JOIN media_catalog mc ON mc.id = v.catalog_id
     WHERE v.deleted_at IS NULL ${publishedFilter}`,
    [[...BROKEN_SAMPLE_EVENT_TYPES]],
  )
  const row = result.rows[0]
  return {
    poster:          row?.poster ?? 0,
    backdrop:        row?.backdrop ?? 0,
    logo:            row?.logo ?? 0,
    banner_backdrop: row?.banner_backdrop ?? 0,
  }
}

// ── 运营 Action：重扫封面 + 切换 fallback 域（ADR-135）────────────

export type RescanScope = 'all' | 'broken_only' | 'missing_only'

export interface RescanPostersResult {
  updatedCount: number
}

/**
 * 将指定 scope 的 poster_status 重置为 pending_review，供 backfill worker 重新入队。
 * 'broken_only' → 仅 broken；'missing_only' → 仅 missing；'all' → broken + missing。
 * 不重置已为 pending_review 或 ok 的记录。
 */
export async function rescanPosters(
  db: Pool,
  scope: RescanScope = 'broken_only',
): Promise<RescanPostersResult> {
  const statusFilter: string[] =
    scope === 'broken_only'  ? ['broken'] :
    scope === 'missing_only' ? ['missing'] :
    ['broken', 'missing']

  const result = await db.query(
    `UPDATE media_catalog
     SET poster_status = 'pending_review', updated_at = NOW()
     WHERE poster_status = ANY($1::text[])
       AND cover_url IS NOT NULL`,
    [statusFilter],
  )
  return { updatedCount: result.rowCount ?? 0 }
}

export interface SwitchFallbackDomainResult {
  dryRun: boolean
  affectedRows: number
  affectedColumns: number
  breakdown: {
    cover_url: number
    backdrop_url: number
    banner_backdrop_url: number
  }
}

/**
 * 批量替换 media_catalog 三列中的 CDN 域名。
 * 使用 '://' || domain || '/' 精确匹配，避免子域或部分域名误替换。
 * dryRun=true：仅 COUNT，不写入；dryRun=false：执行 UPDATE。
 */
export async function switchFallbackDomain(
  db: Pool,
  fromDomain: string,
  toDomain: string,
  dryRun: boolean,
): Promise<SwitchFallbackDomainResult> {
  const countResult = await db.query<{
    total_rows: string
    cover_url_count: string
    backdrop_url_count: string
    banner_backdrop_url_count: string
  }>(
    `SELECT
       COUNT(*) FILTER (
         WHERE strpos(cover_url, '://' || $1 || '/') > 0
            OR strpos(backdrop_url, '://' || $1 || '/') > 0
            OR strpos(banner_backdrop_url, '://' || $1 || '/') > 0
       )::int AS total_rows,
       COUNT(*) FILTER (WHERE strpos(cover_url, '://' || $1 || '/') > 0)::int AS cover_url_count,
       COUNT(*) FILTER (WHERE strpos(backdrop_url, '://' || $1 || '/') > 0)::int AS backdrop_url_count,
       COUNT(*) FILTER (WHERE strpos(banner_backdrop_url, '://' || $1 || '/') > 0)::int AS banner_backdrop_url_count
     FROM media_catalog`,
    [fromDomain],
  )

  const row = countResult.rows[0]
  const breakdown = {
    cover_url:          parseInt(row?.cover_url_count ?? '0'),
    backdrop_url:       parseInt(row?.backdrop_url_count ?? '0'),
    banner_backdrop_url: parseInt(row?.banner_backdrop_url_count ?? '0'),
  }
  const affectedRows = parseInt(row?.total_rows ?? '0')
  const affectedColumns = Object.values(breakdown).filter((c) => c > 0).length

  if (!dryRun && affectedRows > 0) {
    await db.query(
      `UPDATE media_catalog
       SET
         cover_url = CASE
           WHEN strpos(cover_url, '://' || $1 || '/') > 0
           THEN REPLACE(cover_url, '://' || $1 || '/', '://' || $2 || '/')
           ELSE cover_url
         END,
         backdrop_url = CASE
           WHEN strpos(backdrop_url, '://' || $1 || '/') > 0
           THEN REPLACE(backdrop_url, '://' || $1 || '/', '://' || $2 || '/')
           ELSE backdrop_url
         END,
         banner_backdrop_url = CASE
           WHEN strpos(banner_backdrop_url, '://' || $1 || '/') > 0
           THEN REPLACE(banner_backdrop_url, '://' || $1 || '/', '://' || $2 || '/')
           ELSE banner_backdrop_url
         END,
         updated_at = NOW()
       WHERE strpos(cover_url, '://' || $1 || '/') > 0
          OR strpos(backdrop_url, '://' || $1 || '/') > 0
          OR strpos(banner_backdrop_url, '://' || $1 || '/') > 0`,
      [fromDomain, toDomain],
    )
  }

  return { dryRun, affectedRows, affectedColumns, breakdown }
}

/**
 * 标记未解决事件为已处理，返回实际更新行数（resolvedCount）。
 * ADR-209 D-209-2：原返 void → 改返 rowCount，供 response/审计载荷一致。
 * **幂等硬约束**（Codex stop-time review 修正）：WHERE 含 `resolved_at IS NULL` →
 *   已解决事件被排除、不重复 UPDATE（不覆盖既有 resolved_at 时间戳 / resolution_note）、不计入 rowCount。
 *   故重复调用 resolvedCount=0（= 事件不存在或已解决），route 据此幂等不报 404。
 */
export async function resolveImageEvents(
  db: Pool | PoolClient,
  ids: string[],
  note?: string
): Promise<number> {
  if (ids.length === 0) return 0
  const result = await db.query(
    `UPDATE broken_image_events
     SET resolved_at = NOW(), resolution_note = $1
     WHERE id = ANY($2::uuid[])
       AND resolved_at IS NULL`,
    [note ?? null, ids]
  )
  return result.rowCount ?? 0
}

/**
 * ADR-209 D-209-3：将 videoIds 解析为去重 catalog_id 列表（软删除/无 catalog 的剔除）。
 * 供 ids 精确重扫 scoped 闭环——禁全局副作用。
 */
export async function getCatalogIdsByVideoIds(
  db: Pool | PoolClient,
  videoIds: string[],
): Promise<string[]> {
  if (videoIds.length === 0) return []
  const result = await db.query<{ catalog_id: string }>(
    `SELECT DISTINCT catalog_id
       FROM videos
      WHERE id = ANY($1::uuid[])
        AND catalog_id IS NOT NULL
        AND deleted_at IS NULL`,
    [videoIds],
  )
  return result.rows.map(r => r.catalog_id)
}

/**
 * ADR-209 D-209-3：对选中 catalog 集 scoped 重置 poster_status=pending_review。
 * 镜像 rescanPosters 的 `cover_url IS NOT NULL` 守卫，仅 WHERE 由 scope 改为 id 集；
 * 纯 missing（cover_url IS NULL）行被守卫跳过、不计 updatedCount（UI 据此反馈"N 行无可重扫 URL"）。
 */
export async function rescanPostersByCatalogIds(
  db: Pool | PoolClient,
  catalogIds: string[],
): Promise<RescanPostersResult> {
  if (catalogIds.length === 0) return { updatedCount: 0 }
  const result = await db.query(
    `UPDATE media_catalog
     SET poster_status = 'pending_review', updated_at = NOW()
     WHERE id = ANY($1::uuid[])
       AND cover_url IS NOT NULL`,
    [catalogIds],
  )
  return { updatedCount: result.rowCount ?? 0 }
}
