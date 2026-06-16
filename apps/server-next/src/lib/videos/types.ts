import type {
  VideoType,
  VideoStatus,
  VideoGenre,
  ReviewStatus,
  VisibilityStatus,
  DoubanStatus,
  BangumiStatus,
  EnrichmentSummary,
  ExternalRefSummary,
  BangumiEntrySummary,
  CatalogCharacterSummary,
  MetadataStatusSummary,
  MetadataStatusOverall,
  MetadataProvider,
  MetadataProviderState,
  MetadataIssueLevel,
} from '@resovo/types'

export type { VideoType, VideoStatus, VideoGenre, ReviewStatus, VisibilityStatus, DoubanStatus, BangumiStatus, EnrichmentSummary, ExternalRefSummary, BangumiEntrySummary, CatalogCharacterSummary, MetadataStatusSummary, MetadataStatusOverall, MetadataProvider, MetadataProviderState, MetadataIssueLevel }

// ── 列表行（对应 GET /admin/videos 响应结构）─────────────────────

export interface VideoAdminRow {
  id: string
  short_id: string
  title: string
  title_en: string | null
  cover_url: string | null
  type: VideoType
  year: number | null
  is_published: boolean
  source_count: string
  active_source_count?: string
  total_source_count?: string
  visibility_status?: VisibilityStatus
  review_status?: ReviewStatus
  created_at: string
  updated_at?: string
  douban_status?: DoubanStatus
  meta_score?: number
  source_check_status?: string
  /** SRCHEALTH-P1-1-B（B1）：视频级试播聚合（listAdminVideos 查询时聚合，语义同构 source_check_status 四态） */
  render_check_status?: string
  poster_status?: string | null
  backdrop_status?: string | null
  // ADR-170 C-3：富集摘要派生对象（admin DTO 专属，前端 EnrichmentBadge 消费）
  enrichmentSummary?: EnrichmentSummary
  // ADR-201 / META-32-A：统一元数据状态（列表/详情注入；前端 MetadataSourceIconCluster〔META-33〕消费 / 兼容期与 enrichmentSummary 并存）
  metadataStatus?: MetadataStatusSummary
  // ── CHG-VSR-1（设计 §2.2/§2.4）：视频库重设计展示字段（加性 optional，卡 2 API 填充；与 VideoAdminDetail 同名字段签名一致）──
  /** 原名（§2.2 副行 `{title_en ?? title_original}` + 搜索 q 扩面）。与 VideoAdminDetail.title_original 同型 */
  title_original?: string | null
  /** 出品地区（§2.2 发行信息 `{year} · {country}`）。与 VideoAdminDetail.country 同型（mc.country） */
  country?: string | null
  /** 连载状态（§2.2 发行信息 Pill 完结/连载/未知，取 mc.status）。与 VideoAdminDetail.status 同型 */
  status?: VideoStatus
  /** 收录集数（§2.2 集数列，migration 078）。与 VideoAdminDetail.episode_count 同型 */
  episode_count?: number
  /** 已播集数（§2.2 集数列「已播」/ 外部领先爬虫，migration 078，可 NULL） */
  current_episodes?: number | null
  /** 总集数（§2.2 集数列「共」，migration 078，可 NULL） */
  total_episodes?: number | null
  /** Bangumi 匹配状态（§2.2 元数据 Bangumi dot，仅 anime，migration 082 / ADR-170） */
  bangumi_status?: BangumiStatus
}

// ── 列表查询参数 ──────────────────────────────────────────────────

