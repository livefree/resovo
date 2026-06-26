// videoPlayStats.ts — 视频级播放量统计 DB query 模块骨架（ADR-216 / STATS-02-SCHEMA）
//
// 本卡仅落 schema 骨架：6 表的 Db 行类型（snake_case）+ COLUMNS 投影常量 + mapRow（→ @/types 域类型 camelCase）。
// 写入（STATS-03）/ 聚合 upsert（STATS-04）/ 读取（STATS-05）业务查询函数在对应卡新增，复用本文件 COLUMNS + mapRow。
//
// 约定（db-rules.md + 仓库现状）：
//   - 所有 SQL 参数化，不拼接字符串。
//   - node-pg 无全局 int8 type parser → BIGINT/NUMERIC 列返回 string，mapRow 用 parseInt/Number 转 number（同 analytics.ts）。
//   - DATE/TIMESTAMPTZ 默认转 JS Date → COLUMNS 用 `::TEXT` 取 ISO string（同 card-size-settings.ts）。

import type { Pool } from 'pg'
import type {
  VideoPlayEvent,
  VideoPlayEventType,
  VideoPlayHourly,
  VideoPlayDaily,
  VideoPlayDailyVisitor,
  VideoPlayTotals,
  VideoHotScore,
} from '@/types'

// ── video_play_events ─────────────────────────────────────────────────────────

export interface DbVideoPlayEventRow {
  id: string // BIGSERIAL → string
  idempotency_key: string
  video_id: string
  source_id: string | null
  episode_number: number | null // INT
  event_type: string
  play_session_id: string
  visitor_hash: string
  visitor_is_ephemeral: boolean
  ip_hash: string | null
  user_id: string | null
  watch_seconds: number // INT
  duration_seconds: number | null // INT
  locale: string | null
  referrer_path: string | null
  user_agent_hash: string | null
  occurred_at: string // ::TEXT
  ingested_at: string // ::TEXT
  aggregated_at: string | null // ::TEXT
}

export const VIDEO_PLAY_EVENT_COLUMNS = `id, idempotency_key, video_id, source_id, episode_number,
  event_type, play_session_id, visitor_hash, visitor_is_ephemeral, ip_hash, user_id,
  watch_seconds, duration_seconds, locale, referrer_path, user_agent_hash,
  occurred_at::TEXT AS occurred_at, ingested_at::TEXT AS ingested_at,
  aggregated_at::TEXT AS aggregated_at`

export function mapVideoPlayEventRow(row: DbVideoPlayEventRow): VideoPlayEvent {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    videoId: row.video_id,
    sourceId: row.source_id,
    episodeNumber: row.episode_number,
    eventType: row.event_type as VideoPlayEventType,
    playSessionId: row.play_session_id,
    visitorHash: row.visitor_hash,
    visitorIsEphemeral: row.visitor_is_ephemeral,
    ipHash: row.ip_hash,
    userId: row.user_id,
    watchSeconds: row.watch_seconds,
    durationSeconds: row.duration_seconds,
    locale: row.locale,
    referrerPath: row.referrer_path,
    userAgentHash: row.user_agent_hash,
    occurredAt: row.occurred_at,
    ingestedAt: row.ingested_at,
    aggregatedAt: row.aggregated_at,
  }
}

// ── video_play_hourly ─────────────────────────────────────────────────────────

export interface DbVideoPlayHourlyRow {
  video_id: string
  bucket_hour: string // ::TEXT
  play_count: string // BIGINT
  anon_play_count: string
  logged_in_play_count: string
  total_watch_seconds: string
  updated_at: string // ::TEXT
}

export const VIDEO_PLAY_HOURLY_COLUMNS = `video_id, bucket_hour::TEXT AS bucket_hour,
  play_count, anon_play_count, logged_in_play_count, total_watch_seconds,
  updated_at::TEXT AS updated_at`

export function mapVideoPlayHourlyRow(row: DbVideoPlayHourlyRow): VideoPlayHourly {
  return {
    videoId: row.video_id,
    bucketHour: row.bucket_hour,
    playCount: parseInt(row.play_count, 10),
    anonPlayCount: parseInt(row.anon_play_count, 10),
    loggedInPlayCount: parseInt(row.logged_in_play_count, 10),
    totalWatchSeconds: parseInt(row.total_watch_seconds, 10),
    updatedAt: row.updated_at,
  }
}

// ── video_play_daily ──────────────────────────────────────────────────────────

