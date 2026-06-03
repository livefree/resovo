/**
 * type-compat.ts — VideoType 兼容矩阵（ADR-105a D-105a-5 代码常量真源）
 *
 * 红线 R10：矩阵为代码常量单一真源，后台 KV 只调阈值不调矩阵结构。
 * 初始矩阵 5 组显式关系（设计 §4.2），其余组合默认 neutral。
 */

import type { VideoType } from '@resovo/types'

export type TypeRelation = 'compatible' | 'incompatible' | 'weak' | 'neutral'

/** 无序对 key（排序后用 `|` 连接，双向归一）。 */
function pairKey(a: VideoType, b: VideoType): string {
  return [a, b].sort().join('|')
}

/** 显式关系表（D-105a-5 矩阵；key 已排序归一）。 */
const EXPLICIT_RELATIONS: ReadonlyMap<string, TypeRelation> = new Map([
  [pairKey('anime', 'series'), 'compatible'], // 常见源站误标
  [pairKey('movie', 'short'), 'weak'], // 弱兼容，仅人工候选
  [pairKey('movie', 'series'), 'incompatible'], // 除非 external_exact_id_match 证明
  [pairKey('variety', 'series'), 'incompatible'],
  [pairKey('variety', 'anime'), 'incompatible'],
])

/**
 * 判定一对 VideoType 的兼容关系（D-105a-5）。
 * - 同 type → compatible（中正基线）。
 * - 含 `other` → weak（低置信候选，不计中正不计强负）。
 * - 显式表命中 → 返回表值。
 * - 其余 → neutral（既不计 type_compatible 中正、也不 type_incompatible 强负）。
 *
 * 注：实时 Phase 2a 候选组按 (title_normalized, year, type) 聚合 → 组内恒同 type
 *     → 实际只会命中 'compatible' 分支；跨 type 分支为 Phase 2b/单测覆盖预留。
 */
export function classifyTypePair(a: VideoType, b: VideoType): TypeRelation {
  if (a === b) return 'compatible'
  if (a === 'other' || b === 'other') return 'weak'
  return EXPLICIT_RELATIONS.get(pairKey(a, b)) ?? 'neutral'
}
