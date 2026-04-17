/**
 * watchHistory.ts — 观看历史表 DB 查询
 * ADR-012: POST /users/me/history
 */

import type { Pool } from 'pg'

export interface UpsertWatchHistoryInput {
  userId: string
  videoId: string
  seasonNumber?: number   // 默认 1（ADR-016）
  episodeNumber?: number  // 默认 1（ADR-016：单集/电影为 1）
  progressSeconds: number
}

/**
 * Upsert 观看历史：同一 (user_id, video_id, season_number, episode_number) 已存在时更新进度，
 * 不存在时插入新记录。
 * ADR-016: episode_number 统一坐标系，单集/电影为 1（NOT NULL）。
 */
export async function upsertWatchHistory(
  db: Pool,
  input: UpsertWatchHistoryInput
): Promise<void> {
  await db.query(
    `INSERT INTO watch_history (user_id, video_id, season_number, episode_number, progress_seconds, watched_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, video_id, episode_number)
     DO UPDATE SET
       progress_seconds = EXCLUDED.progress_seconds,
       watched_at = NOW()`,
    [input.userId, input.videoId, input.seasonNumber ?? 1, input.episodeNumber ?? 1, input.progressSeconds]
  )
}

export interface WatchHistoryRow {
  video_id: string
  season_number: number
  episode_number: number
  progress_seconds: number
  watched_at: string
  video_short_id: string
  video_title: string
  video_cover_url: string | null
  video_type: string
}

export async function getUserHistory(
  db: Pool,
  userId: string,
  page: number,
  limit: number
): Promise<{ rows: WatchHistoryRow[]; total: number }> {
  const offset = (page - 1) * limit

  const [rows, countResult] = await Promise.all([
    db.query<WatchHistoryRow>(
      `SELECT wh.video_id, wh.season_number, wh.episode_number, wh.progress_seconds, wh.watched_at,
              v.short_id AS video_short_id, v.title AS video_title,
              v.cover_url AS video_cover_url, v.type AS video_type
       FROM watch_history wh
       JOIN videos v ON wh.video_id = v.id
       WHERE wh.user_id = $1
       ORDER BY wh.watched_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) FROM watch_history WHERE user_id = $1`,
      [userId]
    ),
  ])

  return {
    rows: rows.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}
