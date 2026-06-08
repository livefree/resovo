/**
 * home-discovery.ts — 首页发现板块查询（ADR-189 D-189-7）
 *
 * 「每日放送」独立发现机制（**不进 home-section 框架** / arch B1）：读 bangumi_collection_items
 * calendar 当日 weekday 切片，LEFT JOIN media_catalog.bangumi_subject_id → 站内 published video
 * 交叉态（有则 linkedVideo 链详情，无则前台「想看/搜索」引导）。仅只读，不写、不触 autofill/section。
 */

import type { Pool } from 'pg'
import { calendarKeyForWeekday } from '@/api/services/bangumi-collections/registry'

/** 站内交叉态：命中站内 published video → {videoId, slug}；未入站 → null。 */
export interface DailyAnimeLinkedVideo {
  readonly videoId: string
  readonly slug: string
}

export interface DailyAnimeItem {
  /** Bangumi subject id（= bangumi_collection_items.bangumi_id） */
  readonly bangumiSubjectId: string
  readonly title: string
  readonly nameCn: string | null
  readonly coverUrl: string | null
  /** 放送星期（1=周一..7=周日） */
  readonly airWeekday: number
  readonly rating: number | null
  readonly rank: number
  /** 站内 published video（有则可链详情，无则未入站发现位） */
  readonly linkedVideo: DailyAnimeLinkedVideo | null
}

export interface DailyAnimeResult {
  readonly weekday: number
  readonly items: DailyAnimeItem[]
}

interface DbRow {
  bangumi_id: string
  title: string
  name_cn: string | null
  cover_url: string | null
  air_weekday: number
  rating: string | number | null
  rank: number
  video_id: string | null
  video_slug: string | null
}

/**
 * 读某 weekday（1-7）的每日放送切片 + 站内交叉。
 * weekday 越界（无对应 calendar 合集 key）→ 返回 []。
 */
export async function listDailyAnimeByWeekday(db: Pool, weekday: number): Promise<DailyAnimeItem[]> {
  const collection = calendarKeyForWeekday(weekday)
  if (!collection) return []

  // bangumi_id（TEXT，存数字）↔ media_catalog.bangumi_subject_id（INT）：用 INT::TEXT 比较避免 TEXT→INT 解析风险。
  // LATERAL 取该 catalog 下最近更新的 1 条 published 公开 video。
  const result = await db.query<DbRow>(
    `SELECT bci.bangumi_id, bci.title, bci.name_cn, bci.cover_url, bci.air_weekday, bci.rating, bci.rank,
            v.id AS video_id, v.slug AS video_slug
       FROM external_data.bangumi_collection_items bci
       LEFT JOIN media_catalog mc ON mc.bangumi_subject_id::TEXT = bci.bangumi_id
       LEFT JOIN LATERAL (
         SELECT vi.id, vi.slug
           FROM videos vi
          WHERE vi.catalog_id = mc.id AND vi.deleted_at IS NULL
            AND vi.is_published = true AND vi.visibility_status = 'public'
          ORDER BY vi.updated_at DESC
          LIMIT 1
       ) v ON true
      WHERE bci.collection = $1
      ORDER BY bci.rank ASC`,
    [collection],
  )

  return result.rows.map((r) => ({
    bangumiSubjectId: r.bangumi_id,
    title: r.title,
    nameCn: r.name_cn,
    coverUrl: r.cover_url,
    airWeekday: r.air_weekday,
    rating: r.rating == null ? null : Number(r.rating),
    rank: r.rank,
    linkedVideo: r.video_id && r.video_slug ? { videoId: r.video_id, slug: r.video_slug } : null,
  }))
}
