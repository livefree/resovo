/**
 * external.types.ts — 外部元数据统一候选模型
 * META-04: ExternalSubjectCandidate 作为隔离层，屏蔽本地 dump 和在线 adapter 的格式差异
 */

export interface ExternalPerson {
  /** provider 侧人物 ID（豆瓣 person_id 等）*/
  id?: string
  name: string
  role?: string
}

export interface ExternalRecommendation {
  externalId: string
  title: string
  coverUrl?: string
  rating?: number
}

/**
 * Bangumi 候选条目（ADR-161 端点 2 bangumi-candidates）。
 * confidence：本地 dump 召回时为 computeLocalBangumiConfidence 结果；REST 搜索兜底为 0。
 */
export interface BangumiCandidate {
  readonly bangumiSubjectId: number
  readonly nameCn: string | null
  readonly nameJp: string | null
  readonly year: number | null
  readonly rating: number | null
  readonly coverUrl: string | null
  readonly confidence: number
}

/** Bangumi 缺口清单行（ADR-161 端点 5 gaps：有 bangumi_subject_id 但无 published video 的 catalog）。 */
export interface BangumiGapRow {
  readonly catalogId: string
  readonly bangumiSubjectId: number
  readonly title: string
  readonly year: number | null
  readonly rank: number | null
  readonly coverUrl: string | null
}

/**
 * 统一外部影视候选条目。
 * 由 mapDoubanDumpEntryToCandidate / mapDoubanAdapterDetailsToCandidate 生成，
 * MetadataEnrichService 只处理此类型，不直接依赖 dump 行或 adapter 原始类型。
 *
 * confidence / confidenceBreakdown 由匹配调用方填入（mapper 默认 0 / {}）。
 */
export interface ExternalSubjectCandidate {
  provider: 'douban' | 'bangumi' | 'tmdb'
  externalId: string
  title: string
  originalTitle?: string
  aliases?: string[]
  year?: number
  releaseDate?: string
  type?: string
  coverUrl?: string
  backdropUrl?: string
  rating?: number
  ratingVotes?: number
  genres?: string[]
  countries?: string[]
  languages?: string[]
  durationMinutes?: number
  episodeCount?: number
  episodeLength?: number
  directors?: ExternalPerson[]
  writers?: ExternalPerson[]
  cast?: ExternalPerson[]
  tags?: string[]
  imdbId?: string
  summary?: string
  trailerUrl?: string
  recommendations?: ExternalRecommendation[]
  /** 匹配置信度 0.00–1.00，由调用方赋值 */
  confidence: number
  /** 各维度置信度细目，由调用方赋值 */
  confidenceBreakdown: Record<string, number>
  /** offline = 本地 dump；online = adapter 在线抓取 */
  sourceFreshness: 'offline' | 'online'
}

// ── ADR-188 D-188-2：外部资源治理 provider registry（采集治理框架真源）──────────
// 类型 + 运行时 const 同居（对齐 route-codenames / home-section 范式）；apps/api（聚合/埋点）
// 与 apps/server-next（Tab 渲染）同源消费，杜绝双真源漂移。3 枚举不纳入 verify-enum-ssot
// 守卫（守卫专扫视频域，ADR-188 H3），消费方人工约定从 const 派生（zod z.enum(PROVIDER_KEYS) 等）。

export const PROVIDER_KEYS = ['douban', 'bangumi', 'imdb', 'tmdb'] as const
export const ACQUISITION_METHODS = ['offline', 'scrape', 'api'] as const
export const PROVIDER_CAPABILITIES = [
  'detail',
  'search',
  'collection',
  'comments',
  'schedule',
  'celebrity',
] as const

export type ProviderKey = (typeof PROVIDER_KEYS)[number]
/**
 * 获取方式：offline=本地 dump / scrape=页面抓取 / api=公共 API。
 * scrape+api 二者皆属 sourceFreshness 的 `online` 上位概念之细分（ADR-188 D-188-3 术语桥接，
 * 观测层比 sourceFreshness 更细是有意演进，不回改 sourceFreshness）。
 */
export type AcquisitionMethod = (typeof ACQUISITION_METHODS)[number]
/** 内容能力：详情 / 搜索 / 热门合集 / 评论 / 播放时间表 / 人物。 */
export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number]

export interface ExternalProvider {
  readonly key: ProviderKey
  readonly label: string
  readonly acquisition: readonly AcquisitionMethod[]
  readonly capabilities: readonly ProviderCapability[]
  /** active = 本期已接入；planned = 占位待接入（registry 仅声明，UI 渲染「待接入」） */
  readonly status: 'active' | 'planned'
}

/**
 * 外部资源 provider 注册表（ADR-188 D-188-2 单一真源）。
 * Tab 可见性由 capabilities 驱动，但每个 Tab 数据契约 provider 专属——接新 provider =
 * 追加一条 + 实现其数据/埋点 adapter，非纯配置（ADR-188 L2 诚实声明）。
 * planned provider 的 capabilities 待 API 能力调研后填（如 Bangumi 需全面调研，本期留空）。
 */
export const EXTERNAL_PROVIDERS: readonly ExternalProvider[] = [
  {
    key: 'douban',
    label: '豆瓣',
    acquisition: ['offline', 'scrape'],
    capabilities: ['detail', 'search', 'collection', 'comments', 'celebrity'],
    status: 'active',
  },
  // 以下 planned：acquisition 反映已知形态（Bangumi/IMDB/TMDb 提供公共 API），
  // capabilities 留空待调研后填（用户定调：Bangumi 需 API 能力全面调研后确定）。
  { key: 'bangumi', label: 'Bangumi', acquisition: ['api'], capabilities: [], status: 'planned' },
  { key: 'imdb', label: 'IMDB', acquisition: ['api'], capabilities: [], status: 'planned' },
  { key: 'tmdb', label: 'TMDb', acquisition: ['api'], capabilities: [], status: 'planned' },
]

/** registry 查找 helper（消费方按 key 取 provider 定义；未知 key → undefined）。 */
export function getExternalProvider(key: string): ExternalProvider | undefined {
  return EXTERNAL_PROVIDERS.find((p) => p.key === key)
}
