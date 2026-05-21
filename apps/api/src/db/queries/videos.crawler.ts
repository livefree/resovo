/**
 * videos.crawler.ts — videos 爬虫采集专用函数
 * 从 videos.ts 拆出（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool } from 'pg'
import type { VideoType, VideoStatus } from '@/types'
import { VIDEO_JOIN } from './videos.internal'

// ── 视频归并策略（CHG-38）────────────────────────────────────────

/** metadata_source 优先级（越大越高）*/
export const METADATA_SOURCE_PRIORITY: Record<string, number> = {
  tmdb:    4,
  douban:  3,
  manual:  2,
  crawler: 1,
}

export type MetadataSource = 'tmdb' | 'douban' | 'manual' | 'crawler'

/**
 * @deprecated 由 MediaCatalogService.findOrCreate 替代（CHG-366 完成后移除）
 * 通过 media_catalog JOIN 实现，兼容旧调用方
 */
export async function findVideoByNormalizedKey(
  db: Pool,
  titleNormalized: string,
  year: number | null,
  type: VideoType
): Promise<{ id: string; metadataSource: string } | null> {
  const result = await db.query<{ id: string; metadata_source: string }>(
    `SELECT v.id, mc.metadata_source
     ${VIDEO_JOIN}
     WHERE mc.title_normalized = $1
       AND mc.year IS NOT DISTINCT FROM $2
       AND v.type = $3
       AND v.deleted_at IS NULL
     LIMIT 1`,
    [titleNormalized, year, type]
  )
  if (!result.rows[0]) return null
  return { id: result.rows[0].id, metadataSource: result.rows[0].metadata_source }
}

// ── 豆瓣数据更新 ──────────────────────────────────────────────────

export interface UpdateDoubanInput {
  doubanId: string
  rating?: number | null
  description?: string | null
  coverUrl?: string | null
  director?: string[]
  cast?: string[]
}

/**
 * @deprecated 由 MediaCatalogService.safeUpdate(source='douban') 替代（CHG-367 完成后移除）
 * 现在写入 media_catalog 而非 videos（相关列已迁移）
 */
export async function updateDoubanData(
  db: Pool,
  videoId: string,
  input: UpdateDoubanInput
): Promise<boolean> {
  const sets: string[] = ['douban_id = $1', 'updated_at = NOW()']
  const params: unknown[] = [input.doubanId]

  if (input.rating !== undefined) {
    params.push(input.rating)
    sets.push(`rating = $${params.length}`)
  }
  if (input.description !== undefined) {
    params.push(input.description)
    sets.push(`description = $${params.length}`)
  }
  if (input.coverUrl !== undefined) {
    params.push(input.coverUrl)
    sets.push(`cover_url = $${params.length}`)
  }
  if (input.director !== undefined) {
    params.push(input.director)
    sets.push(`director = $${params.length}`)
  }
  if (input.cast !== undefined) {
    params.push(input.cast)
    sets.push(`"cast" = $${params.length}`)
  }

  params.push(videoId)
  const result = await db.query(
    `UPDATE media_catalog mc
     SET ${sets.join(', ')}
     FROM videos v
     WHERE v.id = $${params.length}
       AND mc.id = v.catalog_id
       AND v.deleted_at IS NULL`,
    params
  )
  return (result.rowCount ?? 0) > 0
}

// ── 爬虫采集写入 ──────────────────────────────────────────────────

export interface CrawlerInsertInput {
  /**
   * CHG-366 完成后变为必填；当前临时可选（CrawlerService 尚未接入 MediaCatalogService）
   * 若未提供，insertCrawledVideo 会先创建一个最小 catalog 条目
   */
  catalogId?: string
  shortId: string
  title: string      // 冗余副本（与 mc.title 一致）
  type: VideoType    // 冗余副本（与 mc.type 一致）
  sourceCategory: string | null
  contentRating: 'general' | 'adult'
  episodeCount: number
  isPublished: boolean
  reviewStatus?: string
  visibilityStatus?: string
  siteKey?: string
  // ── @deprecated 字段（CHG-366 完成后移除，当前仍被 CrawlerService 传入）──
  /** @deprecated 元数据已迁移到 media_catalog，此字段仅用于临时 catalog 创建 */
  titleNormalized?: string
  /** @deprecated */
  titleEn?: string | null
  /** @deprecated */
  coverUrl?: string | null
  /** @deprecated */
  genre?: string | null
  /** @deprecated */
  genreSource?: 'auto' | null
  /** @deprecated */
  year?: number | null
  /** @deprecated */
  country?: string | null
  /** @deprecated */
  cast?: string[]
  /** @deprecated */
  director?: string[]
  /** @deprecated */
  writers?: string[]
  /** @deprecated */
  description?: string | null
  /** @deprecated */
  status?: VideoStatus
  /** @deprecated */
  metadataSource?: MetadataSource
}

