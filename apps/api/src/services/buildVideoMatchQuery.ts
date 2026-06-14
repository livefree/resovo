/**
 * buildVideoMatchQuery.ts — videos ES 匹配子句单一真源（ADR-200 D-200-3）
 *
 * 仅产出「匹配 must/should」子句（字段权重 / fuzziness / 分词），**不含任何可见性 filter**。
 * 公开 `SearchService`（强制 public/approved/visible/general 四过滤）与后台 `AdminSearchService`
 * （后台可见性规则，含待审/草稿/隐藏/受限）各自拼接自己的 filter，共用本匹配定义 —— 字段权重
 * 与分词单一真源、可见性分治，避免两套 ES query 漂移。
 */

/** ES 查询子句（用 Record 避免 ES SDK 复杂 overload，与 SearchService 内部约定一致） */
export type EsMatchClause = Record<string, unknown>

/** videos 全文匹配字段权重（title 拼音 / 别名 / 英文名 / 原名 / 标签 / 简介） */
const VIDEO_MATCH_FIELDS = [
  'title^3',
  'title.pinyin',
  'title_en^2',
  'title_original^2',
  'aliases^2',
  'tags',
  'description',
] as const

/**
 * 构造 videos 全文匹配 must 子句数组。
 * q 为空串（或仅由调用方传入的空值）→ 返回 `[]`（消费方据 length 决定是否走纯 filter 查询），
 * 与公开 SearchService 原 `if (filters.q)` 守卫行为一致（空/undefined 不匹配）。
 */
export function buildVideoMatchQuery(q: string): EsMatchClause[] {
  if (!q) return []
  return [
    {
      multi_match: {
        query: q,
        fields: [...VIDEO_MATCH_FIELDS],
        type: 'best_fields',
        fuzziness: 'AUTO',
      },
    },
  ]
}
