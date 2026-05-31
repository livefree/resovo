/**
 * video.types.ts — 视频内容类型
 */

// ── 枚举 ─────────────────────────────────────────────────────────

/** VideoType 全集（ADR-157 D-157-1：const + type 派生双形态 / 对齐 SPEED_PRESETS 范式） */
export const VIDEO_TYPES = [
  'movie',       // 电影
  'series',      // 连续剧 / 电视剧
  'anime',       // 动画
  'variety',     // 综艺（含游戏类综艺）
  'documentary', // 纪录片
  'short',       // 短剧 / 短片
  'sports',      // 体育赛事
  'music',       // 音乐节目
  'news',        // 新闻 / 时事
  'kids',        // 儿童内容
  'other',       // 其他
] as const
export type VideoType = typeof VIDEO_TYPES[number]

/** ContentFormat 全集（ADR-157 D-157-1） */
export const CONTENT_FORMATS = ['movie', 'episodic', 'collection', 'clip'] as const
export type ContentFormat = typeof CONTENT_FORMATS[number]

/** EpisodePattern 全集（ADR-157 D-157-1） */
export const EPISODE_PATTERNS = ['single', 'multi', 'ongoing', 'unknown'] as const
export type EpisodePattern = typeof EPISODE_PATTERNS[number]

/** VideoStatus 全集（ADR-157 D-157-1） */
export const VIDEO_STATUSES = ['ongoing', 'completed'] as const
export type VideoStatus = typeof VIDEO_STATUSES[number]

// ── 内容治理（Migration 016）────────────────────────────────────
/** ReviewStatus 全集（ADR-157 D-157-1） */
export const REVIEW_STATUSES = ['pending_review', 'approved', 'rejected'] as const
export type ReviewStatus = typeof REVIEW_STATUSES[number]

/** VisibilityStatus 全集（ADR-157 D-157-1） */
export const VISIBILITY_STATUSES = ['public', 'internal', 'hidden'] as const
export type VisibilityStatus = typeof VISIBILITY_STATUSES[number]

// ── 榜单标签（Migration 051，ADR-052）────────────────────────────
/** 人工运营榜单标签，与 home_modules.top10 slot 配合使用；不与 period-based trending 混淆 */
/** TrendingTag 全集（ADR-157 D-157-1） */
export const TRENDING_TAGS = ['hot', 'weekly_top', 'editors_pick', 'exclusive'] as const
export type TrendingTag = typeof TRENDING_TAGS[number]

// ── 流水线辅助状态（Migration 032，Pipeline Overhaul）────────────
/** 豆瓣匹配状态：自动丰富 Job 写入（ADR-157 D-157-1 双形态） */
export const DOUBAN_STATUSES = ['pending', 'matched', 'candidate', 'unmatched'] as const
export type DoubanStatus = typeof DOUBAN_STATUSES[number]

/**
 * Bangumi 匹配状态（videos.bangumi_status / ADR-170）：镜像 DOUBAN_STATUSES 四态。
 * 由 BangumiService（matchAndEnrich auto/candidate/none + confirmMatch）写入；
 * 非 anime 视频恒 'pending'（UI 据 video.type 决定不渲染 bangumi 徽标）。
 * ⚠ 数组值须与 migration 082 的 `CHECK (bangumi_status IN (...))` 保持同步。
 */
export const BANGUMI_STATUSES = ['pending', 'matched', 'candidate', 'unmatched'] as const
export type BangumiStatus = typeof BANGUMI_STATUSES[number]

/** 源活性批量检验结果（ADR-157 D-157-1 双形态） */
export const SOURCE_CHECK_STATUSES = ['pending', 'ok', 'partial', 'all_dead'] as const
export type SourceCheckStatus = typeof SOURCE_CHECK_STATUSES[number]

