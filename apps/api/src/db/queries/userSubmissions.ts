/**
 * userSubmissions.ts — user_submissions 4 类用户投稿 query 层
 * （ADR-124 / CHG-SN-7-REDO-02-B）
 *
 * 表：user_submissions（migration 065）
 * 复合 PK：id（UUID）/ FK：videos / video_sources / users（SET NULL）
 *
 * 职责：
 *   - listUserSubmissions：4 类 + status 过滤 + badges 聚合 + JOIN videos/users/video_sources
 *   - getUserSubmissionById：详情
 *   - markUserSubmissionProcessed：状态机 pending → processed + processed_at/by/reason
 *   - markUserSubmissionRejected：状态机 pending → rejected + processed_at/by/reason
 *   - batchMarkProcessed / batchMarkRejected：批量状态机
 *
 * 业务规则归口 Service 层（不在本文件）：
 *   - 状态机 409 守卫（pending → processed/rejected）— Service 抛 STATE_CONFLICT
 *   - 404 守卫 — Service 检查 RETURNING 0 行
 *   - audit 写入 — Service 调 writeUserSubmissionAction
 */

import type { Pool } from 'pg'
import type {
  UserSubmissionRow,
  UserSubmissionType,
  UserSubmissionStatus,
} from '@resovo/types'

export interface ListUserSubmissionsFilter {
  readonly type?: UserSubmissionType | 'all'
  /**
   * 'processed_or_rejected' 单值（CHG-SN-7-MISC-USER-SUBMISSIONS-PROCESSED-FILTER）：
   * 后端 SQL WHERE 拼 `status IN ('processed', 'rejected')`；
   * 用于 spec §5.13 "已处理" Segment 一次性筛出 / 替代前端客户端 filter / 修复分页失真
   */
  readonly status?: UserSubmissionStatus | 'all' | 'processed_or_rejected'
  readonly page: number
  readonly limit: number
  readonly sortField?: 'created_at' | 'processed_at'
  readonly sortDir?: 'asc' | 'desc'
}

export interface ListUserSubmissionsResult {
  readonly rows: readonly UserSubmissionRow[]
  readonly total: number
  readonly badges: {
    readonly bad_source: number
    readonly wish_list: number
    readonly metadata_correction: number
    readonly processed: number
  }
}

interface DbRow {
  id: string
  type: string
  status: string
  video_id: string | null
  source_id: string | null
  submitted_by: string
  submitted_by_name: string | null
  quote: string
  metadata_jsonb: Record<string, unknown> | null
  video_title: string | null
  video_poster_url: string | null
  source_name: string | null
  source_site_key: string | null
  created_at: string
  processed_at: string | null
  processed_by: string | null
  processed_reason: string | null
}

function fromDbRow(r: DbRow): UserSubmissionRow {
  return {
    id: r.id,
    type: r.type as UserSubmissionType,
    status: r.status as UserSubmissionStatus,
    videoId: r.video_id,
    sourceId: r.source_id,
    submittedBy: r.submitted_by,
    submittedByName: r.submitted_by_name,
    quote: r.quote,
    metadata: r.metadata_jsonb,
    videoTitle: r.video_title,
    videoPosterUrl: r.video_poster_url,
    sourceName: r.source_name,
    sourceSiteKey: r.source_site_key,
    createdAt: r.created_at,
    processedAt: r.processed_at,
    processedBy: r.processed_by,
    processedReason: r.processed_reason,
  }
}

const VALID_SORT_FIELDS: Record<string, string> = {
  created_at: 'us.created_at',
  processed_at: 'us.processed_at',
}

/**
 * 4 类 + status 过滤 + badges 聚合（D-124-1 / spec §5.13 4 Segment）。
 * type='all' / status='all' 表示不过滤。
 * processed Segment = status IN (processed, rejected) 全量（不区分 type）。
 */
