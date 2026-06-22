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
const PROBLEM_KIND_COLS: Record<
  ProblemImageKind,
  { url: string; status: string; checkedAt: string; clientErrorAt: string }
> = {
  poster:          { url: 'cover_url',           status: 'poster_status',          checkedAt: 'poster_checked_at',          clientErrorAt: 'poster_client_error_at' },
  backdrop:        { url: 'backdrop_url',        status: 'backdrop_status',        checkedAt: 'backdrop_checked_at',        clientErrorAt: 'backdrop_client_error_at' },
  logo:            { url: 'logo_url',            status: 'logo_status',            checkedAt: 'logo_checked_at',            clientErrorAt: 'logo_client_error_at' },
  banner_backdrop: { url: 'banner_backdrop_url', status: 'banner_backdrop_status', checkedAt: 'banner_backdrop_checked_at', clientErrorAt: 'banner_backdrop_client_error_at' },
}

/**
 * problemReason：UI 分色 + 默认排序优先级（ADR-213 D-213-7，client_error 最先展示）。
 * 方案 C dissolve：`broken_event`→`client_error`（浏览器自过期信号驱动，非 events）；新增 `unknown`
 *（status='ok' 但 checked_at 陈旧/NULL，stale-ok 兜底面，A-SCAN 后由 IMAGE_HEALTH_STALE_OK_ENABLED 开启）。
 */
export type ProblemReason =
  | 'client_error'
  | 'broken'
  | 'low_quality'
  | 'pending_review'
  | 'unknown'
  | 'other'

/**
 * reason 子筛选值（板 UI 口径 → 服务端过滤，IMGH-P4-REASON-SSF）：'all' 不过滤；'broken'=真破损（client_error∪broken）；
 * 其余 1:1 映射 problemReason。**服务端过滤**取代客户端 `rows.filter`——后者仅过滤已加载页 → 沉在加载窗口外的
 * reason（如 A 排序后 low_quality）点筛选假空（Codex stop-gate）。
 */
export type ProblemReasonFilter = 'all' | 'broken' | 'unknown' | 'low_quality' | 'pending_review'

const REASON_FILTER_MAP: Record<Exclude<ProblemReasonFilter, 'all'>, readonly ProblemReason[]> = {
  broken: ['client_error', 'broken'],
  unknown: ['unknown'],
  low_quality: ['low_quality'],
  pending_review: ['pending_review'],
}

export interface ProblemImagesPage {
  rows: ProblemImageRow[]
  /** 过滤后真总数（COUNT(*) OVER()，含 reason 过滤）→ hasMore 准确，不受分页影响 */
  total: number
}

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
 * stale-ok（unknown）面开关：默认 OFF。该道依赖 `checked_at` 已由部署期 A-SCAN 落真值——A-SCAN 跑前
 * 存量 ok 行 checked_at 全 NULL，若开启会让全部健康 ok 行误判 unknown 泛滥（ADR-213 Codex round-4 红线）。
 * 故 stale-ok 道用本 flag 门控，A-SCAN 排空后由运维置 IMAGE_HEALTH_STALE_OK_ENABLED=true 开启；其余 P4-C
 * 改动（events 退出读路径 + client_error 窗口 + 分色）不依赖 checked_at，立即生效（核心误报上线即消失）。
 */
function staleOkEnabled(): boolean {
  return process.env.IMAGE_HEALTH_STALE_OK_ENABLED === 'true'
}

/**
 * 单 kind 的「问题图片」WHERE 单一真源谓词（ADR-213 D-213-7，方案 C dissolve）：
 *   `<kind>_url 非空非空白 AND ( status<>'ok'                                    -- ① 当前态非 ok
 *                              OR client_error_at 在 7d 窗口                      -- ② 浏览器自过期信号
 *                              [OR (status='ok' AND checked_at 早于 STALE_CHECK_DAYS)] )  -- ③ stale-ok（flag 门控）`
 * **健康判定不再读 broken_image_events**（events 降级纯遥测）。列名/kind 字面量均来自 PROBLEM_KIND_COLS /
 * 模块常量（CLIENT_ERROR_WINDOW_DAYS/STALE_CHECK_DAYS），非请求输入（防注入）。
 * **counts 与 list 逐字共用本函数**（ADR-209 §17.3.2 total 不漂移红线）；includeStaleOk 两路必须取同值。
 */
