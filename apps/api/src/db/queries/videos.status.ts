/**
 * videos.status.ts — videos 状态/审核台/流水线/首页专用查询
 * 从 videos.ts 拆出（CHG-SN-7-MISC-API-QUERIES-SIZE）
 */

import type { Pool, PoolClient } from 'pg'
import type { VideoCard, VideoType, DoubanStatus, BangumiStatus, SourceCheckStatus, TrendingTag, VideoMetaQuality } from '@/types'
import type { DbVideoRow } from './videos.internal'
import {
  VIDEO_FULL_SELECT, VIDEO_JOIN,
  SOURCE_COUNT_SUBQUERY, SUBTITLE_LANGS_SUBQUERY,
  mapVideoCard,
} from './videos.internal'

// ── 审核台：统计 + 待审列表（CHG-220）─────────────────────────────

export interface ModerationStats {
  pendingCount: number
  todayReviewedCount: number
  /**
   * 最近 7 天拦截率（**百分数 0-100**，保留 1 位小数；无审核数据时为 null）
   *
   * 公式：`Math.round((rejected / (approved + rejected)) * 1000) / 10`
   * 即 ratio × 100 后保留 1 位小数。例如 rejected=12 / total7d=100 → 12.0（表示 12.0%）。
   *
   * **消费方使用约定**：直接拼 "%"，**不要再乘以 100**（典型坑：CHG-DESIGN-07 7C
   * 曾误乘 100 致 server-next Dashboard 显示 1230.0% 假数据，Codex stop-time fix#1 闭围；
   * fix#2 同步生产方 jsdoc 防再误读）。
   *
   * 任何持有此字段类型的生产方 / 消费方 / 镜像类型必须保持本契约同步。
   */
  interceptRate: number | null
  /**
   * 今日 vs 昨日拦截率差值（百分点；可为 null）
   * ADR-127 §扩展：interceptDelta = 今日 7d 窗口拦截率 - 昨日 7d 窗口拦截率
   */
  interceptDelta?: number | null
}

