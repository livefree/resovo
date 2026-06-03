/**
 * evidenceHash.ts — 候选 evidence_hash 确定性计算（ADR-105a D-105a-8 / R7）
 *
 * 输入域必须稳定、确定（8 项 / decisions.md:19004）；**禁含** created_at/updated_at/job-id/
 * request-id/row-id（R7，否则同证据反复生成新 hash → 幂等失效）。
 * 用确定性序列化（字段字典序 + 数组去重排序）+ sha256 hex（与 titleObservation.builder 同栈）。
 *
 * 设计来源：CHG-VIR-8 code-architect (claude-opus-4-8) 蓝图。
 */

import { createHash } from 'node:crypto'

/** 单侧 video 评分字段快照（D-105a-8 ⑤）。left/right 由 canonical_pair_key 有序决定。 */
export interface PairFieldSnapshot {
  readonly coreTitleKey: string
  readonly year: number | null
  readonly type: string
  readonly seasonNumber: number | null
  readonly releaseMarker: string | null
  /** 集数结构摘要（Phase 2b 占位空串，episode 证据细化时填实 + bump SCORER_VERSION） */
  readonly episodeStructureDigest: string
  /** 关键 metadata 摘要（Phase 2b 占位空串，metadata 证据细化时填实 + bump SCORER_VERSION） */
  readonly metadataDigest: string
}

/** evidence_hash 输入域（D-105a-8 八项，禁含非证据字段 / R7）。 */
export interface EvidenceHashInput {
  /** ① normalized candidate pair */
  readonly canonicalPairKey: string
  /** ② parser 版本 */
  readonly parserVersion: string
  /** ③ scorer 版本 */
  readonly scorerVersion: string
  /** ④ 命中的 blocking key 集合（有序去重，本函数内 dedupeSort） */
  readonly blockingKeys: readonly string[]
  /** ⑤ 参与评分的字段快照（left=canonical min / right=max） */
  readonly fieldSnapshot: { readonly left: PairFieldSnapshot; readonly right: PairFieldSnapshot }
  /** ⑥ 外部引用摘要（命中的 provider:external_id:relation，有序去重） */
  readonly externalRefSummary: readonly string[]
  /** ⑦ strong_negative_reasons（有序去重） */
  readonly strongNegativeReasons: readonly string[]
  /** ⑧ 阈值/权重配置版本号 */
  readonly thresholdConfigVersion: string
}

/** 去重 + 字典序排序（④⑥⑦ 有序去重 / 消除顺序敏感）。 */
function dedupeSort(values: readonly string[]): string[] {
  return [...new Set(values)].sort()
}

/**
 * 确定性序列化：对象 key 字典序递归排序（不依赖插入序），数组保序（调用方已 sort），
 * null 显式 'null'。不用 JSON.stringify（其 key 序依插入序，非确定）。
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
  }
  return JSON.stringify(value)
}

/**
 * 计算 evidence_hash（确定性 sha256 hex）。同证据 → 同 hash（幂等基础）；
 * 任一输入域字段变 → hash 变（受控触发 superseded + 新 pending / Y5）。
 */
export function computeEvidenceHash(input: EvidenceHashInput): string {
  const normalized = {
    canonicalPairKey: input.canonicalPairKey,
    parserVersion: input.parserVersion,
    scorerVersion: input.scorerVersion,
    thresholdConfigVersion: input.thresholdConfigVersion,
    blockingKeys: dedupeSort(input.blockingKeys),
    externalRefSummary: dedupeSort(input.externalRefSummary),
    strongNegativeReasons: dedupeSort(input.strongNegativeReasons),
    fieldSnapshot: { left: input.fieldSnapshot.left, right: input.fieldSnapshot.right },
  }
  return createHash('sha256').update(stableStringify(normalized)).digest('hex')
}
