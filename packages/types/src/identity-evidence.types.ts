/**
 * identity-evidence.types.ts — 视频身份解析「多证据评分」公开类型契约
 * （ADR-105a D-105a-3 证据模型 / D-105a-6 字段分离 / D-105a-14 release_marker / D-105a-15 group 聚合）
 *
 * 三处复用：① API 候选响应（VideoMergesService）；② server-next merge UI；
 * ③ Phase 2b identity_candidate 离线 job（复用同一 scorePair / PairScore 形）。
 *
 * 设计来源：CHG-VIR-7 code-architect (claude-opus-4-8) 蓝图。
 * 注意：EvidenceType 字符串值是 evidence_hash 的稳定标识符 —— 禁随意改名（影响 Phase 2b 哈希）。
 */

/** 证据极性（D-105a-3 三类）。强负为 veto，不参与减分（只做硬否决）。 */
export type EvidencePolarity = 'strong-positive' | 'medium-positive' | 'strong-negative'

/**
 * 证据类型枚举（D-105a-3 三类 16 条 + D-105a-14 弱信号位）。
 * 字符串值即权重表 / UI 标签 / evidence_hash 的稳定标识。
 */
export type EvidenceType =
  // 强正
  | 'external_exact_id_match'
  | 'external_alias_match'
  | 'same_site_canonical_id'
  | 'source_fingerprint_high_overlap'
  // 中正
  | 'core_title_key_equal'
  | 'year_equal_or_off_by_one'
  | 'type_compatible'
  | 'episode_structure_close'
  | 'metadata_close'
  // 强负（veto）
  | 'external_id_conflict'
  | 'season_mismatch'
  | 'year_far_no_exact'
  | 'type_incompatible'
  | 'episode_pattern_conflict'
  | 'ordinal_conflict'
  | 'release_marker_mismatch'
  // D-105a-14 弱信号：null↔非 null releaseMarker（进 evidence 供人工解释，但不 veto / 不计分）
  | 'release_marker_weak_signal'

/**
 * 单条证据命中明细。
 * - `weight`：中正/非 exact 强正为正数；exact 强正语义「饱和到 0.95」标 `'saturating'`；
 *   强负 veto 标 `'veto'`；弱信号为 `0`。
 * - `hit`：是否命中。
 * - `evaluated`：Phase 2a 未评估的证据（外部 ID 类）标 `false`，UI 区分「未评估」与「未命中」。
 * - `detail`：人类可读说明，UI「为何可合并 / 为何拦截」直接展示。
 */
export interface EvidenceItem {
  readonly type: EvidenceType
  readonly polarity: EvidencePolarity
  readonly weight: number | 'saturating' | 'veto'
  readonly hit: boolean
  readonly evaluated: boolean
  readonly detail: string
}

/**
 * 一条 unordered pair 的评分结果（scorePair 输出 / Phase 2b 复用同形）。
 * D-105a-3 聚合：identityScore = clamp(max(nonExactScore, exactScore), 0, 1)。
 * 强负命中时 identityScore 仍计算并返回（供 UI 解释「看起来像但被拦截」）。
 */
export interface PairScore {
  readonly leftVideoId: string
  readonly rightVideoId: string
  /** D-105a-3 聚合后的 identityScore ∈ [0,1] */
  readonly identityScore: number
  /** 命中的强负 veto 类型（去重有序） */
  readonly strongNegativeReasons: readonly EvidenceType[]
  /** 命中的正向（强正/中正）证据类型（去重有序），供 UI「为何可合并」 */
  readonly blockingReasons: readonly EvidenceType[]
  /** 该 pair 全量证据明细（含未命中 / 未评估），供 UI 完整展开 */
  readonly evidence: readonly EvidenceItem[]
  /** veto 命中 ⇒ true（= strongNegativeReasons.length > 0） */
  readonly autoMergeBlocked: boolean
  /**
   * CHG-VIR-9-D / D-105a-18：identity_candidate.id（source=identity 折叠后逐 pair 操作锚点）。
   * 运行期身份字段，不进 evidence_hash；legacy 来源 / Phase 2a 评分路径不填（向后兼容）。
   */
  readonly candidateId?: string
}

/**
 * group→单值聚合结果（D-105a-15 min/union），附加到 CandidateGroup。
 * 严格继承 D-105a-9「group→pair：所有 unordered pair」映射，零 recommendedTarget 锚原语。
 */
export interface GroupIdentityScore {
  /** min over all unordered pairs（保守口径，反映组内最弱链接） */
  readonly identityScore: number
  /** union over all pairs（去重有序） */
  readonly strongNegativeReasons: readonly EvidenceType[]
  /** union over all pairs（去重有序） */
  readonly blockingReasons: readonly EvidenceType[]
  /** 任一 pair veto ⇒ true */
  readonly autoMergeBlocked: boolean
  /** per-pair 明细（UI 展开，不丢信息 / D-105a-15） */
  readonly pairs: readonly PairScore[]
  /** scorer 版本（与 parserVersion 一起进 Phase 2b evidence_hash / Y-105a-5） */
  readonly scorerVersion: string
}
