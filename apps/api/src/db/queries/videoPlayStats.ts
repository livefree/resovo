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