function problemFilterSqlV2(kind: ProblemImageKind, includeStaleOk: boolean): string {
  const { url, status, checkedAt, clientErrorAt } = PROBLEM_KIND_COLS[kind]
  const staleOkClause = includeStaleOk
    ? ` OR (mc.${status} = 'ok' AND COALESCE(mc.${checkedAt}, '-infinity'::timestamptz) < NOW() - INTERVAL '${STALE_CHECK_DAYS} days')`
    : ''
  return `mc.${url} IS NOT NULL AND btrim(mc.${url}) <> '' AND (
    mc.${status} <> 'ok'
    OR mc.${clientErrorAt} >= NOW() - INTERVAL '${CLIENT_ERROR_WINDOW_DAYS} days'${staleOkClause}
  )`
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
  reasonFilter: ProblemReasonFilter = 'all',
): Promise<ProblemImagesPage> {
  const { url: urlCol, status: statusCol, checkedAt: checkedCol, clientErrorAt: clientErrorCol } =
    PROBLEM_KIND_COLS[kind]
  const publishedFilter = scope === 'published' ? 'AND v.is_published = true' : ''
  const sourceExpr = kind === 'poster' ? 'mc.poster_source' : 'NULL::text'
  const includeStaleOk = staleOkEnabled()
  // 服务端 reason 过滤：null=全部不过滤；否则限定 problem_reason ∈ 集合（外层 WHERE，对 base 算好的 reason 过滤）
  const reasons = reasonFilter === 'all' ? null : [...REASON_FILTER_MAP[reasonFilter]]

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
    full_count: number
  }>(
    // ADR-213 D-213-7：健康判定单真源（status + client_error_at[ + stale-ok]），**events 退出 WHERE**；
    // LATERAL 仅留作纯遥测展示（broken_domain/原因/次数），LEFT JOIN 不影响命中。problem_reason 在 base 算一次、ORDER BY 复用。
    `WITH base AS (
       SELECT
         v.id AS video_id, v.catalog_id, v.title, v.is_published,
         mc.${urlCol} AS image_url, mc.${statusCol} AS status, ${sourceExpr} AS source,
         evt.event_type, evt.url AS evt_url, evt.occurrence_count, evt.last_seen_at,
         CASE
           WHEN mc.${clientErrorCol} >= NOW() - INTERVAL '${CLIENT_ERROR_WINDOW_DAYS} days' THEN 'client_error'
           WHEN mc.${statusCol} = 'broken'         THEN 'broken'
           WHEN mc.${statusCol} = 'low_quality'    THEN 'low_quality'
           WHEN mc.${statusCol} = 'pending_review' THEN 'pending_review'
           WHEN mc.${statusCol} = 'ok' AND COALESCE(mc.${checkedCol}, '-infinity'::timestamptz) < NOW() - INTERVAL '${STALE_CHECK_DAYS} days' THEN 'unknown'
           ELSE 'other'
         END AS problem_reason
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
         AND ${problemFilterSqlV2(kind, includeStaleOk)}
     )
     SELECT
       base.video_id, base.catalog_id, base.title, base.is_published,
       base.image_url, base.status, base.source, base.event_type,
       base.occurrence_count, base.last_seen_at::text AS last_seen_broken_at,
       base.problem_reason,
       CASE WHEN base.evt_url IS NOT NULL
         THEN regexp_replace(base.evt_url, '^https?://([^/]+).*', '\\1')
         ELSE NULL
       END AS broken_domain,
       COUNT(*) OVER()::int AS full_count  -- 过滤后真总数（在 LIMIT 前算）→ hasMore 准确
     FROM base
     -- reason 子筛选服务端化（$5 NULL=全部）：对 base 算好的 problem_reason 过滤，任何 reason 精确命中、不受分页/排序影响
     WHERE ($5::text[] IS NULL OR base.problem_reason = ANY($5::text[]))
     ORDER BY
       -- 可操作项优先（client_error/broken/unknown 浮顶）；low_quality（能加载、仅尺寸小）最不紧急 → 沉底，
       -- 避免大量 low_quality 把 broken/unknown 埋到末页（A-SCAN 后实测 low_quality 占 ~85%，IMGH-P4-BOARD-UX）。
       CASE base.problem_reason
         WHEN 'client_error'   THEN 1
         WHEN 'broken'         THEN 2
         WHEN 'unknown'        THEN 3
         WHEN 'pending_review' THEN 4
         WHEN 'low_quality'    THEN 5
         ELSE 6
       END,
       base.last_seen_at DESC NULLS LAST,
       base.video_id
     LIMIT $3 OFFSET $4`,
    [kind, [...BROKEN_SAMPLE_EVENT_TYPES], limit, offset, reasons],
  )

  return {
    rows: result.rows.map(r => ({
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
    })),
    total: result.rows[0]?.full_count ?? 0,
  }
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
  const includeStaleOk = staleOkEnabled() // 与 getProblemImages 同源（同一 env 读）→ total 不漂移
  const result = await db.query<{
    poster: number; backdrop: number; logo: number; banner_backdrop: number
  }>(
    // counts 与 list 逐字共用 problemFilterSqlV2（ADR-209 §17.3.2 total 不漂移红线）；谓词无 events、无参数。
    `SELECT
       COUNT(*) FILTER (WHERE ${problemFilterSqlV2('poster', includeStaleOk)})::int          AS poster,
       COUNT(*) FILTER (WHERE ${problemFilterSqlV2('backdrop', includeStaleOk)})::int        AS backdrop,
       COUNT(*) FILTER (WHERE ${problemFilterSqlV2('logo', includeStaleOk)})::int            AS logo,
       COUNT(*) FILTER (WHERE ${problemFilterSqlV2('banner_backdrop', includeStaleOk)})::int AS banner_backdrop
     FROM videos v
     JOIN media_catalog mc ON mc.id = v.catalog_id
     WHERE v.deleted_at IS NULL ${publishedFilter}`,
    [],
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