export interface DbVideoPlayDailyRow {
  video_id: string
  bucket_date: string // ::TEXT
  play_count: string // BIGINT
  unique_visitor_count: string
  anon_play_count: string
  logged_in_play_count: string
  total_watch_seconds: string
  updated_at: string // ::TEXT
}

export const VIDEO_PLAY_DAILY_COLUMNS = `video_id, bucket_date::TEXT AS bucket_date,
  play_count, unique_visitor_count, anon_play_count, logged_in_play_count,
  total_watch_seconds, updated_at::TEXT AS updated_at`

export function mapVideoPlayDailyRow(row: DbVideoPlayDailyRow): VideoPlayDaily {
  return {
    videoId: row.video_id,
    bucketDate: row.bucket_date,
    playCount: parseInt(row.play_count, 10),
    uniqueVisitorCount: parseInt(row.unique_visitor_count, 10),
    anonPlayCount: parseInt(row.anon_play_count, 10),
    loggedInPlayCount: parseInt(row.logged_in_play_count, 10),
    totalWatchSeconds: parseInt(row.total_watch_seconds, 10),
    updatedAt: row.updated_at,
  }
}

// ── video_play_daily_visitors ─────────────────────────────────────────────────

export interface DbVideoPlayDailyVisitorRow {
  video_id: string
  bucket_date: string // ::TEXT
  visitor_hash: string
  first_seen_at: string // ::TEXT
}

export const VIDEO_PLAY_DAILY_VISITOR_COLUMNS = `video_id, bucket_date::TEXT AS bucket_date,
  visitor_hash, first_seen_at::TEXT AS first_seen_at`

export function mapVideoPlayDailyVisitorRow(row: DbVideoPlayDailyVisitorRow): VideoPlayDailyVisitor {
  return {
    videoId: row.video_id,
    bucketDate: row.bucket_date,
    visitorHash: row.visitor_hash,
    firstSeenAt: row.first_seen_at,
  }
}

// ── video_play_totals ─────────────────────────────────────────────────────────

export interface DbVideoPlayTotalsRow {
  video_id: string
  total_play_count: string // BIGINT
  last_played_at: string | null // ::TEXT
  updated_at: string // ::TEXT
}

export const VIDEO_PLAY_TOTALS_COLUMNS = `video_id, total_play_count,
  last_played_at::TEXT AS last_played_at, updated_at::TEXT AS updated_at`

export function mapVideoPlayTotalsRow(row: DbVideoPlayTotalsRow): VideoPlayTotals {
  return {
    videoId: row.video_id,
    totalPlayCount: parseInt(row.total_play_count, 10),
    lastPlayedAt: row.last_played_at,
    updatedAt: row.updated_at,
  }
}

// ── video_hot_scores ──────────────────────────────────────────────────────────

export interface DbVideoHotScoreRow {
  video_id: string
  hot_score: string // NUMERIC
  play_count_24h: string // BIGINT
  play_count_7d: string
  play_count_30d: string
  computed_at: string // ::TEXT
}

export const VIDEO_HOT_SCORE_COLUMNS = `video_id, hot_score, play_count_24h,
  play_count_7d, play_count_30d, computed_at::TEXT AS computed_at`

export function mapVideoHotScoreRow(row: DbVideoHotScoreRow): VideoHotScore {
  return {
    videoId: row.video_id,
    hotScore: Number(row.hot_score),
    playCount24h: parseInt(row.play_count_24h, 10),
    playCount7d: parseInt(row.play_count_7d, 10),
    playCount30d: parseInt(row.play_count_30d, 10),
    computedAt: row.computed_at,
  }
}

// ── 写入（STATS-03-A2）────────────────────────────────────────────────────────

/** insertVideoPlayEvent 入参（occurredAt 为 service 端 trusted/clamp 后 ISO；visitor_hash 来自 A1 中间件）。 */
export interface InsertVideoPlayEventInput {
  /** D-216-8 第一防线：前端确定性 64hex key，API 原样存（不重算） */
  idempotencyKey: string
  videoId: string
  sourceId: string | null
  episodeNumber: number | null
  playSessionId: string
  visitorHash: string
  visitorIsEphemeral: boolean
  ipHash: string | null
  /** D-216-5：optionalAuthenticate 填充，匿名为 null */
  userId: string | null
  watchSeconds: number
  durationSeconds: number | null
  locale: string | null
  referrerPath: string | null
  userAgentHash: string | null
  /** D-216-9：trusted/clamp 后 ISO 时间字符串 */
  occurredAt: string
  /** 服务端 ingest 时刻（与 clamp 基准同源，显式写入以保 occurred_at 回退值 == ingested_at，Codex MEDIUM-C） */
  ingestedAt: string
}