export async function getModerationStats(db: Pool): Promise<ModerationStats> {
  const [pending, todayReviewed, recent, yesterday] = await Promise.all([
    db.query<{ count: string }>(
      `SELECT COUNT(*) FROM videos
       WHERE review_status = 'pending_review' AND deleted_at IS NULL`
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) FROM videos
       WHERE review_status IN ('approved','rejected')
         AND reviewed_at >= CURRENT_DATE
         AND deleted_at IS NULL`
    ),
    db.query<{ approved: string; rejected: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE review_status = 'approved') AS approved,
         COUNT(*) FILTER (WHERE review_status = 'rejected') AS rejected
       FROM videos
       WHERE review_status IN ('approved','rejected')
         AND reviewed_at >= NOW() - INTERVAL '7 days'
         AND deleted_at IS NULL`
    ),
    db.query<{ approved: string; rejected: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE review_status = 'approved') AS approved,
         COUNT(*) FILTER (WHERE review_status = 'rejected') AS rejected
       FROM videos
       WHERE review_status IN ('approved','rejected')
         AND reviewed_at >= NOW() - INTERVAL '8 days'
         AND reviewed_at <  NOW() - INTERVAL '1 day'
         AND deleted_at IS NULL`
    ),
  ])

  const approved = parseInt(recent.rows[0]?.approved ?? '0')
  const rejected = parseInt(recent.rows[0]?.rejected ?? '0')
  const total7d = approved + rejected

  const approvedY = parseInt(yesterday.rows[0]?.approved ?? '0')
  const rejectedY = parseInt(yesterday.rows[0]?.rejected ?? '0')
  const total7dY = approvedY + rejectedY

  const todayRate = total7d > 0 ? Math.round((rejected / total7d) * 1000) / 10 : null
  const yesterdayRate = total7dY > 0 ? Math.round((rejectedY / total7dY) * 1000) / 10 : null
  const interceptDelta = todayRate !== null && yesterdayRate !== null
    ? Math.round((todayRate - yesterdayRate) * 10) / 10
    : null

  return {
    pendingCount: parseInt(pending.rows[0]?.count ?? '0'),
    todayReviewedCount: parseInt(todayReviewed.rows[0]?.count ?? '0'),
    interceptRate: todayRate,
    interceptDelta,
  }
}

export interface PendingReviewVideoRow {
  id: string
  shortId: string
  title: string
  type: string
  coverUrl: string | null
  year: number | null
  siteKey: string | null
  siteName: string | null
  firstSourceUrl: string | null
  createdAt: string
  // 流水线辅助字段（Migration 032）
  doubanStatus: DoubanStatus
  sourceCheckStatus: SourceCheckStatus
  metaScore: number
  activeSourceCount: number
}

export async function listPendingReviewVideos(
  db: Pool,
  params: {
    page: number
    limit: number
    type?: string
    sortDir?: 'asc' | 'desc'
    q?: string
    siteKey?: string
    sourceState?: 'all' | 'active' | 'missing'
    includeAdult?: boolean
    doubanStatus?: DoubanStatus
    sourceCheckStatus?: SourceCheckStatus
  }
): Promise<{ rows: PendingReviewVideoRow[]; total: number }> {
  const offset = (params.page - 1) * params.limit
  const conditions: string[] = [`v.review_status = 'pending_review'`, `v.deleted_at IS NULL`]
  const filterParams: unknown[] = []
  let idx = 1

  if (params.type) {
    conditions.push(`v.type = $${idx++}`)
    filterParams.push(params.type)
  }
  if (params.q) {
    conditions.push(`(
      v.title ILIKE $${idx}
      OR v.short_id ILIKE $${idx}
      OR EXISTS (
        SELECT 1
        FROM video_sources s2
        WHERE s2.video_id = v.id
          AND s2.deleted_at IS NULL
          AND (
            s2.source_name ILIKE $${idx}
            OR s2.source_url ILIKE $${idx}
          )
      )
    )`)
    filterParams.push(`%${params.q}%`)
    idx += 1
  }
  if (params.siteKey) {
    conditions.push(`v.site_key = $${idx++}`)
    filterParams.push(params.siteKey)
  }
  if (params.includeAdult === false) {
    conditions.push(`COALESCE(cs.is_adult, false) = false`)
  }
  if (params.sourceState === 'active') {
    conditions.push(`EXISTS (
      SELECT 1
      FROM video_sources s3
      WHERE s3.video_id = v.id
        AND s3.deleted_at IS NULL
        AND s3.is_active = true
    )`)
  } else if (params.sourceState === 'missing') {
    conditions.push(`NOT EXISTS (
      SELECT 1
      FROM video_sources s3
      WHERE s3.video_id = v.id
        AND s3.deleted_at IS NULL
        AND s3.is_active = true
    )`)
  }
  if (params.doubanStatus) {
    conditions.push(`v.douban_status = $${idx++}`)
    filterParams.push(params.doubanStatus)
  }
  if (params.sourceCheckStatus) {
    conditions.push(`v.source_check_status = $${idx++}`)
    filterParams.push(params.sourceCheckStatus)
  }

  const where = conditions.join(' AND ')
  const orderDir = params.sortDir === 'asc' ? 'ASC' : 'DESC'

  const [rows, countResult] = await Promise.all([
    db.query<{
      id: string; short_id: string; title: string; type: string
      cover_url: string | null; year: number | null
      site_key: string | null; site_name: string | null
      first_source_url: string | null; created_at: string
      douban_status: DoubanStatus; source_check_status: SourceCheckStatus
      meta_score: number; active_source_count: string
    }>(
      `SELECT v.id, v.short_id, v.title, v.type,
              mc.cover_url, mc.year,
              cs.key AS site_key, cs.name AS site_name,
              (SELECT s.source_url FROM video_sources s
               WHERE s.video_id = v.id AND s.is_active = true AND s.deleted_at IS NULL
               LIMIT 1) AS first_source_url,
              v.created_at,
              v.douban_status, v.source_check_status, v.meta_score,
              (SELECT COUNT(*) FROM video_sources s
               WHERE s.video_id = v.id AND s.is_active = true AND s.deleted_at IS NULL
              )::int AS active_source_count
       ${VIDEO_JOIN}
       LEFT JOIN crawler_sites cs ON cs.key = v.site_key
       WHERE ${where}
       ORDER BY v.created_at ${orderDir}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...filterParams, params.limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*)
       ${VIDEO_JOIN}
       LEFT JOIN crawler_sites cs ON cs.key = v.site_key
       WHERE ${where}`,
      filterParams
    ),
  ])

  return {
    rows: rows.rows.map((r) => ({
      id: r.id,
      shortId: r.short_id,
      title: r.title,
      type: r.type,
      coverUrl: r.cover_url,
      year: r.year,
      siteKey: r.site_key,
      siteName: r.site_name,
      firstSourceUrl: r.first_source_url,
      createdAt: r.created_at,
      doubanStatus: r.douban_status ?? 'pending',
      sourceCheckStatus: r.source_check_status ?? 'pending',
      metaScore: r.meta_score ?? 0,
      activeSourceCount: parseInt(r.active_source_count ?? '0'),
    })),
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}

// ── 丰富流水线状态更新 ────────────────────────────────────────────

/**
 * 写入豆瓣匹配状态、元数据完整度评分与 meta_quality 信号字典
 * （MetadataEnrichService 调用 / CHG-365-A2）
 *
 * `metaQuality` 省略时 jsonb 列保持原值；显式传入时整体覆盖（service 端做累计合并）。
 */
export async function updateVideoEnrichStatus(
  db: Pool,
  videoId: string,
  {
    doubanStatus,
    metaScore,
    metaQuality,
  }: { doubanStatus: DoubanStatus; metaScore: number; metaQuality?: VideoMetaQuality }
): Promise<void> {
  if (metaQuality === undefined) {
    await db.query(
      `UPDATE videos SET douban_status = $1, meta_score = $2, updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL`,
      [doubanStatus, metaScore, videoId]
    )
    return
  }
  await db.query(
    `UPDATE videos
       SET douban_status = $1,
           meta_score = $2,
           meta_quality = $3::jsonb,
           updated_at = NOW()
       WHERE id = $4 AND deleted_at IS NULL`,
    [doubanStatus, metaScore, JSON.stringify(metaQuality), videoId]
  )
}

/**
 * 回填集数（ADR-161 R2：Bangumi 来源经 step3 写入，source-neutral，不走 manual 锁路径）。
 * 仅当当前 episode_count 缺省/为 0 时回填，避免覆盖已有更准确的集数。
 */
export async function updateEpisodeCount(
  db: Pool | PoolClient,
  videoId: string,
  episodeCount: number
): Promise<void> {
  if (!Number.isFinite(episodeCount) || episodeCount <= 0) return
  await db.query(
    `UPDATE videos SET episode_count = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
       AND (episode_count IS NULL OR episode_count = 0)`,
    [episodeCount, videoId]
  )
}

/** 写入源活性检验聚合结果（MetadataEnrichService 调用） */
export async function updateVideoSourceCheckStatus(
  db: Pool,
  videoId: string,
  status: SourceCheckStatus
): Promise<void> {
  await db.query(
    `UPDATE videos SET source_check_status = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL`,
    [status, videoId]
  )
}

/**
 * 写入 Bangumi 匹配状态（ADR-170 / C-2 接入）。
 *
 * 接受 `Pool | PoolClient`：
 *   - `PoolClient` —— 供 BangumiService.applyAutoMatchAtomic / confirmMatch 在
 *     其 BEGIN/COMMIT 事务内调用（与 catalog+ref 原子，R-3）。
 *   - `Pool` —— 供 matchAndEnrich 的 candidate/none 分支（无事务）调用。
 */
export async function updateVideoBangumiStatus(
  db: Pool | PoolClient,
  videoId: string,
  status: BangumiStatus
): Promise<void> {
  await db.query(
    `UPDATE videos SET bangumi_status = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL`,
    [status, videoId]
  )
}

/**
 * 写入视频集数三层语义中的外部 metadata 字段（ADR-163 / CHG-367-B-A）
 *
 * 字段语义（详 ADR-163 §3）：
 *   - totalEpisodes：作品总集数（外部 metadata）
 *   - currentEpisodes：当前已播集数（外部 metadata）
 *   - 既有 episode_count 不受本函数影响（爬虫推算路径单独维护）
 *
 * mode 语义（详 ADR-163 D-163-6 / §5 写入合约）：
 *   - 'auto'：仅当目标列为 NULL 时写入（不覆盖已有值 / MetadataEnrichService 自动 enrich 路径）
 *   - 'manual'：始终覆盖（DoubanService.confirmSubject / confirmFields 人工路径优先级最高）
 *
 * 返回 true 表示至少一行被**实际更新**；false 表示视频不存在 / 已删除 / auto 模式下
 * 无 NULL 字段可写（**no-op contract**：auto 模式下若目标列都已非 NULL，函数应：
 *   ① 不触碰 updated_at（避免虚假修改时间）
 *   ② 返回 false（rowCount 准确反映"是否真有写入"）
 *
 * Codex stop-time review #15 fix：原实现 'auto' 用 SET COALESCE，target 已非 NULL 时
 * SQL 仍 UPDATE 行（rowCount=1）+ 刷新 updated_at → 违反 no-op contract。改用 WHERE 守
 * 卫只在至少一列实际从 NULL 转非 NULL 时才 touch 行。
 */
export async function updateVideoEpisodes(
  db: Pool,
  videoId: string,
  input: { totalEpisodes?: number | null; currentEpisodes?: number | null },
  mode: 'auto' | 'manual',
): Promise<boolean> {
  const sets: string[] = []
  const params: unknown[] = []
  let idx = 1
  // auto 模式的 WHERE 守卫条件（每列一个 OR 子句）；至少一列 NULL → 非 NULL 才 UPDATE
  const autoGuards: string[] = []

  if (input.totalEpisodes !== undefined) {
    if (mode === 'auto') {
      const pIdx = idx++
      sets.push(`total_episodes = COALESCE(total_episodes, $${pIdx})`)
      autoGuards.push(`(total_episodes IS NULL AND $${pIdx}::INT IS NOT NULL)`)
    } else {
      sets.push(`total_episodes = $${idx++}`)
    }
    params.push(input.totalEpisodes)
  }
  if (input.currentEpisodes !== undefined) {
    if (mode === 'auto') {
      const pIdx = idx++
      sets.push(`current_episodes = COALESCE(current_episodes, $${pIdx})`)
      autoGuards.push(`(current_episodes IS NULL AND $${pIdx}::INT IS NOT NULL)`)
    } else {
      sets.push(`current_episodes = $${idx++}`)
    }
    params.push(input.currentEpisodes)
  }

  if (sets.length === 0) return false  // 调用方传空对象 → no-op

  sets.push(`updated_at = NOW()`)
  params.push(videoId)
  const videoIdIdx = idx

  // auto 模式：附加 WHERE 守卫（至少一列实际从 NULL 转非 NULL）/ manual 模式：直接 UPDATE
  const where = mode === 'auto' && autoGuards.length > 0
    ? `id = $${videoIdIdx} AND deleted_at IS NULL AND (${autoGuards.join(' OR ')})`
    : `id = $${videoIdIdx} AND deleted_at IS NULL`

  const res = await db.query(
    `UPDATE videos SET ${sets.join(', ')} WHERE ${where}`,
    params,
  )
  return (res.rowCount ?? 0) > 0
}

/**
 * 从 video_sources.is_active 聚合并回写单条视频的 source_check_status。
 * 用于补源完成后即时更新状态（crawlerWorker source-refetch 成功路径）。
 */
export async function syncSourceCheckStatusFromSources(
  db: Pool,
  videoId: string,
): Promise<void> {
  await db.query(
    `UPDATE videos
     SET source_check_status = (
       CASE
         WHEN NOT EXISTS (
           SELECT 1 FROM video_sources WHERE video_id = $1 AND deleted_at IS NULL
         ) THEN 'all_dead'
         WHEN NOT EXISTS (
           SELECT 1 FROM video_sources WHERE video_id = $1 AND is_active = true AND deleted_at IS NULL
         ) THEN 'all_dead'
         WHEN EXISTS (
           SELECT 1 FROM video_sources WHERE video_id = $1 AND is_active = false AND deleted_at IS NULL
         ) THEN 'partial'
         ELSE 'ok'
       END
     ),
     updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [videoId],
  )
}

