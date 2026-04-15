/**
 * VideoIndexSyncService.ts — 统一 Elasticsearch 视频索引同步
 * CHG-401: 将 VideoService / StagingPublishService / CrawlerService 中三份独立的
 *          `private indexToES` 副本合并为共享服务，消除重复逻辑。
 *
 * 规则：
 * - syncVideo: upsert 一条视频到 ES（不判断状态，由调用方决定时机）
 * - reconcilePublished: 批量补全 DB 已上架但可能缺少 ES 文档的视频（reconcile job 用）
 * - 同步失败只记录 stderr，不抛异常（不阻塞主流程）
 */

import type { Pool } from 'pg'
import type { Client as ESClient } from '@elastic/elasticsearch'
const ES_INDEX = 'resovo_videos'

// ── DB 行类型（与原三份副本一致）────────────────────────────────

interface VideoEsRow {
  id: string
  short_id: string
  slug: string | null
  catalog_id: string
  title: string
  title_en: string | null
  title_original: string | null
  cover_url: string | null
  type: string
  genres: string[]
  year: number | null
  country: string | null
  episode_count: number
  rating: number | null
  status: string
  is_published: boolean
  content_rating: string
  review_status: string
  visibility_status: string
  imdb_id: string | null
  tmdb_id: number | null
}

const FETCH_SQL = `
  SELECT v.id, v.short_id, v.slug, v.title, v.type, v.episode_count,
         v.is_published, v.content_rating, v.review_status, v.visibility_status,
         v.catalog_id,
         mc.title_en, mc.title_original, mc.cover_url, mc.genres, mc.year,
         mc.country, mc.rating, mc.status, mc.imdb_id, mc.tmdb_id
  FROM videos v
  JOIN media_catalog mc ON mc.id = v.catalog_id
  WHERE v.id = $1
    AND v.deleted_at IS NULL
`

const RECONCILE_SQL = `
  SELECT v.id, v.short_id, v.slug, v.title, v.type, v.episode_count,
         v.is_published, v.content_rating, v.review_status, v.visibility_status,
         v.catalog_id,
         mc.title_en, mc.title_original, mc.cover_url, mc.genres, mc.year,
         mc.country, mc.rating, mc.status, mc.imdb_id, mc.tmdb_id
  FROM videos v
  JOIN media_catalog mc ON mc.id = v.catalog_id
  WHERE v.is_published = true
    AND v.visibility_status = 'public'
    AND v.review_status = 'approved'
    AND v.deleted_at IS NULL
  ORDER BY v.updated_at DESC
  LIMIT $1
`

function buildDocument(row: VideoEsRow): Record<string, unknown> {
  return {
    id: row.id,
    short_id: row.short_id,
    slug: row.slug,
    catalog_id: row.catalog_id,
    title: row.title,
    title_en: row.title_en,
    title_original: row.title_original,
    cover_url: row.cover_url,
    type: row.type,
    genres: row.genres ?? [],
    year: row.year,
    country: row.country,
    episode_count: row.episode_count,
    rating: row.rating,
    status: row.status,
    is_published: row.is_published,
    content_rating: row.content_rating,
    review_status: row.review_status,
    visibility_status: row.visibility_status,
    imdb_id: row.imdb_id,
    tmdb_id: row.tmdb_id,
    updated_at: new Date().toISOString(),
  }
}

export class VideoIndexSyncService {
  constructor(
    private db: Pool,
    private es: ESClient,
  ) {}

  /**
   * 将单条视频 upsert 到 ES。
   * 视频不存在（deleted_at IS NOT NULL 或无记录）时静默跳过。
   */
  async syncVideo(videoId: string): Promise<void> {
    try {
      const result = await this.db.query<VideoEsRow>(FETCH_SQL, [videoId])
      if (!result.rows[0]) return

      await this.es.index({
        index: ES_INDEX,
        id: result.rows[0].id,
        document: buildDocument(result.rows[0]),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[VideoIndexSyncService] syncVideo failed for ${videoId}: ${message}\n`)
    }
  }

  /**
   * 批量补全已上架视频的 ES 索引（reconcile job 用）。
   * 只处理 is_published=true + public + approved 的视频，最多 batchLimit 条。
   * 返回成功同步数和失败数。
   */
  async reconcilePublished(batchLimit = 100): Promise<{ synced: number; errors: number }> {
    let synced = 0
    let errors = 0
    try {
      const result = await this.db.query<VideoEsRow>(RECONCILE_SQL, [batchLimit])
      for (const row of result.rows) {
        try {
          await this.es.index({
            index: ES_INDEX,
            id: row.id,
            document: buildDocument(row),
          })
          synced++
        } catch (err) {
          errors++
          const message = err instanceof Error ? err.message : String(err)
          process.stderr.write(
            `[VideoIndexSyncService] reconcile failed for ${row.id}: ${message}\n`,
          )
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[VideoIndexSyncService] reconcilePublished query failed: ${message}\n`)
    }
    return { synced, errors }
  }
}