/**
 * 幂等插入 video_play_events（D-216-8）。
 * `ON CONFLICT (idempotency_key) DO NOTHING`：重复 key → 跳过、返回 `{ inserted:false }`（幂等命中）。
 * 注：第二防线 `uq_video_play_events_session_video_episode` 冲突**不被本 ON CONFLICT 捕获** → 抛 23505，
 *     由 VideoPlayEventService 校验 `err.constraint` 后当幂等成功处理（其余 23505 上抛 500，M1）。
 */
export async function insertVideoPlayEvent(
  db: Pool,
  input: InsertVideoPlayEventInput,
): Promise<{ inserted: boolean }> {
  const result = await db.query(
    `INSERT INTO video_play_events (
       idempotency_key, video_id, source_id, episode_number, event_type,
       play_session_id, visitor_hash, visitor_is_ephemeral, ip_hash, user_id,
       watch_seconds, duration_seconds, locale, referrer_path, user_agent_hash,
       occurred_at, ingested_at
     ) VALUES ($1, $2, $3, $4, 'qualified_play',
       $5, $6, $7, $8, $9,
       $10, $11, $12, $13, $14,
       $15, $16)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [
      input.idempotencyKey,
      input.videoId,
      input.sourceId,
      input.episodeNumber,
      input.playSessionId,
      input.visitorHash,
      input.visitorIsEphemeral,
      input.ipHash,
      input.userId,
      input.watchSeconds,
      input.durationSeconds,
      input.locale,
      input.referrerPath,
      input.userAgentHash,
      input.occurredAt,
      input.ingestedAt,
    ],
  )
  return { inserted: (result.rowCount ?? 0) > 0 }
}

/** 校验 sourceId 是该 video 的 active（未软删）线路（端点 INVALID_SOURCE 守卫）。 */
export async function isActiveSourceOfVideo(
  db: Pool,
  sourceId: string,
  videoId: string,
): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM video_sources
     WHERE id = $1 AND video_id = $2 AND is_active = true AND deleted_at IS NULL
     LIMIT 1`,
    [sourceId, videoId],
  )
  return (result.rowCount ?? 0) > 0
}

// ── 后台播放分析只读 query（ADR-217 / STATS-07-A）──────────────────────────────
//
// 唯一数据源 = video_play_daily（+ top-videos 的 videos join）；绝不扫 raw events / hourly / totals /
//   hot_scores / daily_visitors / users（D-217-3）。
// period 窗口 = 近 N 自然日：bucket_date ∈ [CURRENT_DATE−(N−1), CURRENT_DATE]（D-217-2）。
// 时区同源：CURRENT_DATE 与聚合 worker 的 occurred_at::date 共享单一 PG session TimeZone，
//   不在本层引入独立时区转换（D-217-2 不变量；守护见集成测 SHOW timezone 一致 + 静态 pool 无 SET TIME ZONE）。
// BIGINT/NUMERIC SUM → ::text 显式取 string，DTO 映射（裸 Number()）归 VideoPlayAnalyticsService（D-217-7/9）。
// 3 条 SQL 具名导出并汇成 VIDEO_PLAY_ANALYTICS_SQL，供数据源静态门**精确扫该常量集**
//   （不扫整文件——本文件 insertVideoPlayEvent 合法含 video_play_events 写 SQL；Codex 卡审 MEDIUM-3）。

/** overview 原始聚合行（service 映射 → VideoPlaysOverview）。 */
export interface DbVideoPlaysOverviewRow {
  total_plays: string
  total_watch_seconds: string
  anon_plays: string
  logged_in_plays: string
}

/** trend 每日点原始行（service 映射 → VideoPlaysTrendPoint）。 */
export interface DbVideoPlaysTrendRow {
  date: string // to_char YYYY-MM-DD
  plays: string
  watch_seconds: string
  anon_plays: string
  logged_in_plays: string
}

/** top-videos 榜项原始行（service 映射 → VideoPlaysTopVideo）。 */
export interface DbVideoPlaysTopVideoRow {
  short_id: string
  title: string
  plays: string
  watch_seconds: string
}