/**
 * 批量从 video_sources.is_active 聚合并回写 source_check_status。
 * filter='published'：已上架视频（verify-published-sources 前置步骤）。
 * filter='staging'：暂存中视频（verify-staging-sources 任务）。
 * 返回实际更新行数。
 */
export async function bulkSyncSourceCheckStatus(
  db: Pool,
  filter: 'published' | 'staging',
  limit = 500,
): Promise<number> {
  const filterClause = filter === 'published'
    ? `is_published = true`
    : `review_status = 'approved' AND visibility_status = 'internal' AND is_published = false`

  const result = await db.query(
    `UPDATE videos
     SET source_check_status = (
       CASE
         WHEN NOT EXISTS (
           SELECT 1 FROM video_sources WHERE video_id = videos.id AND deleted_at IS NULL
         ) THEN 'all_dead'
         WHEN NOT EXISTS (
           SELECT 1 FROM video_sources WHERE video_id = videos.id AND is_active = true AND deleted_at IS NULL
         ) THEN 'all_dead'
         WHEN EXISTS (
           SELECT 1 FROM video_sources WHERE video_id = videos.id AND is_active = false AND deleted_at IS NULL
         ) THEN 'partial'
         ELSE 'ok'
       END
     ),
     updated_at = NOW()
     WHERE id IN (
       SELECT id FROM videos
       WHERE ${filterClause}
         AND deleted_at IS NULL
       LIMIT $1
     )`,
    [limit],
  )
  return result.rowCount ?? 0
}

