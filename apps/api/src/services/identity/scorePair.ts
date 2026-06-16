/**
 * scorePair.ts — 单 video-pair 多证据评分核心纯函数（ADR-105a D-105a-3 聚合 + D-105a-14）
 *
 * 输入中性（facets + 摘要，不绑 VideoSummaryForMerge），便于 Phase 2b 离线 job 复用。
 * 强负只 veto 不减分；exact 仅豁免 type_incompatible 单条（D-105a-5 YY-3）；
 * release_marker 仅双非 null 不同才 veto，null↔非 null 降为弱信号（D-105a-14 A1）。
 */

import type { EvidenceItem, EvidenceType, PairScore, VideoType } from '@resovo/types'
import type { TitleFacets } from '../TitleIdentityParser'
import { classifyTypePair } from './type-compat'
import {
  POSITIVE_WEIGHTS,
  NON_EXACT_CAP,
  EXACT_SATURATING_SCORE,
  SOURCE_FINGERPRINT_JACCARD_THRESHOLD,
  STRONG_NEGATIVE_SET,
  EVIDENCE_POLARITY,
  evidenceWeightTag,
} from './weights'

/** 外部 ID 摘要（Phase 2a 留 undefined → 标未评估；Phase 2b 离线 job 填实）。 */
export interface ExternalIdSummary {
  /** provider → exact external_id（如 { imdb: 'tt123', tmdb: '456' }） */
  readonly exactIds: Readonly<Record<string, string>>
  /** 外部别名归一集合（external_alias_match 用） */
  readonly aliasKeys?: readonly string[]
}

/** scorePair 中性输入：一侧 video 的评分摘要。 */
export interface PairSideInput {
  readonly videoId: string
  readonly coreTitleKey: string
  readonly facets: TitleFacets
  readonly year: number | null
  readonly type: VideoType
  readonly sourceSiteKeys: readonly string[]
  /** Phase 2a 省略（标 evaluated=false）；Phase 2b 填实 */
  readonly externalIds?: ExternalIdSummary
  /**
   * 段③ alias_normalized blocking 桶键（ADR-206 D-206-5 / M-2A-3，2A-2）。**独立字段**——
   * 仅供 pairScoringPersist.sharedAliasBucketKeys 交集 → evidence_hash blockingKeys 并集
   * （扩召回面）；**scorePair 评分逻辑绝不读取本字段**（不激活休眠 external_alias_match，
   * 误并由 D-206-6 三红线 + 自动合并 OFF 双重兜底）。与 externalIds.aliasKeys 解耦勿混用。
   */
  readonly aliasBlockingKeys?: readonly string[]
}

// ── EvidenceItem 构造 helper ─────────────────────────────────────────

