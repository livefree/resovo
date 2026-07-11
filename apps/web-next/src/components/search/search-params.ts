/**
 * search-params — /search 筛选维度真源（SEARCH-FE-4 提取，SearchPage + SearchEmptyState 复用）
 *
 * 写入方：FilterArea 写 type/genre/country/lang/year；详情页 MetaChip 写
 * director/actor/writer/genre/year/country。后端 /search 全部支持精确过滤
 * （director/actor/writer 走 .keyword），q 可选——facet-only 亦可检索。
 */

export const FILTER_KEYS = [
  'type',
  'genre',
  'country',
  'lang',
  'year',
  'director',
  'actor',
  'writer',
] as const

/** URL 是否带任一筛选维——无 q 但有 facet（如 MetaChip 的 director）时也应发搜索请求。 */
export function hasFacet(sp: URLSearchParams): boolean {
  return FILTER_KEYS.some((k) => !!sp.get(k))
}