// ── 榜单标签（Migration 051，ADR-052）─────────────────────────────

export async function setVideoTrendingTag(
  db: Pool,
  videoId: string,
  tag: TrendingTag,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE videos SET trending_tag = $2, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [videoId, tag],
  )
  return (result.rowCount ?? 0) > 0
}

export async function clearVideoTrendingTag(
  db: Pool,
  videoId: string,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE videos SET trending_tag = NULL, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [videoId],
  )
  return (result.rowCount ?? 0) > 0
}

export async function listVideosByTrendingTag(
  db: Pool,
  tag: TrendingTag,
  limit = 20,
): Promise<VideoCard[]> {
  const result = await db.query<DbVideoRow>(
    `SELECT ${VIDEO_FULL_SELECT},
      ${SOURCE_COUNT_SUBQUERY} AS source_count,
      ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
     ${VIDEO_JOIN}
     WHERE v.trending_tag = $1
       AND v.is_published = true
       AND v.deleted_at IS NULL
       AND v.visibility_status = 'public'
     ORDER BY v.created_at DESC
     LIMIT $2`,
    [tag, Math.min(limit, 100)],
  )
  return result.rows.map(mapVideoCard)
}

// ── Home 首页专用查询 ─────────────────────────────────────────────

/**
 * 按 rating DESC, year DESC 排序取 VideoCard（首页 top10 fallback 补位）
 * excludeIds: 已人工置顶的 video.id（UUID），补位时跳过
 */