/**
 * 豆瓣匹配方式：MetadataEnrichService 自动写入（4 自动方式）+ DoubanService 手动确认（2 手动方式）。
 *
 * 自动：imdb_id / title (title_norm 精确) / alias (alias 精确) / network (Step2 搜索)
 * 手动：manual (整条目确认 confirmSubject) / manual_fields (字段级确认 confirmFields)
 *
 * 与 `video_external_refs.match_method` 自由字符串生态保持同义（Migration 041 注释规约：
 * title_year_type / imdb_id / alias_year / manual）。
 */
export const DOUBAN_MATCH_METHODS = [
  'imdb_id', 'title', 'alias', 'network',
  'manual', 'manual_fields',
] as const
export type DoubanMatchMethod = typeof DOUBAN_MATCH_METHODS[number]

/**
 * 豆瓣匹配状态（meta_quality.douban_match_status）：4 真源对齐
 * `video_external_refs.match_status` (`'auto_matched' | 'manual_confirmed' | 'candidate' | 'rejected'`)
 * + 增 `'unmatched'` 表示"enrich 时无候选"（refs 表对应不存在记录而非 rejected）。
 */
export const DOUBAN_MATCH_STATUSES = [
  'auto_matched', 'candidate', 'manual_confirmed', 'unmatched',
] as const
export type DoubanMatchQualityStatus = typeof DOUBAN_MATCH_STATUSES[number]

/**
 * VideoMetaQuality — videos.meta_quality jsonb 信号字典（Migration 077，CHG-365-A2）
 *
 * 由 MetadataEnrichService（自动 enrich）+ DoubanService（手动 confirm/ignore）写入，
 * 集中存放可观测信号；前端只读，审核台 TabDetail 用于驱动"重新匹配"提示。
 *
 * 写入路径（必须同步更新，避免 stale / Codex stop-time review #8 回归）：
 *   - 自动：MetadataEnrichService.enrich （写完整信号）
 *   - 手动确认：DoubanService.confirmSubject / confirmFields（manual / manual_fields + confidence=1）
 *   - 手动忽略：moderation.douban-ignore route（status=unmatched 且 confidence/method 清零）
 *
 * 所有字段可选（jsonb 局部更新 / 信号缺失允许 / 前端必须容忍）。
 */
export interface VideoMetaQuality {
  /** PinyinDetector (CHG-365-A1) 判断 media_catalog.title_en 是否实际为中文拼音 */
  title_en_is_pinyin?: boolean
  /** 豆瓣命中置信度 0..1（auto 算分 / manual confirm = 1.0 / manual ignore 清零为 undefined） */
  douban_confidence?: number
  /** 豆瓣匹配方式（自动 4 / 手动 2） */
  douban_match_method?: DoubanMatchMethod
  /** 豆瓣匹配状态 */
  douban_match_status?: DoubanMatchQualityStatus
  /** Service 写入时刻（ISO 8601 / 用于"上次丰富时间"显示与重跑判断 / 任何写入路径都更新） */
  enriched_at?: string
}

/**
 * EnrichmentSummary — 富集摘要派生投影（ADR-170 D-170-5 / C-3）。
 *
 * 服务端展开 `meta_quality` JSON + 平铺列，**仅后台 DTO**（VideoAdminRow/Detail）经
 * `buildEnrichmentSummary` 在 admin 路径注入；不挂 public `Video` / `mapVideoRow`（R-5）。
 * 供前端 EnrichmentBadge（ADR-172）直接消费，避免各页自解析零散 JSON。
 *
 * 纯派生：由同一 row 字段单次构造（doubanStatus = row.douban_status 等同源），禁止与平铺字段异源双写。
 */
export interface EnrichmentSummary {
  doubanStatus: DoubanStatus
  bangumiStatus: BangumiStatus            // 非 anime 恒 'pending'，UI 据 type 不渲染
  sourceCheckStatus: SourceCheckStatus
  metaScore: number                        // 0–100
  enrichedAt: string | null                // ← meta_quality.enriched_at
  titleEnIsPinyin: boolean                 // ← meta_quality.title_en_is_pinyin（缺省 false）
  doubanConfidence: number | null          // ← meta_quality.douban_confidence
  bangumiSubjectId: number | null          // ← media_catalog.bangumi_subject_id
  // ADR-172 AMENDMENT 2：外部源 ID（logo state 推导 + 外部页跳链）。
  doubanId: string | null                  // ← media_catalog.douban_id（豆瓣 logo href）
  tmdbId: number | null                    // ← media_catalog.tmdb_id（命中=非空 / TMDB logo）
  imdbId: string | null                    // ← media_catalog.imdb_id（命中=非空 / IMDb logo）
}

