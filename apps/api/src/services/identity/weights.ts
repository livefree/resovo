/**
 * weights.ts — 多证据评分权重 / 阈值 / 版本常量（ADR-105a D-105a-3 代码常量真源）
 *
 * 红线 R10：权重为代码常量单一真源，后台 KV 只调阈值不调权重结构。
 * Y-105a-3：权重上限与极性本 ADR 已定档，不得在实施期改极性。
 */

import type { EvidenceType, EvidencePolarity } from '@resovo/types'

/** scorer 版本（version 升级触发 Phase 2b superseded 重算 / Y-105a-5）。 */
export const SCORER_VERSION = '1.0.0'

/**
 * 阈值/权重配置版本号（D-105a-8 evidence_hash 输入域 ⑧）。
 * 随权重/阈值结构变更 bump；KV 接入后改读 KV version（forward-compat）。
 */
export const THRESHOLD_CONFIG_VERSION = '1.1.0'

/** 非 exact 路径封顶（< 0.92 阈值 → 永不自动绑定 / D-105a-3）。 */
export const NON_EXACT_CAP = 0.9

/** 强正 external exact 饱和基（D-105a-3）。 */
export const EXACT_SATURATING_SCORE = 0.95

/**
 * 中正 + 非 exact 强正权重（D-105a-3）。
 * `external_exact_id_match` 不在此表 —— 它走饱和路径（EXACT_SATURATING_SCORE），不累加。
 * 强负 veto 不计权重（只硬否决，见 STRONG_NEGATIVE_TYPES）。
 */
export const POSITIVE_WEIGHTS: Partial<Record<EvidenceType, number>> = {
  // 强正（非 exact）
  external_alias_match: 0.45,
  same_site_canonical_id: 0.4,
  source_fingerprint_high_overlap: 0.3,
  // 中正
  core_title_key_equal: 0.35,
  year_equal_or_off_by_one: 0.15,
  type_compatible: 0.1,
  episode_structure_close: 0.1,
  metadata_close: 0.1,
}

/** source_fingerprint Jaccard 阈值（默认 0.6 / D-105a-3；阈值实施期可调，权重不变）。 */
export const SOURCE_FINGERPRINT_JACCARD_THRESHOLD = 0.6

/**
 * candidate 区间下界（默认 0.75 / D-105a-4 阈值，KV 可配）。
 * identityScore < 此值且无强负 → 'none'，离线 job 不生成候选。
 */
export const CANDIDATE_MIN_THRESHOLD = 0.75

/** 强负 veto 证据集合（D-105a-3 + D-105a-14 release_marker_mismatch）。 */
export const STRONG_NEGATIVE_TYPES: readonly EvidenceType[] = [
  'external_id_conflict',
  'season_mismatch',
  'year_far_no_exact',
  'type_incompatible',
  'episode_pattern_conflict',
  'ordinal_conflict',
  'release_marker_mismatch',
]

/** 强负集合的 Set 视图（O(1) 判定）。 */
export const STRONG_NEGATIVE_SET: ReadonlySet<EvidenceType> = new Set(STRONG_NEGATIVE_TYPES)

/** 证据极性单一真源（D-105a-3）。release_marker_weak_signal 为弱信号（weight 0 不计分）。 */
export const EVIDENCE_POLARITY: Readonly<Record<EvidenceType, EvidencePolarity>> = {
  external_exact_id_match: 'strong-positive',
  external_alias_match: 'strong-positive',
  same_site_canonical_id: 'strong-positive',
  source_fingerprint_high_overlap: 'strong-positive',
  core_title_key_equal: 'medium-positive',
  year_equal_or_off_by_one: 'medium-positive',
  type_compatible: 'medium-positive',
  episode_structure_close: 'medium-positive',
  metadata_close: 'medium-positive',
  external_id_conflict: 'strong-negative',
  season_mismatch: 'strong-negative',
  year_far_no_exact: 'strong-negative',
  type_incompatible: 'strong-negative',
  episode_pattern_conflict: 'strong-negative',
  ordinal_conflict: 'strong-negative',
  release_marker_mismatch: 'strong-negative',
  release_marker_weak_signal: 'medium-positive',
}

/**
 * EvidenceItem.weight 展示标识：
 * - external_exact_id_match → 'saturating'（饱和到 0.95）
 * - 强负 → 'veto'
 * - 有正权重 → 数值
 * - 其余（release_marker_weak_signal）→ 0
 */
export function evidenceWeightTag(type: EvidenceType): number | 'saturating' | 'veto' {
  if (type === 'external_exact_id_match') return 'saturating'
  if (STRONG_NEGATIVE_SET.has(type)) return 'veto'
  return POSITIVE_WEIGHTS[type] ?? 0
}

// ── GRAY-SLICE（D-105a-20 / ADR-105a AMENDMENT 2026-06-12）────────────────────

/**
 * 灰区窄切片准入谓词（D-105a-20 规范定义的**单一真源**——pairScoringPersist 准入
 * 与回滚 hygiene 脚本必须共用本函数，防准入/清理口径漂移）：
 *   同 coreTitleKey + 年份 ±1 双锚点 + 无强负 → 阈下（<0.75）仍落 pending 候选。
 *
 * 年未知层（双方任一 year 为 null → evalYear 不产 year_equal_or_off_by_one）
 * 天然不命中——通用名撞车无年份兜底，留待外部 ID/重爬证据自然升分。
 * identity_score 如实存储不虚标；人工裁定仍是最终闸门。
 */
export function isGraySliceAdmissible(ps: {
  readonly strongNegativeReasons: readonly string[]
  readonly blockingReasons: readonly string[]
}): boolean {
  return ps.strongNegativeReasons.length === 0
    && ps.blockingReasons.includes('core_title_key_equal')
    && ps.blockingReasons.includes('year_equal_or_off_by_one')
}