export async function listVideosByRatingDesc(
  db: Pool,
  limit: number,
  excludeIds: string[] = [],
): Promise<VideoCard[]> {
  const safeLimit = Math.min(limit, 100)
  const params: unknown[] = [safeLimit]
  let excludeClause = ''
  if (excludeIds.length > 0) {
    params.push(excludeIds)
    excludeClause = `AND v.id <> ALL($2::uuid[])`
  }
  const result = await db.query<DbVideoRow>(
    `SELECT ${VIDEO_FULL_SELECT},
      ${SOURCE_COUNT_SUBQUERY} AS source_count,
      ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
     ${VIDEO_JOIN}
     WHERE v.is_published = true
       AND v.deleted_at IS NULL
       AND v.visibility_status = 'public'
       ${excludeClause}
     ORDER BY mc.rating DESC NULLS LAST, mc.year DESC NULLS LAST
     LIMIT $1`,
    params,
  )
  return result.rows.map(mapVideoCard)
}

/**
 * 批量按 UUID 取 VideoCard（首页 top10 人工置顶解析，避免 N+1）
 * content_ref_id 是 videos.id（UUID），不是 short_id
 * 返回结果可能少于 ids 长度（已下线 / 未发布条目自动丢弃）
 */
export async function listVideoCardsByIds(
  db: Pool,
  ids: string[],
): Promise<VideoCard[]> {
  if (ids.length === 0) return []
  const result = await db.query<DbVideoRow>(
    `SELECT ${VIDEO_FULL_SELECT},
      ${SOURCE_COUNT_SUBQUERY} AS source_count,
      ${SUBTITLE_LANGS_SUBQUERY} AS subtitle_langs
     ${VIDEO_JOIN}
     WHERE v.id = ANY($1::uuid[])
       AND v.is_published = true
       AND v.deleted_at IS NULL
       AND v.visibility_status = 'public'`,
    [ids],
  )
  return result.rows.map(mapVideoCard)
}

/**
 * 按 type 分组统计已发布公开视频数量
 * 返回全部 VideoType 枚举值（无视频的类型 count=0，保证前端消费稳定）
 */
export async function countVideosByType(
  db: Pool,
): Promise<Array<{ type: VideoType; count: number }>> {
  const ALL_TYPES: VideoType[] = [
    'movie', 'series', 'anime', 'variety', 'documentary',
    'short', 'sports', 'music', 'news', 'kids', 'other',
  ]
  const result = await db.query<{ type: VideoType; count: string }>(
    `SELECT v.type, COUNT(*)::int AS count
     FROM videos v
     WHERE v.is_published = true
       AND v.deleted_at IS NULL
       AND v.visibility_status = 'public'
     GROUP BY v.type`,
  )
  const map = new Map(result.rows.map((r) => [r.type, parseInt(r.count, 10)]))
  return ALL_TYPES.map((type) => ({ type, count: map.get(type) ?? 0 }))
}
