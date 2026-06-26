/**
 * search-filter-taxonomy.ts — 前台分类/搜索页统一筛选区契约 SSOT（HANDOFF-37）
 *
 * 5 维行内互斥单选，顺序固定：type → genre → country → lang → year。
 * 设计原则（arch-reviewer Opus 定稿）：
 *   - 单一 FILTER_TAXONOMY 配置常量，消费方只读不判（不在前台 switch(dim)）。
 *   - 值来源判别字段（valueSource）统一表达「枚举/category/curated/computed」四种来源。
 *   - label 来源判别字段（labelSource）统一表达「i18n key / videoType 命名空间 / country formatter」。
 *   - year 为计算维度（currentYear 倒推 N），值由前台按 source 派生，types 不写死年份。
 *   - type 维度值集合 + URL 映射留在 web-next lib/categories.ts（ADR-048 真源），
 *     taxonomy 仅声明 valueSource='category'，不复制其内容（禁止 types → web-next 依赖）。
 */

/** 5 个筛选维度（顺序即展示顺序，固定）。 */
export const FILTER_DIMENSIONS = ['type', 'genre', 'country', 'lang', 'year'] as const
export type FilterDimension = (typeof FILTER_DIMENSIONS)[number]

/**
 * 值来源判别字段：
 *   'category'      → web-next lib/categories.ts 注入（含 tvshow→variety URL 映射，ADR-048）
 *   'enum-genre'    → VIDEO_GENRES 直接 map
 *   'enum-lang'     → AUDIO_LANGUAGE_CANONICALS 直接 map
 *   'curated'       → CURATED_FILTER_COUNTRIES（人工有序 ISO 列表）
 *   'computed-year' → 前台计算（currentYear 倒推 YEAR_FILTER_SPAN）
 */
export type FilterValueSource =
  | 'category'
  | 'enum-genre'
  | 'enum-lang'
  | 'curated'
  | 'computed-year'

/**
 * label 来源判别字段（消费方据此决定如何取显示文案，零硬编码）：
 *   'i18n'         → t(`${i18nKeyPrefix}.${value}`)
 *   'videoType'    → t(`videoType.${value}`)（type 维度专用，复用既有命名空间，避免文案三处重复）
 *   'country-name' → formatCountryName(code, locale)（无 i18n key）
 */
export type FilterLabelSource = 'i18n' | 'videoType' | 'country-name'

/** 单维度配置（valueSource + labelSource 双判别字段；消费方据此派生值集合并取 label）。 */
export interface FilterDimensionConfig {
  readonly dim: FilterDimension
  /** 维度行标签 i18n key（统一 filter.dim.<dim>）。 */
  readonly dimLabelKey: string
  readonly valueSource: FilterValueSource
  readonly labelSource: FilterLabelSource
  /** labelSource==='i18n' 时的 key 前缀（如 'filter.genre'）；否则 undefined。 */
  readonly i18nKeyPrefix?: string
}

/**
 * 维度配置真源（顺序 = 展示顺序）。
 * 消费方：for (const cfg of FILTER_TAXONOMY) → 按 valueSource 派生值集合，按 labelSource 取 label。
 */
export const FILTER_TAXONOMY: readonly FilterDimensionConfig[] = [
  {
    dim: 'type',
    dimLabelKey: 'filter.dim.type',
    valueSource: 'category', // 值 + URL 映射来自 web-next lib/categories.ts（ADR-048）
    labelSource: 'videoType', // t(`videoType.${entry.videoType}`)
  },
  {
    dim: 'genre',
    dimLabelKey: 'filter.dim.genre',
    valueSource: 'enum-genre', // ← VIDEO_GENRES
    labelSource: 'i18n',
    i18nKeyPrefix: 'filter.genre',
  },
  {
    dim: 'country',
    dimLabelKey: 'filter.dim.country',
    valueSource: 'curated', // ← CURATED_FILTER_COUNTRIES
    labelSource: 'country-name', // formatCountryName(code, locale)，无 i18n key
  },
  {
    dim: 'lang',
    dimLabelKey: 'filter.dim.lang',
    valueSource: 'enum-lang', // ← AUDIO_LANGUAGE_CANONICALS（规范词本身中文）
    labelSource: 'i18n',
    i18nKeyPrefix: 'filter.lang',
  },
  {
    dim: 'year',
    dimLabelKey: 'filter.dim.year',
    valueSource: 'computed-year', // 前台 currentYear 倒推 YEAR_FILTER_SPAN
    labelSource: 'i18n', // 仅「全部」项走 filter.allOption；年份数字本身直显
    i18nKeyPrefix: 'filter.year',
  },
] as const

/** year 维度倒推年数（含当年）。改此值不需动其它逻辑。 */
export const YEAR_FILTER_SPAN = 6 as const

/**
 * curated 出品地区 ISO 3166-1 alpha-2 列表（产品定义集合，非 DISTINCT country）。
 * ⚠ PLACEHOLDER — 候选 10 国待产品确认（HANDOFF-37 follow-up）。
 * 列表顺序 = 展示顺序（curated 即人工排序，消费方禁止再 sort）。
 * 显示名经 formatCountryName(code, locale)；本常量不含中文名（i18n 零硬编码）。
 */
export const CURATED_FILTER_COUNTRIES = [
  'CN', 'HK', 'TW', 'US', 'JP', 'KR', 'GB', 'FR', 'TH', 'IN',
] as const
export type CuratedFilterCountry = (typeof CURATED_FILTER_COUNTRIES)[number]

/** 视频网格排序选项（添加时间 / 人气 / 评分）。label: filter.sort.<value>。 */
export const SORT_OPTIONS = ['latest', 'hot', 'rating'] as const
export type SortOption = (typeof SORT_OPTIONS)[number]
export const DEFAULT_SORT: SortOption = 'latest'

/**
 * 搜索页排序选项：在网格 3 项前置「相关度」(relevance = 搜索默认，按搜索相关性)。
 * 分类页用 SORT_OPTIONS（后端 /videos 无 relevance 语义）；搜索页用本集合（后端 /search 支持 relevance）。
 * SearchSortOption ⊇ SortOption；relevance 默认高亮且可点回，消除搜索排序回不到默认的死角。
 * label: filter.sort.<value>。
 */
export const SEARCH_SORT_OPTIONS = ['relevance', 'latest', 'hot', 'rating'] as const
export type SearchSortOption = (typeof SEARCH_SORT_OPTIONS)[number]
export const DEFAULT_SEARCH_SORT: SearchSortOption = 'relevance'
