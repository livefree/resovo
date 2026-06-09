/**
 * moderation.ts — 审核台专用 DB 查询
 * UX-13: listModerationHistory（已审核视频历史记录）
 * CHG-SN-4-05: listPendingQueue（pending-queue cursor 分页）
 */

import type { Pool } from 'pg'
import { deriveAggregateState } from '@resovo/types'
import type { DoubanStatus, BangumiStatus, SourceCheckStatus, VideoMetaQuality } from '@resovo/types'
// META-12-A / ADR-170 AMENDMENT：复用 admin 路径同一投影逻辑（单一真源，禁止异源重复实现）
import { buildEnrichmentSummary } from './videos.internal'

export interface ModerationHistoryRow {
  id: string
  title: string
  type: string
  year: number | null
  cover_url: string | null
  review_status: string
  reviewed_at: string | null
  reviewed_by: string | null
  review_reason: string | null
  douban_status: string
  source_check_status: string
  meta_score: number
  created_at: string
}

export interface ModerationHistoryFilters {
  result?: 'approved' | 'rejected'
  type?: string
  sortDir?: 'asc' | 'desc'
  page: number
  limit: number
}

export async function listModerationHistory(
  db: Pool,
  filters: ModerationHistoryFilters
): Promise<{ rows: ModerationHistoryRow[]; total: number }> {
  const conditions: string[] = [
    `v.deleted_at IS NULL`,
    `v.review_status IN ('approved', 'rejected')`,
  ]
  const params: unknown[] = []
  let idx = 1

  if (filters.result) {
    conditions.push(`v.review_status = $${idx++}`)
    params.push(filters.result)
  }

  if (filters.type) {
    conditions.push(`v.type = $${idx++}`)
    params.push(filters.type)
  }

  const where = conditions.join(' AND ')
  const orderByDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC'
  const offset = (filters.page - 1) * filters.limit

  const [rows, countResult] = await Promise.all([
    db.query<ModerationHistoryRow>(
      `SELECT v.id, v.title, v.type, mc.year, mc.cover_url,
              v.review_status, v.reviewed_at, v.reviewed_by, v.review_reason,
              v.douban_status, v.source_check_status, v.meta_score, v.created_at
       FROM videos v
       JOIN media_catalog mc ON mc.id = v.catalog_id
       WHERE ${where}
       ORDER BY COALESCE(v.reviewed_at, v.updated_at) ${orderByDir}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*)
       FROM videos v
       JOIN media_catalog mc ON mc.id = v.catalog_id
       WHERE ${where}`,
      params
    ),
  ])

  return {
    rows: rows.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}

// ── pending-queue (CHG-SN-4-05) ───────────────────────────────────────────────

export interface PendingQueueFilters {
  cursor?: string
  limit?: number
  type?: string
  sourceCheckStatus?: string
  doubanStatus?: string
  hasStaffNote?: boolean
  needsManualReview?: boolean
  /** CHG-350：title ILIKE 模糊搜索 — trim 后 ≤ 200 字符 */
  q?: string
}

// CHG-SN-4-09d hotfix（2026-05-02）：响应字段统一 camelCase（PG 双引号 alias 保留大小写）。
//   原 snake_case 与前端 VideoQueueRow camelCase 契约不匹配，导致 v.coverUrl 等字段
//   运行时 undefined（同 09b/09c 同类前后端契约不一致）。
interface DbPendingQueueRow {
  id: string
  // ADR-160 D-160-7：admin preview URL 派生（getVideoDetailHref({ type, slug, shortId })）
  slug: string | null
  shortId: string
  title: string
  type: string
  year: number | null
  country: string | null
  episodeCount: number
  totalEpisodes: number | null    // Migration 078 / ADR-163 / CHG-367-B-A（作品总集数 / NULL=未取到）
  currentEpisodes: number | null  // Migration 078 / ADR-163 / CHG-367-B-A（已播集数 / NULL=未取到）
  coverUrl: string | null
  rating: number | null
  category: string | null
  isPublished: boolean
  visibilityStatus: string
  reviewStatus: string
  reviewReason: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  probe: string
  render: string
  // CHG-360-B / ADR-159：line-level X/Y 聚合原料字段（SQL 投影直接产出，Service/query 层派生 state）
  probeAggregateTotal: number | string  // pg 可能返回 string（DISTINCT COUNT）
  probeAggregateOk: number | string
  renderAggregateTotal: number | string
  renderAggregateOk: number | string
  sourceCheckStatus: string
  metaScore: number
  needsManualReview: boolean
  badges: string[] | null
  staffNote: string | null
  reviewLabelKey: string | null
  doubanStatus: string
  reviewSource: string
  trendingTag: string | null
  createdAt: string
  updatedAt: string
  // META-12-A / ADR-170 AMENDMENT：enrichmentSummary 输入源（仅 query 内部用，
  // mapper 派生后 destructure 剔除 → 不入 VideoQueueRow 响应，防 raw meta_quality JSON 泄漏）
  bangumiStatus?: BangumiStatus
  metaQuality?: VideoMetaQuality | null
  bangumiSubjectId?: number | null
  // META-14-B / ADR-172 AMENDMENT 2：外部源 ID 输入源（同上 destructure 剔除）
  doubanId?: string | null
  tmdbId?: number | null
  imdbId?: string | null
}

interface CursorPayload {
  createdAt: string
  id: string
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as CursorPayload
  } catch {
    return null
  }
}