/**
 * 新建视频记录（爬虫采集专用）。
 * 优先使用 input.catalogId；若未提供（CHG-366 过渡期），
 * 用 @deprecated 旧字段在事务中先创建最小 media_catalog 条目。
 */
export async function insertCrawledVideo(
  db: Pool,
  input: CrawlerInsertInput
): Promise<{ id: string }> {
  const client = await (db as import('pg').Pool).connect()
  try {
    await client.query('BEGIN')

    let catalogId = input.catalogId
    if (!catalogId) {
      // CHG-366 过渡兼容：CrawlerService 尚未接入 MediaCatalogService，在此临时创建 catalog
      const titleNorm = input.titleNormalized ?? input.title.toLowerCase()
      const catalogResult = await client.query<{ id: string }>(
        `INSERT INTO media_catalog
           (title, title_en, title_normalized, type, year, country, description, cover_url,
            director, "cast", writers, status, genres, metadata_source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          input.title,
          input.titleEn ?? null,
          titleNorm,
          input.type,
          input.year ?? null,
          input.country ?? null,
          input.description ?? null,
          input.coverUrl ?? null,
          input.director ?? [],
          input.cast ?? [],
          input.writers ?? [],
          input.status ?? 'completed',
          input.genre ? [input.genre] : [],
          input.metadataSource ?? 'crawler',
        ]
      )
      if (catalogResult.rows[0]) {
        catalogId = catalogResult.rows[0].id
      } else {
        // ON CONFLICT：通过 title_normalized+year+type 查找已有 catalog
        const existing = await client.query<{ id: string }>(
          `SELECT id FROM media_catalog
           WHERE title_normalized = $1 AND type = $2 AND year IS NOT DISTINCT FROM $3
           LIMIT 1`,
          [titleNorm, input.type, input.year ?? null]
        )
        catalogId = existing.rows[0]?.id
        if (!catalogId) throw new Error('insertCrawledVideo: unable to resolve catalog_id')
      }
    }

    const result = await client.query<{ id: string }>(
      `INSERT INTO videos
         (short_id, catalog_id, title, type, source_category,
          content_rating, episode_count, is_published,
          review_status, visibility_status, site_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        input.shortId,
        catalogId,
        input.title,
        input.type,
        input.sourceCategory,
        input.contentRating,
        input.episodeCount,
        input.isPublished,
        input.reviewStatus ?? 'pending_review',
        input.visibilityStatus ?? 'internal',
        input.siteKey ?? null,
      ]
    )
    await client.query('COMMIT')
    return result.rows[0]
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * 当采集到更大集数时，推进 videos.episode_count（只增不减）。
 */
export async function bumpEpisodeCountIfHigher(
  db: Pool,
  videoId: string,
  incomingEpisodeCount: number
): Promise<boolean> {
  if (!Number.isFinite(incomingEpisodeCount) || incomingEpisodeCount <= 0) return false
  const result = await db.query<{ id: string }>(
    `UPDATE videos
     SET episode_count = GREATEST(episode_count, $2),
         updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
       AND episode_count < $2
     RETURNING id`,
    [videoId, incomingEpisodeCount]
  )
  return (result.rowCount ?? 0) > 0
}

/**
 * 向 video_aliases 表写入别名（INSERT IGNORE）。
 * 规则 C: 将 vod_name / vod_en 写入别名表，便于跨站标题匹配。
 */
export async function upsertVideoAliases(
  db: Pool,
  videoId: string,
  aliases: string[]
): Promise<void> {
  const filtered = aliases.filter((a) => a.trim().length > 0)
  if (filtered.length === 0) return
  for (const alias of filtered) {
    await db.query(
      `INSERT INTO video_aliases (video_id, alias)
       VALUES ($1, $2)
       ON CONFLICT (video_id, alias) DO NOTHING`,
      [videoId, alias.trim()]
    )
  }
}