// ── 外部元数据展示层（ADR-172 AMENDMENT 3 / 真源并集视图）────────────

/**
 * 外部数据源标识（4 源）。下沉自 apps/api externalData.ts（D-172-AMD3-1：避免四源枚举三处重复）。
 * api 层 ExternalRefProvider 改为 import type 复用本定义；与 admin-ui SourceLogoKind 取值一致。
 */
export const EXTERNAL_REF_PROVIDERS = ['douban', 'tmdb', 'bangumi', 'imdb'] as const
export type ExternalRefProvider = typeof EXTERNAL_REF_PROVIDERS[number]

/** 外部关联匹配状态（4 态）。下沉自 apps/api externalData.ts（D-172-AMD3-1）。 */
export const EXTERNAL_REF_MATCH_STATUSES = [
  'auto_matched', 'manual_confirmed', 'candidate', 'rejected',
] as const
export type ExternalRefMatchStatus = typeof EXTERNAL_REF_MATCH_STATUSES[number]

/**
 * ExternalRefSummary — video_external_refs 面向展示的窄化投影（ADR-172 AMENDMENT 3 / D-172-AMD3-2）。
 *
 * 剔除写工作流/审计字段（id / videoId / linkedAt / linkedBy / notes）—— 纯展示不消费，
 * 且不诱导消费方做写操作。保留 matchMethod（运营判「靠什么匹配上」）。
 * 仅 admin 详情 DTO（adminFindById）注入；不挂 public Video / mapVideoRow（R-5）。
 */
export interface ExternalRefSummary {
  provider: ExternalRefProvider
  externalId: string
  matchStatus: ExternalRefMatchStatus
  matchMethod: string | null
  confidence: number | null  // 0..1
  isPrimary: boolean
}

/**
 * BangumiEntrySummary — bangumi_entries 条目级展示投影（ADR-172 AMENDMENT 3 / D-172-AMD3-2）。
 *
 * 来自 external_data.bangumi_entries（本地 dump，经 findBangumiById）。
 * 注意（D-172-AMD3-A）：dump 条目无 rating_votes —— votes 属 media_catalog 真源合并值，
 * 不进本对象（异源不混）。仅 type==='anime' 且命中 bangumi 时由 Service 注入；否则 undefined。
 */
export interface BangumiEntrySummary {
  bangumiId: number
  titleCn: string | null
  titleJp: string | null
  year: number | null
  rating: number | null   // 0..10
  summary: string | null
  airDate: string | null
  coverUrl: string | null
  rank: number | null
  nsfw: boolean
}

/** VideoGenre — 内容题材（与 VideoType 内容形式严格正交）
 *
 * 对齐豆瓣视频分类（2026-04-22 META-10 对齐表）：
 *   豆瓣"动画 / 纪录片 / 短片 / 儿童"由 VideoType 承载，不占 genre；
 *   豆瓣"同性 / 情色"不纳入枚举，raw 保留至 source_category，审核区人工处理。
 *   详见 docs/video_type_genre_alignment_20260422.md
 */
/** VideoGenre 全集（ADR-157 D-157-1） */
export const VIDEO_GENRES = [
  'action',       // 动作
  'comedy',       // 喜剧
  'romance',      // 爱情
  'thriller',     // 惊悚
  'horror',       // 恐怖
  'sci_fi',       // 科幻
  'fantasy',      // 奇幻 / 魔幻 / 玄幻
  'history',      // 历史 / 古装
  'crime',        // 犯罪
  'mystery',      // 悬疑 / 黑色电影
  'war',          // 战争
  'family',       // 家庭 / 亲情
  'biography',    // 传记 / 人物
  'martial_arts', // 武侠 / 功夫（华语扩展）
  'adventure',    // 冒险
  'disaster',     // 灾难
  'musical',      // 歌舞 / 音乐
  'western',      // 西部
  'sport',        // 运动（注意与 VideoType.sports 区分：前者为题材，后者为形式）
  'other',        // 其他
] as const
export type VideoGenre = typeof VIDEO_GENRES[number]

