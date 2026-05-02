/**
 * moderation.ts — 审核台专用 DB 查询
 * UX-13: listModerationHistory（已审核视频历史记录）
 * CHG-SN-4-05: listPendingQueue（pending-queue cursor 分页）
 */

import type { Pool } from 'pg'

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
}

interface DbPendingQueueRow {
  id: string
  title: string
  type: string
  year: number | null
  country: string | null
  episode_count: number
  cover_url: string | null
  rating: number | null
  category: string | null
  is_published: boolean
  visibility_status: string
  review_status: string
  review_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  probe: string
  render: string
  source_check_status: string
  meta_score: number
  needs_manual_review: boolean
  badges: string[] | null
  staff_note: string | null
  review_label_key: string | null
  douban_status: string
  review_source: string
  trending_tag: string | null
  created_at: string
  updated_at: string
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
      `SELECT v.id, v.title, v.type, mc.year, mc.country, v.episode_count, mc.cover_url,
              mc.rating, v.source_category AS category, v.is_published,
              v.visibility_status, v.review_status, v.review_reason, v.reviewed_by, v.reviewed_at,
              COALESCE(
                (SELECT probe_status FROM video_sources
                 WHERE video_id = v.id AND deleted_at IS NULL AND is_active = true
                 ORDER BY CASE probe_status WHEN 'dead' THEN 0 WHEN 'partial' THEN 1
                           WHEN 'pending' THEN 2 ELSE 3 END LIMIT 1),
                'pending'
              ) AS probe,
              COALESCE(
                (SELECT render_status FROM video_sources
                 WHERE video_id = v.id AND deleted_at IS NULL AND is_active = true
                 ORDER BY CASE render_status WHEN 'dead' THEN 0 WHEN 'partial' THEN 1
                           WHEN 'pending' THEN 2 ELSE 3 END LIMIT 1),
                'pending'
              ) AS render,
              v.source_check_status, v.meta_score, v.needs_manual_review,
              ARRAY[]::text[] AS badges,
              v.staff_note, v.review_label_key, v.douban_status,
              COALESCE(v.review_source, 'manual') AS review_source,
              v.trending_tag, v.created_at, v.updated_at
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
  const data = hasNext ? rows.rows.slice(0, limit) : rows.rows
  const last = data[data.length - 1]
  const nextCursor = hasNext && last
    ? encodeCursor({ createdAt: last.created_at, id: last.id })
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
