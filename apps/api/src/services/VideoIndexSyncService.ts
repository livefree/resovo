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
 * - 同步失败只记录 warn，不抛异常（不阻塞主流程）
 */

import type { Pool } from 'pg'
import type { Client as ESClient } from '@elastic/elasticsearch'
import { baseLogger } from '@/api/lib/logger'
const ES_INDEX = 'resovo_videos'

// ── subtitle_langs 子查询（与 videos.ts 保持一致）──────────────────

const SUBTITLE_LANGS_SUBQUERY = `(
  SELECT ARRAY_AGG(DISTINCT language) FROM subtitles
  WHERE video_id = v.id AND deleted_at IS NULL
)`

// ── audio_langs 子查询（音频语音维，HANDOFF-41）────────────────────
// ⚠️ 跨页等价不变式（不可妥协）：本子查询的过滤谓词必须与 /videos lang 筛选的
//    EXISTS 谓词逐字段对齐（apps/api/src/db/queries/videos.ts:104-110）：
//      is_active = true  ∧  deleted_at IS NULL  ∧  audio_language IS NOT NULL
//    使 ES `{term:{audio_langs:X}}` 命中 ⟺ /videos 的 EXISTS(...audio_language=X)。
//    任何谓词改动都会破坏 /videos↔/search lang 等价，须两侧同步（arch-reviewer M1）。
// ⚠️ ARRAY_AGG 在无输入行时返回 NULL（非 `{}`）；`IS NOT NULL` 过滤确保不产出含 NULL 元素
//    的脏数组（`{国语,NULL}`）。全 NULL/无活跃源 → 子查询返 NULL → buildDocument `?? []` 兜空数组
//    → 任何 term 不命中（与 /videos「全 NULL 仅在『全部』出现」一致）。
const AUDIO_LANGS_SUBQUERY = `(
  SELECT ARRAY_AGG(DISTINCT audio_language) FROM video_sources
  WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL
    AND audio_language IS NOT NULL
)`

// ── 播放统计 LEFT JOIN（STATS-06-A / ADR-216 D-216-3·D-216-4）────────
// ES 文档携带 play 排序字段（play_count_total / play_count_7d / hot_score），使 `/search?sort=hot`
// 引用真实物化热度真源、与 `/videos?sort=hot`（STATS-05-B vpt+vhs LEFT JOIN）跨 surface 口径一致。
// ⚠️ 必须 LEFT JOIN（PK video_id additive，无聚合行 → NULL）+ buildDocument 保留 NULL（禁 ?? 0）：
//    `/videos` 用 `NULLS LAST`——「无聚合行」(NULL) 与「真实 0」排序不同；ES 写 0 会混淆二者、
//    破坏 `missing:_last` ≡ `NULLS LAST` 等价（Codex 任务卡审 BLOCK 2）。
const PLAY_STATS_JOIN = `
  LEFT JOIN video_play_totals vpt ON vpt.video_id = v.id
  LEFT JOIN video_hot_scores vhs ON vhs.video_id = v.id
`

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
  audio_langs: string[] | null
  is_published: boolean
  content_rating: string
  review_status: string
  visibility_status: string
  imdb_id: string | null
  tmdb_id: number | null
  created_at: string
  updated_at: string
  // STATS-06-A：node-pg 无 int8 parser → BIGINT/NUMERIC 返 string；LEFT JOIN 无聚合行 → null
  total_play_count: string | null
  play_count_7d: string | null
  hot_score: string | null
}

/** STATS-06-A：node-pg BIGINT/NUMERIC string → number，保留 null（无聚合行，对齐 PG NULLS LAST）。 */
function toNullableNumber(value: string | null): number | null {
  return value == null ? null : Number(value)
}

// ── SQL ──────────────────────────────────────────────────────────

const ES_FIELDS = `
  v.id, v.short_id, v.slug, v.title, v.type, v.episode_count,
  v.is_published, v.content_rating, v.review_status, v.visibility_status,
  v.catalog_id, v.created_at, v.updated_at,
  mc.title_en, mc.title_original, mc.description, mc.cover_url,
  mc.genres, mc.year, mc.country, mc.rating, mc.rating_votes, mc.runtime_minutes,
  mc.status, mc.director, mc."cast", mc.writers,
  mc.aliases, mc.languages, mc.tags,
  mc.imdb_id, mc.tmdb_id,
  vpt.total_play_count, vhs.play_count_7d, vhs.hot_score
`