/** VideoQuality 全集（ADR-157 D-157-1 双形态） */
export const VIDEO_QUALITIES = ['4K', '1080P', '720P', '480P', '360P'] as const
export type VideoQuality = typeof VIDEO_QUALITIES[number]

/** SourceType 全集（ADR-157 D-157-1 双形态） */
export const SOURCE_TYPES = ['hls', 'mp4', 'dash'] as const
export type SourceType = typeof SOURCE_TYPES[number]

// ── 视频实体 ─────────────────────────────────────────────────────

export interface Video {
  id: string
  shortId: string          // 8 位 nanoid，URL 使用
  slug: string | null      // SEO 路径段，如 attack-on-titan
  title: string            // 中文标题
  titleEn: string | null   // 英文原名
  description: string | null
  coverUrl: string | null  // Cloudflare R2 URL
  type: VideoType
  genres: VideoGenre[]
  rating: number | null    // 0-10
  year: number | null
  country: string | null   // ISO 3166-1 alpha-2，如 JP、US、CN
  episodeCount: number     // 电影为 1
  status: VideoStatus
  director: string[]       // 导演列表
  cast: string[]           // 演员/声优列表
  writers: string[]        // 编剧列表
  sourceCount: number      // 可用播放源数量（冗余字段）
  subtitleLangs: string[]  // 已有字幕语言列表，BCP 47
  // 类型判定辅助字段（Migration 013）
  sourceContentType: string | null  // 爬虫原样写入的源站类型字符串
  normalizedType: string | null     // 平台规范化分类
  contentFormat: ContentFormat | null
  episodePattern: EpisodePattern | null
  // 内容治理字段（Migration 016）
  reviewStatus: ReviewStatus
  visibilityStatus: VisibilityStatus
  needsManualReview: boolean
  contentRating: 'general' | 'adult'      // 内容分级（adult 为隐藏，未来专区门控）
  createdAt: string
  // 三层架构字段（CHG-371）
  catalogId: string | null
  imdbId: string | null
  tmdbId: number | null
  // META-06/08 扩展字段（来自 media_catalog）
  titleOriginal: string | null
  aliases: string[]
  languages: string[]
  tags: string[]
  ratingVotes: number | null
  runtimeMinutes: number | null
  // 流水线辅助字段（Migration 032）
  doubanStatus: DoubanStatus
  sourceCheckStatus: SourceCheckStatus
  /** 元数据完整度评分 0-100 */
  metaScore: number
  /** 元数据信号字典（Migration 077，CHG-365-A2）— null 表示尚未 enrich */
  metaQuality: VideoMetaQuality | null
  /**
   * 作品总集数（Migration 078，ADR-163 / CHG-367-B-A）— 外部 metadata 真源
   * NULL = 未从外部取到 / 电影类型保持 NULL。完结后定值；连载中可能 NULL 或预告值。
   * 与 `episodeCount`（已收录最大集数）+ `currentEpisodes`（已播集数）三层语义。
   * 注意：admin-ui LineAggregate.totalEpisodes 是行级（线路 episodes 行数），同名不同层级。
   */
  totalEpisodes: number | null
  /**
   * 当前已播集数（Migration 078，ADR-163 / CHG-367-B-A）— 外部 metadata 真源
   * NULL = 未取到 / 连载中持续更新 / 完结后等于 totalEpisodes（或外部源独立提供）。
   */
  currentEpisodes: number | null
  // 榜单标签（Migration 051，ADR-052）
  trendingTag: TrendingTag | null
  // 图片治理字段（IMG-01，ADR-046）——前台渲染最小集，由 media_catalog JOIN 提供
  // 字段必须存在（API 响应不省略），值可为 null（尚未治理时）
  posterBlurhash: string | null
  posterStatus: string | null
  backdropBlurhash: string | null
  backdropStatus: string | null
  logoUrl: string | null
  logoStatus: string | null
}

