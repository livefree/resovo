/**
 * subtitles.ts — 字幕表 DB 查询
 * SUBTITLE-01
 */

import type { Pool } from 'pg'
import type { Subtitle, SubtitleFormat } from '@/types'

// ── 内部 DB 行类型 ────────────────────────────────────────────────

interface DbSubtitleRow {
  id: string
  video_id: string
  episode_number: number | null
  language: string
  label: string
  file_url: string
  format: SubtitleFormat
  is_verified: boolean
  created_at: string
}

function mapSubtitle(row: DbSubtitleRow): Subtitle {
  return {
    id: row.id,
    videoId: row.video_id,
    episodeNumber: row.episode_number,
    language: row.language,
    label: row.label,
    fileUrl: row.file_url,
    format: row.format,
    isVerified: row.is_verified,
    createdAt: row.created_at,
  }
}

// ── 查询：按 videoId 获取字幕列表 ────────────────────────────────

export async function findSubtitlesByVideoId(
  db: Pool,
  videoId: string,
  episode?: number
): Promise<Subtitle[]> {
  const conditions = ['video_id = $1']
  const params: unknown[] = [videoId]
  let idx = 2

  if (episode !== undefined) {
    conditions.push(`(episode_number = $${idx++} OR episode_number IS NULL)`)
    params.push(episode)
  }

  const result = await db.query<DbSubtitleRow>(
    `SELECT * FROM subtitles
     WHERE ${conditions.join(' AND ')}
     ORDER BY language ASC, created_at ASC`,
    params
  )
  return result.rows.map(mapSubtitle)
}

// ── 写入：新增字幕记录 ───────────────────────────────────────────

export interface CreateSubtitleInput {
  videoId: string
  episodeNumber: number | null
  language: string       // BCP 47，如 zh-CN、en、ja
  label: string          // 如"中文简体"
  fileUrl: string        // R2 URL
  format: SubtitleFormat
}

export async function createSubtitle(
  db: Pool,
  input: CreateSubtitleInput
): Promise<Subtitle> {
  const result = await db.query<DbSubtitleRow>(
    `INSERT INTO subtitles
       (video_id, episode_number, language, label, file_url, format, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6, false)
     RETURNING *`,
    [
      input.videoId,
      input.episodeNumber,
      input.language,
      input.label,
      input.fileUrl,
      input.format,
    ]
  )
  return mapSubtitle(result.rows[0])
}

// ── 查询：按 id 获取单条字幕 ─────────────────────────────────────

export async function findSubtitleById(
  db: Pool,
  id: string
): Promise<Subtitle | null> {
  const result = await db.query<DbSubtitleRow>(
    'SELECT * FROM subtitles WHERE id = $1',
    [id]
  )
  return result.rows[0] ? mapSubtitle(result.rows[0]) : null
}

// ── 写入：版主审核通过 ───────────────────────────────────────────

export async function verifySubtitle(db: Pool, id: string): Promise<void> {
  await db.query('UPDATE subtitles SET is_verified = true WHERE id = $1', [id])
}
