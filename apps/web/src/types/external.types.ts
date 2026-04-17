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