// ── 视频卡片（列表用，字段较少）────────────────────────────────

export type VideoCard = Pick<
  Video,
  'id' | 'shortId' | 'slug' | 'title' | 'titleEn' |
  'coverUrl' | 'posterBlurhash' | 'posterStatus' |
  'type' | 'rating' | 'year' | 'status' |
  'episodeCount' | 'sourceCount' | 'subtitleLangs'
>

// ── 播放源 ───────────────────────────────────────────────────────

export interface VideoSource {
  id: string
  videoId: string
  episodeNumber: number | null  // null 表示电影
  sourceUrl: string             // 第三方直链（ADR-001：不做代理）
  sourceName: string            // 如"线路1"
  /** CHG-412: crawler_sites.display_name，用于前台线路命名；未配置时为 null */
  siteDisplayName: string | null
  quality: VideoQuality | null
  type: SourceType
  isActive: boolean
  lastChecked: string | null
  /**
   * CHG-352 / route-labeling Phase 1 Layer A：effective_score (0.0–1.0)
   * 后端 SourceService.listSources 计算 + 排序；前台 SourceBar 按此分值渲染主题标签
   * arch-reviewer (claude-opus-4-7) R1：可选字段（防破坏既有 5 处消费方 / mock factory）
   */
  effectiveScore?: number
}

// ── 字幕 ─────────────────────────────────────────────────────────

export type SubtitleFormat = 'vtt' | 'srt' | 'ass'

export interface Subtitle {
  id: string
  videoId: string
  episodeNumber: number | null
  language: string         // BCP 47，如 zh-CN、en、ja
  label: string            // 显示名称，如"中文简体"
  fileUrl: string          // R2 URL
  format: SubtitleFormat
  isVerified: boolean      // 版主审核通过
  createdAt: string
}

// ── 标签 ─────────────────────────────────────────────────────────

export interface Tag {
  id: string
  name: string             // 中文标签名
  nameEn: string | null    // 英文标签名
  category: string | null  // 如 genre、theme
}

// ── 请求参数 ─────────────────────────────────────────────────────

export interface VideoListParams {
  type?: VideoType
  genre?: VideoGenre    // 单值过滤参数（后端使用 @> 数组包含查询）
  year?: number
  country?: string
  ratingMin?: number
  sort?: 'hot' | 'rating' | 'latest'
  page?: number
  limit?: number
}

export interface TrendingParams {
  period?: 'today' | 'week' | 'month'
  type?: VideoType
}

export interface SourceReportInput {
  reason: 'broken' | 'low_quality' | 'wrong_episode' | 'other'
}

// ── 图片治理（IMG-01，ADR-046）─────────────────────────────────

export type ImageKind =
  | 'poster'
  | 'backdrop'
  | 'logo'
  | 'banner_backdrop'
  | 'stills'
  | 'thumbnail'

export type ImageStatus = 'ok' | 'missing' | 'broken' | 'low_quality' | 'pending_review'

export interface BrokenImageEvent {
  id: string
  videoId: string
  seasonNumber: number | null
  episodeNumber: number | null
  imageKind: ImageKind
  url: string
  urlHashPrefix: string    // sha256(url) 前 16 位十六进制
  bucketStart: string      // ISO 8601，floor(time, 10min)
  eventType: string
  firstSeenAt: string
  lastSeenAt: string
  occurrenceCount: number
  resolvedAt: string | null
  resolutionNote: string | null
}

export interface VideoEpisodeImage {
  id: string
  videoId: string
  seasonNumber: number
  episodeNumber: number
  thumbnailUrl: string | null
  thumbnailBlurhash: string | null
  thumbnailStatus: ImageStatus
  createdAt: string
  updatedAt: string
}

export interface SubtitleUploadInput {
  language: string
  episode?: number
  file: File
}