export async function listPendingQueue(
  db: Pool,
  filters: PendingQueueFilters,
  actorId: string,
): Promise<{
  data: DbPendingQueueRow[]
  nextCursor: string | null
  total: number
  todayStats: { reviewed: number; approveRate: number | null }
}> {
  const limit = Math.min(filters.limit ?? 30, 50)
  const conditions: string[] = [
    `v.deleted_at IS NULL`,
    `v.review_status = 'pending_review'`,
  ]
  const params: unknown[] = []
  let idx = 1

  if (filters.type) {
    conditions.push(`v.type = $${idx++}`)
    params.push(filters.type)
  }
  if (filters.sourceCheckStatus) {
    conditions.push(`v.source_check_status = $${idx++}`)
    params.push(filters.sourceCheckStatus)
  }
  if (filters.doubanStatus) {
    conditions.push(`v.douban_status = $${idx++}`)
    params.push(filters.doubanStatus)
  }
  if (filters.hasStaffNote === true) {
    conditions.push(`v.staff_note IS NOT NULL`)
  } else if (filters.hasStaffNote === false) {
    conditions.push(`v.staff_note IS NULL`)
  }
  if (filters.needsManualReview === true) {
    conditions.push(`v.needs_manual_review = true`)
  }
  // CHG-350：title ILIKE 模糊搜索（trim 后非空才参与；% 用 LIKE escape 防 SQL 通配符注入）
  if (filters.q) {
    const trimmed = filters.q.trim()
    if (trimmed) {
      const escaped = trimmed.replace(/[\\%_]/g, ch => `\\${ch}`)
      conditions.push(`v.title ILIKE $${idx++}`)
      params.push(`%${escaped}%`)
    }
  }

  let cursorCond = ''
  if (filters.cursor) {
    const decoded = decodeCursor(filters.cursor)
    if (decoded) {
      cursorCond = ` AND (v.created_at < $${idx} OR (v.created_at = $${idx} AND v.id < $${idx + 1}))`
      params.push(decoded.createdAt, decoded.id)
      idx += 2
    }
  }

  const where = conditions.join(' AND ')

  const [rows, countResult, todayResult] = await Promise.all([
    db.query<DbPendingQueueRow>(
      // CHG-SN-4-09d hotfix：snake_case → camelCase alias（前端 VideoQueueRow 契约）
      `SELECT v.id, v.slug AS "slug", v.short_id AS "shortId",
              v.title, v.type, mc.year, mc.country,
              v.episode_count AS "episodeCount",
              v.total_episodes AS "totalEpisodes",
              v.current_episodes AS "currentEpisodes",
              mc.cover_url AS "coverUrl",
              mc.rating,
              v.source_category AS category,
              v.is_published AS "isPublished",
              v.visibility_status AS "visibilityStatus",
              v.review_status AS "reviewStatus",
              v.review_reason AS "reviewReason",
              v.reviewed_by AS "reviewedBy",
              v.reviewed_at AS "reviewedAt",
              COALESCE(
                -- CHG-359: 去掉 is_active=true 限制 — inactive 但 dead 的 source 也应反映在 pill
                (SELECT probe_status FROM video_sources
                 WHERE video_id = v.id AND deleted_at IS NULL
                 ORDER BY CASE probe_status WHEN 'dead' THEN 0 WHEN 'partial' THEN 1
                           WHEN 'pending' THEN 2 ELSE 3 END LIMIT 1),
                'pending'
              ) AS probe,
              COALESCE(
                (SELECT render_status FROM video_sources
                 WHERE video_id = v.id AND deleted_at IS NULL
                 ORDER BY CASE render_status WHEN 'dead' THEN 0 WHEN 'partial' THEN 1
                           WHEN 'pending' THEN 2 ELSE 3 END LIMIT 1),
                'pending'
              ) AS render,
              -- CHG-360-B / ADR-159 D-159-2 + D-159-7：按 DISTINCT (siteKey, sourceName) 线路 count
              -- 仅产 {total, ok} 原料 / state 由 mapPendingQueueRow 派生（deriveAggregateState helper）
              COALESCE((
                SELECT COUNT(DISTINCT (vs.source_site_key, vs.source_name))
                FROM video_sources vs
                WHERE vs.video_id = v.id AND vs.deleted_at IS NULL
              ), 0) AS "probeAggregateTotal",
              COALESCE((
                SELECT COUNT(DISTINCT (vs.source_site_key, vs.source_name))
                FROM video_sources vs
                WHERE vs.video_id = v.id AND vs.deleted_at IS NULL
                  AND EXISTS (
                    SELECT 1 FROM video_sources vs2
                    WHERE vs2.video_id = vs.video_id
                      AND vs2.source_site_key IS NOT DISTINCT FROM vs.source_site_key
                      AND vs2.source_name = vs.source_name
                      AND vs2.probe_status = 'ok'
                      AND vs2.deleted_at IS NULL
                  )
              ), 0) AS "probeAggregateOk",
              COALESCE((
                SELECT COUNT(DISTINCT (vs.source_site_key, vs.source_name))
                FROM video_sources vs
                WHERE vs.video_id = v.id AND vs.deleted_at IS NULL
              ), 0) AS "renderAggregateTotal",
              COALESCE((
                SELECT COUNT(DISTINCT (vs.source_site_key, vs.source_name))
                FROM video_sources vs
                WHERE vs.video_id = v.id AND vs.deleted_at IS NULL
                  AND EXISTS (
                    SELECT 1 FROM video_sources vs2
                    WHERE vs2.video_id = vs.video_id
                      AND vs2.source_site_key IS NOT DISTINCT FROM vs.source_site_key
                      AND vs2.source_name = vs.source_name
                      AND vs2.render_status = 'ok'
                      AND vs2.deleted_at IS NULL
                  )
              ), 0) AS "renderAggregateOk",
              v.source_check_status AS "sourceCheckStatus",
              v.meta_score AS "metaScore",
              v.needs_manual_review AS "needsManualReview",
              ARRAY[]::text[] AS badges,
              v.staff_note AS "staffNote",
              v.review_label_key AS "reviewLabelKey",
              v.douban_status AS "doubanStatus",
              -- META-12-A：enrichmentSummary 派生输入源（bangumi_status + meta_quality JSON + mc.bangumi_subject_id）
              v.bangumi_status AS "bangumiStatus",
              v.meta_quality AS "metaQuality",
              mc.bangumi_subject_id AS "bangumiSubjectId",
              -- META-14-B：外部源 ID（logo state 推导 + href）
              mc.douban_id AS "doubanId",
              mc.tmdb_id AS "tmdbId",
              mc.imdb_id AS "imdbId",
              COALESCE(v.review_source, 'manual') AS "reviewSource",
              v.trending_tag AS "trendingTag",
              v.created_at AS "createdAt",
              v.updated_at AS "updatedAt"
       FROM videos v
       JOIN media_catalog mc ON mc.id = v.catalog_id
       WHERE ${where}${cursorCond}
       ORDER BY v.created_at DESC, v.id DESC
       LIMIT $${idx}`,
      [...params, limit + 1],
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) FROM videos v WHERE ${where}`,
      params.slice(0, idx - (filters.cursor ? 3 : 1)),
    ),
    db.query<{ reviewed: string; approved: string }>(
      `SELECT COUNT(*) AS reviewed,
              COUNT(*) FILTER (WHERE action_type = 'video.approve') AS approved
       FROM admin_audit_log
       WHERE actor_id = $1
         AND action_type IN ('video.approve', 'video.reject_labeled')
         AND created_at >= NOW()::date`,
      [actorId],
    ),
  ])

  const hasNext = rows.rows.length > limit
  const rawData = hasNext ? rows.rows.slice(0, limit) : rows.rows
  // CHG-360-B / ADR-159 D-159-7：query 层 map raw count → DualSignalAggregate object
  //   pg COUNT(*) 返回 string，需要 parseInt；deriveAggregateState 跨前后端复用 helper
  const data = rawData.map((row) => {
    const probeTotal = typeof row.probeAggregateTotal === 'string' ? parseInt(row.probeAggregateTotal, 10) : row.probeAggregateTotal
    const probeOk = typeof row.probeAggregateOk === 'string' ? parseInt(row.probeAggregateOk, 10) : row.probeAggregateOk
    const renderTotal = typeof row.renderAggregateTotal === 'string' ? parseInt(row.renderAggregateTotal, 10) : row.renderAggregateTotal
    const renderOk = typeof row.renderAggregateOk === 'string' ? parseInt(row.renderAggregateOk, 10) : row.renderAggregateOk
    // META-12-A：destructure 剔除 3 个 raw 输入源（不入响应 / 防 meta_quality JSON 泄漏），
    // 经 buildEnrichmentSummary（admin 同源投影）派生 enrichmentSummary（ADR-170 AMENDMENT）
    const { metaQuality, bangumiStatus, bangumiSubjectId, doubanId, tmdbId, imdbId, ...rest } = row
    return {
      ...rest,
      probeAggregate: { total: probeTotal, ok: probeOk, state: deriveAggregateState(probeOk, probeTotal) },
      renderAggregate: { total: renderTotal, ok: renderOk, state: deriveAggregateState(renderOk, renderTotal) },
      enrichmentSummary: buildEnrichmentSummary({
        douban_status: rest.doubanStatus as DoubanStatus,
        bangumi_status: bangumiStatus ?? null,
        source_check_status: rest.sourceCheckStatus as SourceCheckStatus,
        meta_score: rest.metaScore,
        meta_quality: metaQuality ?? null,
        bangumi_subject_id: bangumiSubjectId ?? null,
        douban_id: doubanId ?? null,
        tmdb_id: tmdbId ?? null,
        imdb_id: imdbId ?? null,
      }),
    }
  })
  const last = data[data.length - 1]
  const nextCursor = hasNext && last
    ? encodeCursor({ createdAt: last.createdAt, id: last.id })
    : null

  const todayRow = todayResult.rows[0]
  const reviewed = parseInt(todayRow?.reviewed ?? '0')
  const approved = parseInt(todayRow?.approved ?? '0')
  const approveRate = reviewed > 0 ? approved / reviewed : null

  return {
    data,
    nextCursor,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
    todayStats: { reviewed, approveRate },
  }
}

// ── CHG-SN-8-04-EP · ADR-137 类似视频召回 query ──────────────────

export interface VideoFeatures {
  readonly id: string
  readonly type: string
  readonly year: number | null
  readonly country: string | null
  readonly genres: readonly string[]
}

/**
 * findVideoFeatures：查目标视频特征用于相似度计算（ADR-137 §9 Service 层先 lookup）
 * - 返回 null 时 Service 层抛 NOT_FOUND
 * - JOIN media_catalog 获取 year/country/genres（migration 029 后字段位置）
 */
export async function findVideoFeatures(
  db: Pool,
  id: string,
): Promise<VideoFeatures | null> {
  const sql = `
    SELECT
      v.id,
      v.type,
      mc.year,
      mc.country,
      COALESCE(mc.genres, ARRAY[]::text[]) AS genres
    FROM videos v
    LEFT JOIN media_catalog mc ON mc.id = v.catalog_id
    WHERE v.id = $1 AND v.deleted_at IS NULL
    LIMIT 1
  `
  const result = await db.query(sql, [id])
  const row = result.rows[0]
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    year: row.year == null ? null : Number(row.year),
    country: row.country ?? null,
    genres: Array.isArray(row.genres) ? row.genres : [],
  }
}

export interface SimilarCandidateRow {
  readonly id: string
  readonly title: string
  readonly type: string
  readonly year: number | null
  readonly country: string | null
  readonly genres: readonly string[]
  readonly cover_url: string | null
  readonly meta_score: number
  readonly review_status: string
  readonly is_published: boolean
}

export interface SimilarCandidatesQuery {
  readonly excludeId: string
  readonly type: string
  readonly year: number | null
  readonly yearRange: number
  /** 粗筛上限，默认 50（ADR-137 §5 性能保底）*/
  readonly limit?: number
  /** ADR-137 N1 fallback：true 时去除 type 严格相等条件，允许跨类型召回（CHG-SN-8-04-N1）*/
  readonly relaxType?: boolean
  /** ADR-137 N1 fallback：额外排除的 video ids（避免与首次 strict 查询结果重复）*/
  readonly excludeIds?: readonly string[]
}

/**
 * listSimilarCandidates：SQL 粗筛（ADR-137 §5 SQL 设计 + N1 fallback CHG-SN-8-04-N1）
 * - WHERE: deleted_at IS NULL + 排除自身 + 排除已查过 + [可选 type 严格相等] + year 区间
 * - ORDER: meta_score DESC（启发式高质量优先）
 * - LIMIT: 50（Service 层算 score 截断 top-N）
 */
export async function listSimilarCandidates(
  db: Pool,
  query: SimilarCandidatesQuery,
): Promise<readonly SimilarCandidateRow[]> {
  const relaxType = query.relaxType === true
  const excludeIds = query.excludeIds ?? []
  const params: unknown[] = [
    query.excludeId,
    query.type,
    query.year,
    query.yearRange,
    query.limit ?? 50,
  ]
  // $6+: excludeIds 数组展开（如有）
  const excludeListClause = excludeIds.length > 0
    ? `AND v.id != ALL($6::uuid[])`
    : ''
  if (excludeIds.length > 0) params.push(excludeIds)

  const typeClause = relaxType ? '' : 'AND v.type = $2'
  // 当 relaxType=true 时 $2 不用于 WHERE 但仍为占位（pg 不允许跳过）— 保留以维持参数索引稳定

  const sql = `
    SELECT
      v.id,
      v.title,
      v.type,
      mc.year,
      mc.country,
      COALESCE(mc.genres, ARRAY[]::text[]) AS genres,
      mc.cover_url,
      v.meta_score,
      v.review_status,
      v.is_published
    FROM videos v
    LEFT JOIN media_catalog mc ON mc.id = v.catalog_id
    WHERE v.deleted_at IS NULL
      AND v.id != $1
      ${typeClause}
      AND ($3::int IS NULL OR mc.year IS NULL OR mc.year BETWEEN $3 - $4 AND $3 + $4)
      ${excludeListClause}
    ORDER BY v.meta_score DESC NULLS LAST
    LIMIT $5
  `
  const result = await db.query(sql, params)
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    year: row.year == null ? null : Number(row.year),
    country: row.country ?? null,
    genres: Array.isArray(row.genres) ? row.genres : [],
    cover_url: row.cover_url ?? null,
    meta_score: Number(row.meta_score ?? 0),
    review_status: row.review_status,
    is_published: Boolean(row.is_published),
  }))
}

// ── 侧边栏 nav 计数（NTLG-P0-1 / ADR-190）────────────────────────────────────

/**
 * countPendingModeration — pending 审核积压轻量 COUNT（侧边栏 badge）。
 * 与 listPendingQueue 主谓词 `review_status='pending_review'` 同口径，但不做其 JOIN/聚合。
 */
export async function countPendingModeration(db: Pool): Promise<number> {
  const r = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM videos WHERE review_status = 'pending_review'`,
  )
  return parseInt(r.rows[0]?.count ?? '0', 10)
}