const FETCH_SQL = `
  SELECT ${ES_FIELDS},
         ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs,
         ${AUDIO_LANGS_SUBQUERY} AS audio_langs
  FROM videos v
  JOIN media_catalog mc ON mc.id = v.catalog_id${PLAY_STATS_JOIN}
  WHERE v.id = $1
    AND v.deleted_at IS NULL
`

const RECONCILE_SQL = `
  SELECT ${ES_FIELDS},
         ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs,
         ${AUDIO_LANGS_SUBQUERY} AS audio_langs
  FROM videos v
  JOIN media_catalog mc ON mc.id = v.catalog_id${PLAY_STATS_JOIN}
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
         ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs,
         ${AUDIO_LANGS_SUBQUERY} AS audio_langs
  FROM videos v
  JOIN media_catalog mc ON mc.id = v.catalog_id${PLAY_STATS_JOIN}
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
    audio_langs:      row.audio_langs ?? [], // HANDOFF-41 M1：?? [] 锁定——ARRAY_AGG 空集返 NULL，空数组语义明确（term 不命中）
    is_published:     row.is_published,
    content_rating:   row.content_rating,
    review_status:    row.review_status,
    visibility_status: row.visibility_status,
    imdb_id:          row.imdb_id,
    tmdb_id:          row.tmdb_id,
    created_at:       row.created_at,
    // STATS-06-A（Codex BLOCK 3）：updated_at = videos.updated_at（编辑时间，与 /videos hot tiebreak
    // `v.updated_at DESC` 同源）；非索引时间 new Date()——否则前 3 个 hot key 相同时跨 surface 时序分裂。
    updated_at:       row.updated_at,
    // STATS-06-A（Codex BLOCK 2）：play 排序字段保留 null（无聚合行）——禁 ?? 0；与 /videos NULLS LAST 等价。
    play_count_total: toNullableNumber(row.total_play_count),
    play_count_7d:    toNullableNumber(row.play_count_7d),
    hot_score:        toNullableNumber(row.hot_score),
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
      baseLogger.warn({ err, videoId }, '[VideoIndexSyncService] syncVideo failed')
    }
  }

  /**
   * STATS-06-A（Codex 任务卡审 HIGH 5）：严格同步——ES 写入失败 **抛出**（区别于 syncVideo 的
   * warn-only 吞错），供 reindex 脚本按真实成功计数、任一失败 exit≠0，杜绝「遍历计数 == published 总数」
   * 假收敛（syncVideo 吞错时遍历完成 ≠ ES 回填成功）。
   * @returns 'synced'（写入成功）| 'skipped'（视频不存在 / 已软删，FETCH_SQL 无行）
   */
  async syncVideoStrict(videoId: string): Promise<'synced' | 'skipped'> {
    const result = await this.db.query<VideoEsRow>(FETCH_SQL, [videoId])
    if (!result.rows[0]) return 'skipped'
    await this.es.index({
      index: ES_INDEX,
      id: result.rows[0].id,
      document: buildDocument(result.rows[0]),
    })
    return 'synced'
  }

  /**
   * CHG-SN-4-05: 从 ES 删除单条视频文档（reject-labeled / disable-dead 调用）。
   * 404（文档不存在）视为成功（幂等）；其他错误写 warn，不抛异常（不阻塞主流程）。
   */
  async unindexVideo(videoId: string): Promise<void> {
    try {
      await this.es.delete({ index: ES_INDEX, id: videoId })
    } catch (err) {
      const status = (err as { meta?: { statusCode?: number } })?.meta?.statusCode
      if (status === 404) return
      baseLogger.warn({ err, videoId }, '[VideoIndexSyncService] unindexVideo failed')
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
          baseLogger.warn({ err, videoId: row.id }, '[VideoIndexSyncService] reconcile failed')
        }
      }
    } catch (err) {
      baseLogger.warn({ err }, '[VideoIndexSyncService] reconcilePublished query failed')
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
          baseLogger.warn({ err, videoId: row.id }, '[VideoIndexSyncService] reconcileStale upsert failed')
        }
      }
    } catch (err) {
      baseLogger.warn({ err }, '[VideoIndexSyncService] reconcileStale unpublished query failed')
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
          const status = (err as { meta?: { statusCode?: number } })?.meta?.statusCode
          if (status === 404) {
            deleted++
          } else {
            errors++
            baseLogger.warn({ err, videoId: row.id }, '[VideoIndexSyncService] reconcileStale delete failed')
          }
        }
      }
    } catch (err) {
      baseLogger.warn({ err }, '[VideoIndexSyncService] reconcileStale deleted query failed')
    }

    return { fixed, deleted, errors }
  }
}
