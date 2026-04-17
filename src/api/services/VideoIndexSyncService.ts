/**
 * VideoIndexSyncService.ts — 统一 Elasticsearch 视频索引同步
 * CHG-401: 将 VideoService / StagingPublishService / CrawlerService 中三份独立的
 *          `private indexToES` 副本合并为共享服务，消除重复逻辑。
 * CHG-410: 补全 FETCH_SQL/RECONCILE_SQL 缺失字段（description/director/cast/writers/subtitle_langs/created_at）
 * CHG-411: 新增 reconcileStale，修复 ES 漏下架/漏删除的旧文档
 *
 * 规则：
 * - syncVideo: upsert 一条视频到 ES（不判断状态，由调用方决定时机）
 * - reconcilePublished: 批量补全 DB 已上架但可能缺少 ES 文档的视频（reconcile job 用）
 * - reconcileStale: 批量修复最近下架/隐藏/软删除的视频，使其 ES 文档与 DB 保持一致
 * - 同步失败只记录 stderr，不抛异常（不阻塞主流程）
 */

import type { Pool } from 'pg'
import type { Client as ESClient } from '@elastic/elasticsearch'
const ES_INDEX = 'resovo_videos'

// ── subtitle_langs 子查询（与 videos.ts 保持一致）──────────────────

const SUBTITLE_LANGS_SUBQUERY = `(
  SELECT ARRAY_AGG(DISTINCT language) FROM subtitles
  WHERE video_id = v.id AND deleted_at IS NULL
)`

// ── DB 行类型（补全 SearchService 依赖的全部字段）──────────────────

interface VideoEsRow {
  id: string
  short_id: string
  slug: string | null
  catalog_id: string
  title: string
  title_en: string | null
  title_original: string | null
  description: string | null
  cover_url: string | null
  type: string
  genres: string[]
  year: number | null
  country: string | null
  episode_count: number
  rating: number | null
  rating_votes: number | null
  runtime_minutes: number | null
  status: string
  director: string[]
  cast: string[]
  writers: string[]
  aliases: string[]
  languages: string[]
  tags: string[]
  subtitle_langs: string[] | null
  is_published: boolean
  content_rating: string
  review_status: string
  visibility_status: string
  imdb_id: string | null
  tmdb_id: number | null
  created_at: string
}

// ── SQL ──────────────────────────────────────────────────────────

const ES_FIELDS = `
  v.id, v.short_id, v.slug, v.title, v.type, v.episode_count,
  v.is_published, v.content_rating, v.review_status, v.visibility_status,
  v.catalog_id, v.created_at,
  mc.title_en, mc.title_original, mc.description, mc.cover_url,
  mc.genres, mc.year, mc.country, mc.rating, mc.rating_votes, mc.runtime_minutes,
  mc.status, mc.director, mc."cast", mc.writers,
  mc.aliases, mc.languages, mc.tags,
  mc.imdb_id, mc.tmdb_id
`

const FETCH_SQL = `
  SELECT ${ES_FIELDS},
         ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
  FROM videos v
  JOIN media_catalog mc ON mc.id = v.catalog_id
  WHERE v.id = $1
    AND v.deleted_at IS NULL
`

const RECONCILE_SQL = `
  SELECT ${ES_FIELDS},
         ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
  FROM videos v
  JOIN media_catalog mc ON mc.id = v.catalog_id
  WHERE v.is_published = true
    AND v.visibility_status = 'public'
    AND v.review_status = 'approved'
    AND v.deleted_at IS NULL
  ORDER BY v.updated_at DESC
  LIMIT $1
`

/** CHG-411: 查询最近修改的非上架视频（用于修复漏下架的 ES 文档） */
const STALE_UNPUBLISHED_SQL = `
  SELECT ${ES_FIELDS},
         ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
  FROM videos v
  JOIN media_catalog mc ON mc.id = v.catalog_id
  WHERE v.deleted_at IS NULL
    AND v.updated_at >= NOW() - ($1 * INTERVAL '1 day')
    AND (v.is_published = false OR v.visibility_status != 'public' OR v.review_status != 'approved')
  ORDER BY v.updated_at DESC
  LIMIT $2
`