export async function listUserSubmissions(
  db: Pool,
  filter: ListUserSubmissionsFilter,
): Promise<ListUserSubmissionsResult> {
  const { type, status, page, limit, sortField, sortDir } = filter
  const offset = (page - 1) * limit
  const orderCol = (sortField && VALID_SORT_FIELDS[sortField]) ?? 'us.created_at'
  const orderDir = sortDir === 'asc' ? 'ASC' : 'DESC'

  const where: string[] = []
  const params: unknown[] = []
  if (type && type !== 'all') {
    params.push(type)
    where.push(`us.type = $${params.length}`)
  }
  if (status === 'processed_or_rejected') {
    // CHG-SN-7-MISC-USER-SUBMISSIONS-PROCESSED-FILTER：单查询拼 IN
    where.push(`us.status IN ('processed', 'rejected')`)
  } else if (status && status !== 'all') {
    params.push(status)
    where.push(`us.status = $${params.length}`)
  }
  const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const listParams = [...params, limit, offset]

  const [listRes, countRes, badgesRes] = await Promise.all([
    db.query<DbRow>(
      `SELECT us.id, us.type, us.status, us.video_id, us.source_id, us.submitted_by,
              u.username AS submitted_by_name, us.quote, us.metadata_jsonb,
              v.title AS video_title, mc.cover_url AS video_poster_url,
              vs.source_name, COALESCE(vs.source_site_key, v.site_key) AS source_site_key,
              us.created_at::text, us.processed_at::text, us.processed_by, us.processed_reason
         FROM user_submissions us
         LEFT JOIN users u ON u.id = us.submitted_by
         LEFT JOIN videos v ON v.id = us.video_id
         LEFT JOIN media_catalog mc ON mc.id = v.catalog_id
         LEFT JOIN video_sources vs ON vs.id = us.source_id
         ${whereSQL}
         ORDER BY ${orderCol} ${orderDir} NULLS LAST
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      listParams,
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM user_submissions us ${whereSQL}`,
      params,
    ),
    // AD2 partial index `WHERE status='pending'` 覆盖 3 类计数；processed/rejected 走主索引
    db.query<{
      bad_source: string
      wish_list: string
      metadata_correction: string
      processed: string
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status='pending' AND type='bad_source')          AS bad_source,
         COUNT(*) FILTER (WHERE status='pending' AND type='wish_list')           AS wish_list,
         COUNT(*) FILTER (WHERE status='pending' AND type='metadata_correction') AS metadata_correction,
         COUNT(*) FILTER (WHERE status IN ('processed','rejected'))              AS processed
       FROM user_submissions`,
    ),
  ])

  const badgesRow = badgesRes.rows[0]
  return {
    rows: listRes.rows.map(fromDbRow),
    total: Number(countRes.rows[0]?.count ?? 0),
    badges: {
      bad_source: Number(badgesRow?.bad_source ?? 0),
      wish_list: Number(badgesRow?.wish_list ?? 0),
      metadata_correction: Number(badgesRow?.metadata_correction ?? 0),
      processed: Number(badgesRow?.processed ?? 0),
    },
  }
}

export async function getUserSubmissionById(
  db: Pool,
  id: string,
): Promise<UserSubmissionRow | null> {
  const res = await db.query<DbRow>(
    `SELECT us.id, us.type, us.status, us.video_id, us.source_id, us.submitted_by,
            u.username AS submitted_by_name, us.quote, us.metadata_jsonb,
            v.title AS video_title, mc.cover_url AS video_poster_url,
            vs.source_name, COALESCE(vs.source_site_key, v.site_key) AS source_site_key,
            us.created_at::text, us.processed_at::text, us.processed_by, us.processed_reason
       FROM user_submissions us
       LEFT JOIN users u ON u.id = us.submitted_by
       LEFT JOIN videos v ON v.id = us.video_id
       LEFT JOIN media_catalog mc ON mc.id = v.catalog_id
       LEFT JOIN video_sources vs ON vs.id = us.source_id
      WHERE us.id = $1`,
    [id],
  )
  return res.rows.length > 0 ? fromDbRow(res.rows[0]) : null
}

/**
 * 状态机 pending → processed；RETURNING type 供 audit afterJsonb.type 字段。
 * 0 行 = id 不存在或 status 非 pending（Service 区分 404 / 409）。
 */
export async function markUserSubmissionProcessed(
  db: Pool,
  id: string,
  processedBy: string,
  actionTaken?: string,
): Promise<{ readonly type: UserSubmissionType } | null> {
  const res = await db.query<{ type: string }>(
    `UPDATE user_submissions
        SET status = 'processed',
            processed_at = NOW(),
            processed_by = $2,
            processed_reason = $3
      WHERE id = $1 AND status = 'pending'
      RETURNING type`,
    [id, processedBy, actionTaken ?? null],
  )
  if (res.rows.length === 0) return null
  return { type: res.rows[0].type as UserSubmissionType }
}

export async function markUserSubmissionRejected(
  db: Pool,
  id: string,
  processedBy: string,
  reason: string,
): Promise<{ readonly type: UserSubmissionType } | null> {
  const res = await db.query<{ type: string }>(
    `UPDATE user_submissions
        SET status = 'rejected',
            processed_at = NOW(),
            processed_by = $2,
            processed_reason = $3
      WHERE id = $1 AND status = 'pending'
      RETURNING type`,
    [id, processedBy, reason],
  )
  if (res.rows.length === 0) return null
  return { type: res.rows[0].type as UserSubmissionType }
}

/**
 * 批量 pending → processed；RETURNING ids 数组用于 audit afterJsonb.ids
 * 跳过 status 非 pending 的行（不抛 409 / 静默跳过 / count = 实际处理数）。
 */
export async function batchMarkProcessed(
  db: Pool,
  ids: readonly string[],
  processedBy: string,
  actionTaken?: string,
): Promise<readonly string[]> {
  if (ids.length === 0) return []
  const res = await db.query<{ id: string }>(
    `UPDATE user_submissions
        SET status = 'processed',
            processed_at = NOW(),
            processed_by = $2,
            processed_reason = $3
      WHERE id = ANY($1::uuid[])
        AND status = 'pending'
      RETURNING id`,
    [Array.from(ids), processedBy, actionTaken ?? null],
  )
  return res.rows.map((r) => r.id)
}

export async function batchMarkRejected(
  db: Pool,
  ids: readonly string[],
  processedBy: string,
  reason: string,
): Promise<readonly string[]> {
  if (ids.length === 0) return []
  const res = await db.query<{ id: string }>(
    `UPDATE user_submissions
        SET status = 'rejected',
            processed_at = NOW(),
            processed_by = $2,
            processed_reason = $3
      WHERE id = ANY($1::uuid[])
        AND status = 'pending'
      RETURNING id`,
    [Array.from(ids), processedBy, reason],
  )
  return res.rows.map((r) => r.id)
}

// ── 侧边栏 nav 计数（NTLG-P0-1 / ADR-190）────────────────────────────────────

/**
 * countPendingSubmissions — pending 用户投稿轻量 COUNT（侧边栏 badge）。
 * 走 AD2 partial index `WHERE status='pending'`。
 */
export async function countPendingSubmissions(db: Pool): Promise<number> {
  const r = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM user_submissions WHERE status = 'pending'`,
  )
  return parseInt(r.rows[0]?.count ?? '0', 10)
}