export interface VideoListFilter {
  q?: string
  type?: VideoType
  status?: 'published' | 'pending' | 'all'
  visibilityStatus?: VisibilityStatus
  reviewStatus?: ReviewStatus
  site?: string
  // ── CHG-VSR-2（设计 §2.6 / ADR-150 AMENDMENT）：三层过滤入参（与后端 AdminVideoListFilters 同名 / CSV 多选由 api 层序列化）──
  /** type 多选（加性，与单值 type 并存） */
  types?: readonly VideoType[]
  /** 年份范围（mc.year） */
  yearMin?: number
  yearMax?: number
  /** 出品地区多选（mc.country / distinct media_catalog.country） */
  country?: readonly string[]
  /** 连载状态多选（mc.status） */
  catalogStatus?: readonly VideoStatus[]
  /** 发布布尔（v.is_published） */
  isPublished?: boolean
  /** 豆瓣匹配状态多选 */
  doubanStatus?: readonly DoubanStatus[]
  /** Bangumi 匹配状态多选（仅 anime） */
  bangumiStatus?: readonly BangumiStatus[]
  /** 元数据完整度范围（0–100） */
  metaScoreMin?: number
  metaScoreMax?: number
  /** 快捷筛选派生 boolean（仅 true 生效） */
  episodeMismatch?: boolean
  episodeMissing?: boolean
  metaIncomplete?: boolean
  pendingReview?: boolean
  // ── META-32-B（ADR-201 §视频库 过滤）：元数据状态筛选（镜像后端 AdminVideoListFilters；CSV 多选由 api 层序列化）──
  /** 整体状态多选（overall） */
  metadataOverall?: readonly MetadataStatusOverall[]
  /** 单列 provider facet 多选（META-36-A：选中 provider 任一有数据 OR 合流） */
  metadataProvider?: readonly MetadataProvider[]
  /** 单源状态多选（任一 provider state ∈ 集合） */
  metadataProviderState?: readonly MetadataProviderState[]
  /** 问题等级多选 */
  metadataIssueLevel?: readonly MetadataIssueLevel[]
  /** 最近增强时间范围（enriched_at，ISO8601） */
  metadataUpdatedFrom?: string
  metadataUpdatedTo?: string
  /** 元数据快捷筛选派生 boolean（仅 true 生效） */
  metadataNeedsReview?: boolean
  metadataHasCandidate?: boolean
  metadataMissing?: boolean
  metadataTmdbPending?: boolean
  /** AMD2-PATCH-2（2026-05-24）+ CHG-VSR-2（+episode_count）+ SRCHEALTH-P1-1-B（+探测/试播聚合）+ META-32-B（+元数据）：同步后端 SORT_FIELDS */
  sortField?: 'title' | 'type' | 'year' | 'created_at' | 'updated_at'
    | 'source_health' | 'visibility' | 'review_status' | 'douban_status' | 'meta_score' | 'episode_count'
    | 'source_check_status' | 'render_check_status' | 'metadata_status' | 'metadata_score'
  sortDir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// ── 列表响应 ──────────────────────────────────────────────────────

export interface VideoListResult {
  data: VideoAdminRow[]
  total: number
  page: number
  limit: number
}

// ── 单条详情（含未发布字段）──────────────────────────────────────

export interface VideoAdminDetail extends VideoAdminRow {
  description: string | null
  title_en: string | null
  genres: VideoGenre[]
  country: string | null
  episode_count: number
  status: VideoStatus
  rating: number | null
  director: string[]
  cast: string[]
  writers: string[]
  douban_id: string | null
  // ADR-172 AMENDMENT 3：真源字段区（catalogFields 镜像；api raw row 已 select）
  title_original?: string | null
  // ADR-206 D-206-9（3B-1）：原语种 + 结构化 manual aka（编辑/快编回填真源；aliases 仅 source=manual∧kind=aka）
  original_language?: string | null
  aliases?: string[]
  rating_votes?: number | null
  metadata_source?: string | null
  // ADR-172 AMENDMENT 3：外部源并集（仅 adminFindById 注入，列表不带）
  externalRefs?: readonly ExternalRefSummary[]
  bangumiInfo?: BangumiEntrySummary  // 仅 anime + 命中时存在
  // ADR-161 AMENDMENT / META-19：bangumi 角色 + CV（仅 anime + 命中时存在）
  bangumiCharacters?: readonly CatalogCharacterSummary[]
}

// ── 元数据编辑 Patch ──────────────────────────────────────────────

export interface VideoMetaPatch {
  title?: string
  titleEn?: string | null
  description?: string | null
  coverUrl?: string | null
  type?: VideoType
  genres?: VideoGenre[]
  year?: number | null
  country?: string | null
  episodeCount?: number
  status?: VideoStatus
  rating?: number | null
  director?: string[]
  cast?: string[]
  writers?: string[]
  doubanId?: string | null
}

// ── 状态迁移动作 ──────────────────────────────────────────────────

export type StateTransitionAction =
  | 'approve'
  | 'approve_and_publish'
  | 'reject'
  | 'reopen_pending'
  | 'publish'
  | 'unpublish'
  | 'set_internal'
  | 'set_hidden'
  | 'staging_revert'  // M-SN-4 D-01：暂存退回待审核（approved+internal/hidden+0 → pending_review）

// ── 采集站点 ──────────────────────────────────────────────────────

export interface CrawlerSite {
  key: string
  name: string
}

// ── 视频线路（GET /admin/sources?videoId=<id> 行结构）────────────
// 字段命名保持 snake_case 与 API 响应一致

export type SignalStatus = 'pending' | 'ok' | 'partial' | 'dead'
export type ImageStatus = 'pending_review' | 'ok' | 'broken' | 'unknown'
export type VideoImageKind = 'poster' | 'backdrop' | 'logo' | 'banner_backdrop'

export interface VideoSource {
  readonly id: string
  readonly video_id: string
  readonly source_url: string
  readonly source_name: string
  readonly is_active: boolean
  readonly last_checked: string | null
  readonly created_at: string
  /** Migration 061 行级乐观锁版本字段（CHG-SN-5-PRE-01-C） */
  readonly updated_at: string
  readonly episode_number: number
  readonly season_number: number
  readonly source_site_key: string | null
  readonly site_key: string | null
  readonly type: string
  readonly probe_status: SignalStatus
  readonly render_status: SignalStatus
  readonly latency_ms: number | null
  readonly last_probed_at: string | null
  readonly last_rendered_at: string | null
  readonly quality_detected: string | null
  readonly quality_source: string
  readonly resolution_width: number | null
  readonly resolution_height: number | null
  readonly detected_at: string | null
  readonly video_title: string | null
}

// ── 视频图片（GET /admin/videos/:id/images 响应）─────────────────

export interface ImageSlotInfo {
  readonly url: string | null
  readonly status: ImageStatus | null
}

export interface VideoImagesData {
  readonly poster: ImageSlotInfo
  readonly backdrop: ImageSlotInfo
  readonly logo: ImageSlotInfo
  readonly banner_backdrop: ImageSlotInfo
  readonly lastStatusUpdatedAt: string | null
}

// ── 豆瓣搜索候选（POST /admin/moderation/:id/douban-search 响应）

export interface DoubanSuggestItem {
  readonly id: string
  readonly title: string
  readonly year: string
  readonly sub_title: string
}

// ── TMDB 候选（POST /admin/videos/:id/tmdb-search 响应，ADR-202 / META-39-B；镜像后端 TmdbCandidate）
export type TmdbMediaType = 'movie' | 'tv'
export interface TmdbCandidate {
  readonly tmdbId: number
  readonly mediaType: TmdbMediaType
  readonly title: string
  readonly originalTitle: string
  readonly originalLanguage: string
  readonly year: string | null
  readonly overview: string
  readonly posterUrl: string | null
}

// ── 豆瓣字段对比（GET /admin/moderation/:id/douban-candidate 响应）

export interface DoubanFieldDiff {
  readonly field: string
  readonly label: string
  readonly current: string | null
  readonly proposed: string | null
  readonly changed: boolean
}

export interface DoubanCandidateData {
  readonly externalRefId: string
  readonly externalId: string
  readonly confidence: number | null
  readonly matchMethod: string | null
  readonly breakdown: Record<string, number> | null
  readonly diffs: readonly DoubanFieldDiff[]
}
