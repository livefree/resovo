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

// ── 查询：近期破损样本（ADR-210 D-210，破损样本区数据源）─────────

// ADR-210 D-210-6（用户裁定 2026-06-20）：破损样本仅取「真·加载失败」event_type（图实际打不开）。
// 排除 timeout（worker 300ms HEAD 超时误报，浏览器能正常加载——真库 unresolved poster 最大头 2080
// 视频）+ dimension_too_small/aspect_mismatch（图能加载、仅尺寸/比例不合规，属 low_quality 治理范畴）。
// → 避免「破损样本却能正常预览」的语义错位。
export const BROKEN_SAMPLE_EVENT_TYPES = [
  'client_load_error', 'empty_src', 'fetch_404', 'fetch_5xx', 'decode_fail',
] as const

export interface RecentBrokenSampleRow {
  videoId: string
  catalogId: string
  title: string
  /** 破损事件记录的失效 URL（e.url，即「破损的那张」，非 mc.cover_url 可能已被改） */
  posterUrl: string
  posterSource: string | null
  posterStatus: string
  eventType: string | null
  /** 从 e.url SQL 派生，统一 getTopBrokenDomains 口径 */
  brokenDomain: string
  occurrenceCount: number
  lastSeenBrokenAt: string | null
}

/**
 * 近期破损海报样本（ADR-210）：破损样本区数据源，对齐 broken_image_events 事件流口径
 * （与 KPI / 趋势 / TOP域名同源），取代旧「治理表第一页 + 客户端 poster_status='broken' 过滤」。
 *
 * - 仅未解决（resolved_at IS NULL）+ poster（image_kind='poster'，2:3 海报位 scope，D-210-2）
 * - DISTINCT ON (video_id) 取每视频最近一条事件（D-210-3），避免同封面多事件刷满
 * - 外层按 last_seen_at DESC + LIMIT；已删视频 / 无 catalog 经 JOIN 自动滤除
 */
export async function getRecentBrokenSamples(
  db: Pool,
  limit = 24,
): Promise<RecentBrokenSampleRow[]> {
  const result = await db.query<{
    video_id: string
    catalog_id: string
    title: string
    url: string
    poster_source: string | null
    poster_status: string
    event_type: string | null
    broken_domain: string
    occurrence_count: number | null
    last_seen_broken_at: string | null
  }>(
    `SELECT
       sub.video_id,
       sub.catalog_id,
       sub.title,
       sub.url,
       sub.poster_source,
       sub.poster_status,
       sub.event_type,
       regexp_replace(sub.url, '^https?://([^/]+).*', '\\1') AS broken_domain,
       sub.occurrence_count,
       sub.last_seen_at::text AS last_seen_broken_at
     FROM (
       SELECT DISTINCT ON (e.video_id)
         e.video_id,
         v.catalog_id,
         v.title,
         e.url,
         mc.poster_source,
         mc.poster_status,
         e.event_type,
         e.occurrence_count,
         e.last_seen_at
       FROM broken_image_events e
       JOIN videos v ON v.id = e.video_id AND v.deleted_at IS NULL
       JOIN media_catalog mc ON mc.id = v.catalog_id
       WHERE e.resolved_at IS NULL
         AND e.image_kind = 'poster'
         AND e.event_type = ANY($2::text[])
       ORDER BY e.video_id, e.last_seen_at DESC, e.id DESC
     ) sub
     ORDER BY sub.last_seen_at DESC
     LIMIT $1`,
    [limit, [...BROKEN_SAMPLE_EVENT_TYPES]],
  )
  return result.rows.map(r => ({
    videoId: r.video_id,
    catalogId: r.catalog_id,
    title: r.title,
    posterUrl: r.url,
    posterSource: r.poster_source,
    posterStatus: r.poster_status,
    eventType: r.event_type,
    brokenDomain: r.broken_domain,
    occurrenceCount: r.occurrence_count ?? 0,
    lastSeenBrokenAt: r.last_seen_broken_at,
  }))
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
