/**
 * external-meta-panel/types.ts — ExternalMetaPanel 公开 Props 契约
 * （ADR-172 AMENDMENT 3 / META-18 / arch-reviewer Opus PASS 契约）
 *
 * 纯展示原语：以 media_catalog 真源为中心 + 所有命中源并集呈现。
 * 零受控状态、零事件回调（不耦合 douban 写工作流）。
 */
import type {
  EnrichmentSummary,
  ExternalRefSummary,
  BangumiEntrySummary,
  VideoType,
} from '@resovo/types'

/** 展示密度：drawer=编辑抽屉 tab（宽松，含未命中灰显占位）/ compact=审核台右栏（紧凑，仅命中）。 */
export type ExternalMetaPanelDensity = 'drawer' | 'compact'

/**
 * 真源字段区可选展示值（media_catalog 合并字段）。
 * 内联可选对象 —— 不下发整个 row，守 admin-ui 单向依赖（不吃 server-next/api 类型）。
 */
export interface ExternalMetaCatalogFields {
  readonly titleOriginal?: string | null
  readonly rating?: number | null
  readonly ratingVotes?: number | null
  readonly metadataSource?: string | null
}

export interface ExternalMetaPanelProps {
  /** 富集摘要派生投影（驱动 4 源命中态 + ID + href）。 */
  readonly summary: EnrichmentSummary
  /** 视频类型（bangumi 源 + Bangumi 条目块仅 'anime' 渲染）。 */
  readonly type: VideoType
  /** 命中源关联列表（窄化投影）；省略 → 源总览据 summary 推导四源态。 */
  readonly externalRefs?: readonly ExternalRefSummary[]
  /** Bangumi 条目级详情（仅 anime + 命中时）；省略 → 不渲染条目块。 */
  readonly bangumiInfo?: BangumiEntrySummary
  /** 真源字段区展示值（消费方从 VideoAdminDetail 平铺取）。 */
  readonly catalogFields?: ExternalMetaCatalogFields
  /** 富集时间相对文案（消费方格式化后传入）。 */
  readonly enrichedAtLabel?: string
  /** 展示密度（默认 'drawer'）。 */
  readonly density?: ExternalMetaPanelDensity
  /** 测试钩子。 */
  readonly testId?: string
}