function evidence(
  type: EvidenceType,
  hit: boolean,
  evaluated: boolean,
  detail: string,
): EvidenceItem {
  return { type, polarity: EVIDENCE_POLARITY[type], weight: evidenceWeightTag(type), hit, evaluated, detail }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

// ── 各维度评估（每个产 0~N 条 EvidenceItem）────────────────────────────

/** core_title_key 等值（中正 / D-105a-1）。 */
function evalCoreTitleKey(l: PairSideInput, r: PairSideInput): EvidenceItem {
  const hit = l.coreTitleKey !== '' && l.coreTitleKey === r.coreTitleKey
  return evidence('core_title_key_equal', hit, true, hit ? 'core_title_key 等值' : 'core_title_key 不同')
}

/** season_mismatch 强负（双非 null 且不同 / D-105a-3，对齐 D-105a-14 口径）。 */
function evalSeason(l: PairSideInput, r: PairSideInput): EvidenceItem {
  const a = l.facets.seasonNumber
  const b = r.facets.seasonNumber
  const hit = a !== null && b !== null && a !== b
  return evidence('season_mismatch', hit, true, hit ? `季号不同（${a} vs ${b}）` : '季号不冲突')
}

/**
 * release_marker（D-105a-14）：
 * - 双非 null 且不同 → release_marker_mismatch veto。
 * - 恰一方非 null → release_marker_weak_signal（弱信号，不 veto / 不计分）。
 * - 双 null 或同值 → 不冲突（仅产 mismatch 未命中条，便于 UI 展示维度）。
 */
function evalReleaseMarker(l: PairSideInput, r: PairSideInput): EvidenceItem[] {
  const a = l.facets.releaseMarker
  const b = r.facets.releaseMarker
  if (a !== null && b !== null && a !== b) {
    return [evidence('release_marker_mismatch', true, true, `发布形态不同（${a} vs ${b}）`)]
  }
  const items: EvidenceItem[] = [evidence('release_marker_mismatch', false, true, '发布形态不冲突')]
  if ((a === null) !== (b === null)) {
    const marker = a ?? b
    items.push(evidence('release_marker_weak_signal', true, true, `一方含发布形态「${marker}」（弱信号，人工裁定）`))
  }
  return items
}

/** year 中正 + year_far 强负（Phase 2a 组内同 year → equal 恒命中 / far 不触发）。 */
function evalYear(l: PairSideInput, r: PairSideInput): EvidenceItem[] {
  const a = l.year
  const b = r.year
  const close = a !== null && b !== null && Math.abs(a - b) <= 1
  const far = a !== null && b !== null && Math.abs(a - b) >= 2
  return [
    evidence('year_equal_or_off_by_one', close, true, close ? 'year 相同或差 1' : 'year 差异较大'),
    // year_far_no_exact：Phase 2a 无 exact 评估，far 时即命中（组内同 year 不会触发）
    evidence('year_far_no_exact', far, true, far ? `year 差 ≥2 且无 exact（${a} vs ${b}）` : 'year 不远'),
  ]
}

/** type 兼容（D-105a-5）。Phase 2a 组内同 type → compatible 恒命中。 */
function evalType(l: PairSideInput, r: PairSideInput): EvidenceItem[] {
  const rel = classifyTypePair(l.type, r.type)
  return [
    evidence('type_compatible', rel === 'compatible', true, rel === 'compatible' ? 'type 兼容' : 'type 非兼容关系'),
    evidence('type_incompatible', rel === 'incompatible', true, rel === 'incompatible' ? 'type 强负不兼容' : 'type 不冲突'),
  ]
}

/** source 指纹高重叠（强正 / Jaccard ≥ 阈值）。 */
function evalSourceFingerprint(l: PairSideInput, r: PairSideInput): EvidenceItem {
  const setL = new Set(l.sourceSiteKeys)
  const setR = new Set(r.sourceSiteKeys)
  const union = new Set([...setL, ...setR])
  let inter = 0
  for (const k of setL) if (setR.has(k)) inter++
  const jaccard = union.size === 0 ? 0 : inter / union.size
  const hit = jaccard >= SOURCE_FINGERPRINT_JACCARD_THRESHOLD
  return evidence(
    'source_fingerprint_high_overlap',
    hit,
    true,
    hit ? `源站指纹重叠 Jaccard=${jaccard.toFixed(2)}` : `源站指纹重叠不足（${jaccard.toFixed(2)}）`,
  )
}

/**
 * 外部 ID 证据。Phase 2a 外部 ID 未拉取（externalIds undefined）→ **不产占位 evidence**
 * （未评估维度对 UI「为何可合并/拦截」零贡献，且实时端点 p95 ≤ 200ms 预算敏感 / D-105a-10）。
 * Phase 2b 填 externalIds 后评估 exact/conflict（alias/same_site_canonical 留 Phase 2b 细化数据源）。
 */
function evalExternalIds(l: PairSideInput, r: PairSideInput): EvidenceItem[] {
  if (l.externalIds === undefined || r.externalIds === undefined) return []
  const exact = l.externalIds.exactIds
  const other = r.externalIds.exactIds
  let exactHit = false
  let conflict = false
  for (const [provider, id] of Object.entries(exact)) {
    const o = other[provider]
    if (o === undefined) continue
    if (o === id) exactHit = true
    else conflict = true
  }
  return [
    evidence('external_exact_id_match', exactHit, true, exactHit ? '外部 exact ID 命中' : '无 exact ID 命中'),
    evidence('external_id_conflict', conflict, true, conflict ? '同 provider 不同 exact ID 冲突' : '外部 ID 不冲突'),
  ]
}

// ── 聚合（D-105a-3 确定性公式）────────────────────────────────────────

function aggregateEvidence(items: readonly EvidenceItem[]): {
  identityScore: number
  strongNegativeReasons: EvidenceType[]
  blockingReasons: EvidenceType[]
} {
  const hasExact = items.some((e) => e.type === 'external_exact_id_match' && e.hit)

  let rawScore = 0
  const blockingReasons: EvidenceType[] = []
  const strongNegativeReasons: EvidenceType[] = []

  for (const e of items) {
    if (!e.hit) continue
    if (STRONG_NEGATIVE_SET.has(e.type)) {
      // exact 仅豁免 type_incompatible 单条 veto（D-105a-5 YY-3）；其余强负不豁免（含 release_marker_mismatch）
      if (hasExact && e.type === 'type_incompatible') continue
      strongNegativeReasons.push(e.type)
      continue
    }
    // 弱信号（release_marker_weak_signal）：不计分、不进 blockingReasons，仅 evidence 明细展示
    if (e.type === 'release_marker_weak_signal') continue
    // 正向证据（强正 + 中正）进 blockingReasons；exact 走饱和路径（POSITIVE_WEIGHTS 无值 → rawScore 不累加）
    blockingReasons.push(e.type)
    rawScore += POSITIVE_WEIGHTS[e.type] ?? 0
  }

  const nonExactScore = clamp01(Math.min(rawScore, NON_EXACT_CAP))
  const exactScore = hasExact ? EXACT_SATURATING_SCORE : 0
  const identityScore = clamp01(Math.max(nonExactScore, exactScore))

  return { identityScore, strongNegativeReasons, blockingReasons }
}

/**
 * 评分单 unordered pair：产全量 evidence + 聚合 identityScore + veto。
 * 强负命中时 identityScore 仍计算并返回（D-105a-3 供 UI 解释）。
 */
export function scorePair(left: PairSideInput, right: PairSideInput): PairScore {
  const evidenceItems: EvidenceItem[] = [
    evalCoreTitleKey(left, right),
    evalSeason(left, right),
    ...evalReleaseMarker(left, right),
    ...evalYear(left, right),
    ...evalType(left, right),
    evalSourceFingerprint(left, right),
    ...evalExternalIds(left, right),
  ]
  const { identityScore, strongNegativeReasons, blockingReasons } = aggregateEvidence(evidenceItems)
  return {
    leftVideoId: left.videoId,
    rightVideoId: right.videoId,
    identityScore: Math.round(identityScore * 10000) / 10000,
    strongNegativeReasons,
    blockingReasons,
    evidence: evidenceItems,
    autoMergeBlocked: strongNegativeReasons.length > 0,
  }
}
