/**
 * analytics.ts — 数据统计查询
 * CHG-19: 从 admin/analytics.ts 路由层提取的统计 SQL
 */

import type { Pool } from 'pg'

export interface VideoStats {
  total: number
  published: number
  pending: number
}

export interface SourceStats {
  total: number
  active: number
  inactive: number
}

export interface UserStats {
  total: number
  todayNew: number
  banned: number
}

export async function getVideoStats(db: Pool): Promise<VideoStats> {
  const result = await db.query<{ total: string; published: string; pending: string }>(`
    SELECT
      COUNT(*)                                          AS total,
      COUNT(*) FILTER (WHERE is_published = true)       AS published,
      COUNT(*) FILTER (WHERE is_published = false)      AS pending
    FROM videos WHERE deleted_at IS NULL
  `)
  const row = result.rows[0]
  return {
    total: parseInt(row?.total ?? '0'),
    published: parseInt(row?.published ?? '0'),
    pending: parseInt(row?.pending ?? '0'),
  }
}

export async function getSourceStats(db: Pool): Promise<SourceStats> {
  const result = await db.query<{ total: string; active: string; inactive: string }>(`
    SELECT
      COUNT(*)                                         AS total,
      COUNT(*) FILTER (WHERE is_active = true)         AS active,
      COUNT(*) FILTER (WHERE is_active = false)        AS inactive
    FROM video_sources WHERE deleted_at IS NULL
  `)
  const row = result.rows[0]
  return {
    total: parseInt(row?.total ?? '0'),
    active: parseInt(row?.active ?? '0'),
    inactive: parseInt(row?.inactive ?? '0'),
  }
}

export async function getUserStats(db: Pool, todayIso: string): Promise<UserStats> {
  const result = await db.query<{ total: string; today_new: string; banned: string }>(`
    SELECT
      COUNT(*)                                              AS total,
      COUNT(*) FILTER (WHERE created_at >= $1)             AS today_new,
      COUNT(*) FILTER (WHERE banned_at IS NOT NULL)        AS banned
    FROM users WHERE deleted_at IS NULL
  `, [todayIso])
  const row = result.rows[0]
  return {
    total: parseInt(row?.total ?? '0'),
    todayNew: parseInt(row?.today_new ?? '0'),
    banned: parseInt(row?.banned ?? '0'),
  }
}

export async function getPendingSubmissionCount(db: Pool): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) FROM video_sources WHERE is_active = false AND submitted_by IS NOT NULL AND deleted_at IS NULL`
  )
  return parseInt(result.rows[0]?.count ?? '0')
}

export async function getPendingSubtitleCount(db: Pool): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) FROM subtitles WHERE is_verified = false AND deleted_at IS NULL`
  )
  return parseInt(result.rows[0]?.count ?? '0')
}