/** overview：period 窗口对 video_play_daily 全站 SUM（空窗口 COALESCE→0，聚合无 GROUP BY 恒返单行）。 */
export const SQL_VIDEO_PLAYS_OVERVIEW = `
  SELECT
    COALESCE(SUM(play_count), 0)::text           AS total_plays,
    COALESCE(SUM(total_watch_seconds), 0)::text  AS total_watch_seconds,
    COALESCE(SUM(anon_play_count), 0)::text       AS anon_plays,
    COALESCE(SUM(logged_in_play_count), 0)::text  AS logged_in_plays
  FROM video_play_daily
  WHERE bucket_date >= CURRENT_DATE - ($1::int - 1)
    AND bucket_date <= CURRENT_DATE`

/** trend：generate_series(...)::date 补齐 N 日序列 LEFT JOIN daily，缺日 zero-fill；date 严格 YYYY-MM-DD（防 TZ 漂移）。 */
export const SQL_VIDEO_PLAYS_TREND = `
  SELECT
    to_char(s.day, 'YYYY-MM-DD')                   AS date,
    COALESCE(SUM(d.play_count), 0)::text           AS plays,
    COALESCE(SUM(d.total_watch_seconds), 0)::text  AS watch_seconds,
    COALESCE(SUM(d.anon_play_count), 0)::text       AS anon_plays,
    COALESCE(SUM(d.logged_in_play_count), 0)::text  AS logged_in_plays
  FROM (
    SELECT generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day')::date AS day
  ) s
  LEFT JOIN video_play_daily d ON d.bucket_date = s.day
  GROUP BY s.day
  ORDER BY s.day ASC`

/** top-videos：period 窗口 GROUP BY video，INNER JOIN 存活视频（deleted_at IS NULL），确定性 tie-break，LIMIT。 */
export const SQL_TOP_VIDEOS_BY_PLAYS = `
  SELECT
    v.short_id                                     AS short_id,
    v.title                                        AS title,
    COALESCE(SUM(d.play_count), 0)::text           AS plays,
    COALESCE(SUM(d.total_watch_seconds), 0)::text  AS watch_seconds
  FROM video_play_daily d
  JOIN videos v ON v.id = d.video_id AND v.deleted_at IS NULL
  WHERE d.bucket_date >= CURRENT_DATE - ($1::int - 1)
    AND d.bucket_date <= CURRENT_DATE
  GROUP BY v.id, v.short_id, v.title
  ORDER BY SUM(d.play_count) DESC, SUM(d.total_watch_seconds) DESC, v.id ASC
  LIMIT $2::int`

/**
 * 数据源静态门集合（Codex 卡审 MEDIUM-3）：单测仅扫此 3 条 analytics SQL 字符串，
 * 拒禁表（events/hourly/totals/hot_scores/daily_visitors/users）、仅许 video_play_daily + videos。
 * **禁扫整 videoPlayStats.ts 源文本或函数名**——会误杀既有 STATS-03 写 SQL / 漏扫真 analytics SQL。
 */
export const VIDEO_PLAY_ANALYTICS_SQL = [
  SQL_VIDEO_PLAYS_OVERVIEW,
  SQL_VIDEO_PLAYS_TREND,
  SQL_TOP_VIDEOS_BY_PLAYS,
] as const

/** overview 原始聚合（periodDays = 近 N 自然日；映射归 service）。 */
export async function getVideoPlaysOverview(
  db: Pool,
  periodDays: number,
): Promise<DbVideoPlaysOverviewRow> {
  const result = await db.query<DbVideoPlaysOverviewRow>(SQL_VIDEO_PLAYS_OVERVIEW, [periodDays])
  return result.rows[0]
}

/** trend 原始日序列（恒 N 行有序 zero-fill；映射归 service）。 */
export async function getVideoPlaysTrend(
  db: Pool,
  periodDays: number,
): Promise<DbVideoPlaysTrendRow[]> {
  const result = await db.query<DbVideoPlaysTrendRow>(SQL_VIDEO_PLAYS_TREND, [periodDays])
  return result.rows
}

/** top-videos 原始榜（前 limit；映射归 service）。 */
export async function getTopVideosByPlays(
  db: Pool,
  periodDays: number,
  limit: number,
): Promise<DbVideoPlaysTopVideoRow[]> {
  const result = await db.query<DbVideoPlaysTopVideoRow>(SQL_TOP_VIDEOS_BY_PLAYS, [periodDays, limit])
  return result.rows
}
