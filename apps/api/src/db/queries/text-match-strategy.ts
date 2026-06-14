/**
 * text-match-strategy.ts — 后台搜索文本匹配策略接口缝（ADR-200 D-200-4 / D-200-C）
 *
 * users/submissions 等实体首版用 ILIKE 文本匹配；pg_trgm（相似度 + GIN/GiST 加速）为后续
 * migration 独立 ADR 决策，**踢出 ADR-200、只在此处留接口缝**。消费方按列清单 + 占位符拼出
 * WHERE 片段，未来切 pg_trgm 时仅替换默认策略实现、调用方零改。
 */

/**
 * 文本匹配策略：给定列清单与单个 SQL 占位符（如 `$1`），返回布尔 WHERE 片段。
 * 占位符对应的参数值由调用方提供（首版 ILIKE 用 `%q%`）。
 */
export type TextMatchStrategy = (columns: readonly string[], placeholder: string) => string

/** 首版 ILIKE 策略：`(col1 ILIKE $n OR col2 ILIKE $n ...)`，大小写不敏感、子串匹配。 */
export const ilikeStrategy: TextMatchStrategy = (columns, placeholder) =>
  '(' + columns.map((col) => `${col} ILIKE ${placeholder}`).join(' OR ') + ')'
