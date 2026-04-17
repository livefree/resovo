/**
 * danmaku.ts — 弹幕表 DB 查询
 * CHG-21: 弹幕后端 API
 * GET /videos/:videoId/danmaku — 按 video_id + episode_number 查弹幕
 * POST /videos/:videoId/danmaku — 插入一条弹幕
 */

import type { Pool } from 'pg'

// ── 对外类型 ──────────────────────────────────────────────────────

export interface DanmakuItem {
  time: number   // 秒（整数）
  type: 0 | 1 | 2  // 0=scroll, 1=top, 2=bottom（CCL 格式）
  color: string  // #rrggbb
  text: string
}

export interface InsertDanmakuInput {
  videoId: string      // UUID（已解析）
  userId: string       // UUID
  episodeNumber: number
  time: number
  type: 0 | 1 | 2
  color: string
  text: string
}

// ── 内部 DB 行类型 ────────────────────────────────────────────────

interface DbDanmakuRow {
  time_seconds: number
  type: 'scroll' | 'top' | 'bottom'
  color: string
  content: string
}

// type 字符串 → CCL 数字映射
const TYPE_MAP: Record<'scroll' | 'top' | 'bottom', 0 | 1 | 2> = {
  scroll: 0,
  top: 1,
  bottom: 2,
}

// CCL 数字 → DB 字符串映射
const TYPE_REVERSE_MAP: Record<0 | 1 | 2, 'scroll' | 'top' | 'bottom'> = {
  0: 'scroll',
  1: 'top',
  2: 'bottom',
}

function mapRow(row: DbDanmakuRow): DanmakuItem {
  return {
    time: row.time_seconds,
    type: TYPE_MAP[row.type],
    color: row.color,
    text: row.content,
  }
}

// ── 查询：获取弹幕列表 ────────────────────────────────────────────

const MAX_DANMAKU = 5000

export async function getDanmaku(
  db: Pool,
  videoId: string,
  episodeNumber = 1
): Promise<DanmakuItem[]> {
  const result = await db.query<DbDanmakuRow>(
    `SELECT time_seconds, type, color, content
       FROM danmaku
      WHERE video_id = $1
        AND episode_number = $2
        AND deleted_at IS NULL
      ORDER BY time_seconds ASC
      LIMIT $3`,
    [videoId, episodeNumber, MAX_DANMAKU]
  )
  return result.rows.map(mapRow)
}

// ── 插入：发送一条弹幕 ────────────────────────────────────────────

export async function insertDanmaku(
  db: Pool,
  input: InsertDanmakuInput
): Promise<DanmakuItem> {
  const dbType = TYPE_REVERSE_MAP[input.type]
  const result = await db.query<DbDanmakuRow>(
    `INSERT INTO danmaku (video_id, user_id, episode_number, time_seconds, content, color, type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING time_seconds, type, color, content`,
    [
      input.videoId,
      input.userId,
      input.episodeNumber,
      input.time,
      input.text,
      input.color,
      dbType,
    ]
  )
  return mapRow(result.rows[0])
}