/** CHG-411: 查询最近软删除的视频 ID（用于从 ES 删除） */
const STALE_DELETED_SQL = `
  SELECT id FROM videos
  WHERE deleted_at IS NOT NULL
    AND updated_at >= NOW() - ($1 * INTERVAL '1 day')
  ORDER BY updated_at DESC
  LIMIT $2
`

// ── 文档构建 ──────────────────────────────────────────────────────

function buildDocument(row: VideoEsRow): Record<string, unknown> {
  return {
    id:               row.id,
    short_id:         row.short_id,
    slug:             row.slug,
    catalog_id:       row.catalog_id,
    title:            row.title,
    title_en:         row.title_en,
    title_original:   row.title_original,
    description:      row.description,
    cover_url:        row.cover_url,
    type:             row.type,
    genres:           row.genres ?? [],
    year:             row.year,
    country:          row.country,
    episode_count:    row.episode_count,
    rating:           row.rating,
    rating_votes:     row.rating_votes,
    runtime_minutes:  row.runtime_minutes,
    status:           row.status,
    director:         row.director ?? [],
    cast:             row.cast ?? [],
    writers:          row.writers ?? [],
    aliases:          row.aliases ?? [],
    languages:        row.languages ?? [],
    tags:             row.tags ?? [],
    subtitle_langs:   row.subtitle_langs ?? [],
    is_published:     row.is_published,
    content_rating:   row.content_rating,
    review_status:    row.review_status,
    visibility_status: row.visibility_status,
    imdb_id:          row.imdb_id,
    tmdb_id:          row.tmdb_id,
    created_at:       row.created_at,
    updated_at:       new Date().toISOString(),
  }
}

// ── Service ───────────────────────────────────────────────────────

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

  /**
   * CHG-411: 修复最近下架/隐藏/软删除视频的 ES 文档，防止"漏下架"导致旧文档长期残留。
   *
   * - 非上架视频（is_published=false 或 visibility/review 状态非 public/approved）：
   *   upsert 到 ES，使 is_published=false 写入，SearchService 的 filter 将排除它们。
   * - 软删除视频（deleted_at IS NOT NULL）：从 ES 删除文档。
   *
   * @param daysLookback 回溯天数（只处理最近 N 天内 updated_at 有变化的视频，default 7）
   * @param batchLimit 每类最多处理条数（default 200）
   */
  async reconcileStale(
    daysLookback = 7,
    batchLimit = 200,
  ): Promise<{ fixed: number; deleted: number; errors: number }> {
    let fixed = 0
    let deleted = 0
    let errors = 0

    // 1. 修复非上架视频（upsert with is_published=false）
    try {
      const result = await this.db.query<VideoEsRow>(STALE_UNPUBLISHED_SQL, [daysLookback, batchLimit])
      for (const row of result.rows) {
        try {
          await this.es.index({
            index: ES_INDEX,
            id: row.id,
            document: buildDocument(row),
          })
          fixed++
        } catch (err) {
          errors++
          const message = err instanceof Error ? err.message : String(err)
          process.stderr.write(
            `[VideoIndexSyncService] reconcileStale upsert failed for ${row.id}: ${message}\n`,
          )
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[VideoIndexSyncService] reconcileStale unpublished query failed: ${message}\n`)
    }

    // 2. 删除软删除的视频文档
    try {
      const result = await this.db.query<{ id: string }>(STALE_DELETED_SQL, [daysLookback, batchLimit])
      for (const row of result.rows) {
        try {
          await this.es.delete({ index: ES_INDEX, id: row.id })
          deleted++
        } catch (err) {
          // 404 表示文档不存在，视为成功（幂等）
          const message = err instanceof Error ? err.message : String(err)
          if (!message.includes('404') && !message.includes('not_found')) {
            errors++
            process.stderr.write(
              `[VideoIndexSyncService] reconcileStale delete failed for ${row.id}: ${message}\n`,
            )
          } else {
            deleted++
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[VideoIndexSyncService] reconcileStale deleted query failed: ${message}\n`)
    }

    return { fixed, deleted, errors }
  }
}
