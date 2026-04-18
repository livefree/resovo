/**
 * moderation.ts — 审核台专用 DB 查询
 * UX-13: listModerationHistory（已审核视频历史记录）
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
