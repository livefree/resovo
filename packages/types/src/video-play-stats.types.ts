/**
 * video-play-stats.types.ts — 视频级播放量统计体系契约（ADR-216 / SEQ-20260624-02 STATS-02-SCHEMA）
 *
 * DB 单真源：migration 128（video_play_events 事件真源 + hourly/daily/daily_visitors/totals/hot_scores 派生聚合表）。
 * 本文件提供 6 表的 TS 域类型（camelCase）；apps/api query 模块持 Db*Row（snake_case）+ mapRow。
 * 写入/聚合/读取业务逻辑归 STATS-03/04/05；本卡仅冻结类型形状。
 *
 * 时间字段统一 string（ISO，对齐 query 层 `::TEXT` 投影约定）。
 */

/** 事件类型封闭枚举（v1 单值；扩展 share/complete 走 migration 加 CHECK 值 + ADR-216 amendment，L3） */
export type VideoPlayEventType = 'qualified_play'

/**
 * video_play_events 行——append-only 可重放真源（只存 qualified play）。
 * 双重幂等：idempotencyKey UNIQUE（前端确定性）+ (playSessionId, videoId, COALESCE(episodeNumber,0)) 唯一约束。
 */
export interface VideoPlayEvent {
  id: string
  /** D-216-8 第一防线：sha256Hex(playSessionId|shortId|episodeNumber|eventType)，API 原样存 */
  idempotencyKey: string
  /** 内部 video_id（short_id 在 service 层解析为此值） */
  videoId: string
  sourceId: string | null
  episodeNumber: number | null
  eventType: VideoPlayEventType
  playSessionId: string
  /** D-216-7：HMAC(rv_vid, secret) 截断 hex，不可逆，无 PII */
  visitorHash: string
  /** D-216-7 H1：cookie 缺失 fallback 行为 true；聚合仅对 false 行计 UV */
  visitorIsEphemeral: boolean
  ipHash: string | null
  /** D-216-5：optionalAuthenticate 填充，匿名为 null；写路径不查 users */
  userId: string | null
  watchSeconds: number
  durationSeconds: number | null
  locale: string | null
  referrerPath: string | null
  userAgentHash: string | null
  /** D-216-9：service 端非对称 clamp 后的 trusted 值；所有 bucket 用此值 */
  occurredAt: string
  ingestedAt: string
  /** 不变量②：聚合幂等标记；null=未聚合（retention 永不删未聚合行） */
  aggregatedAt: string | null
}

/** video_play_hourly 行——近期趋势 + hot_score 重算数据源（D-216-3 从本表按窗口全量重算）。 */
export interface VideoPlayHourly {
  videoId: string
  bucketHour: string
  playCount: number
  anonPlayCount: number
  loggedInPlayCount: number
  totalWatchSeconds: number
  updatedAt: string
}

/** video_play_daily 行——后台分析 + week/month 近 7/30 自然日趋势真源（D-216-2）。 */
export interface VideoPlayDaily {
  videoId: string
  bucketDate: string
  playCount: number
  /** D-216-7：仅 NOT visitorIsEphemeral 行计入 */
  uniqueVisitorCount: number
  anonPlayCount: number
  loggedInPlayCount: number
  totalWatchSeconds: number
  updatedAt: string
}

/** video_play_daily_visitors 行——daily UV 去重 helper（运营表，非前台读模型）。 */
export interface VideoPlayDailyVisitor {
  videoId: string
  bucketDate: string
  visitorHash: string
  firstSeenAt: string
}

/** video_play_totals 行——O(1) 累计展示读模型（STATS-05-A 左连 + COALESCE(0)）。 */
export interface VideoPlayTotals {
  videoId: string
  totalPlayCount: number
  lastPlayedAt: string | null
  updatedAt: string
}

/** video_hot_scores 行——跨前台/搜索一致热度物化源（D-216-3 必需物化）。 */
export interface VideoHotScore {
  videoId: string
  /** = playCount24h×1.0 + playCount7d×0.3 + playCount30d×0.1（按窗口全量重算，非增量累加） */
  hotScore: number
  /** 嵌套窗口：7d 含 24h、30d 含 7d（L1） */
  playCount24h: number
  playCount7d: number
  playCount30d: number
  computedAt: string
}
