/**
 * pairScoringPersist.ts — pair 评分 → evidence_hash → 幂等 upsert 共享层
 * （ADR-105a D-105a-8 / CHG-VIR-10 自 offlineRescore 抽出，offline job 与 ingest shadow 双消费）
 *
 * blockingKeys（D-105a-17）：取「该 pair 命中的全部 blocking 桶 key 有序去重并集」——
 * 双方 core_title_key + 共享 `provider:external_id` 桶 key。由 pair 自身数据确定性计算
 * （召回路径无关），同 pair 任何召回顺序产同 hash（幂等基础）；既有 pending 若新增命中
 * ext 桶则 hash 变化 → 受控 superseded（Y5，不 bump SCORER_VERSION——评分逻辑未变）。
 */

import type { Pool } from 'pg'
import type { PairScore } from '@resovo/types'
import type { IdentityTriggerSource } from '@/api/db/queries/identity-candidate'
import { parseTitle } from '../TitleIdentityParser'
import { fetchVideoDetailsForCandidates } from '@/api/db/queries/video-merge-candidates'
import { computeEvidenceHash, type PairFieldSnapshot } from './evidenceHash'
import { upsertIdentityCandidate } from './candidateUpsert'
import { loadExternalIdSummaries } from './externalIdLoader'
import { scorePair, type PairSideInput } from './scorePair'
import { THRESHOLD_CONFIG_VERSION, CANDIDATE_MIN_THRESHOLD, isGraySliceAdmissible } from './weights'

/** upsert 结果计数（IdentityRescoreResult 与 ingest shadow 共用子集）。 */
export interface PairPersistCounters {
  pairs: number
  created: number
  superseded: number
  noop: number
  revived: number
  skippedRejected: number
  skippedLowScore: number
  blocked: number
  /** D-105a-20：灰区窄切片准入数（阈下 + 同 key + 年±1 + 无强负 → 仍落候选） */
  grayAdmitted: number
}

export function emptyPairPersistCounters(): PairPersistCounters {
  return { pairs: 0, created: 0, superseded: 0, noop: 0, revived: 0, skippedRejected: 0, skippedLowScore: 0, blocked: 0, grayAdmitted: 0 }
}

/**
 * 批量组装评分输入：video 详情 + externalIds（双源 Y-105a-4）+ parseTitle facets
 * → PairSideInput Map（offline job 与 ingest shadow 共用，口径一致）。
 */
export async function buildSides(db: Pool, videoIds: string[]): Promise<Map<string, PairSideInput>> {
  const [details, extMap] = await Promise.all([
    fetchVideoDetailsForCandidates(db, videoIds),
    loadExternalIdSummaries(db, videoIds),
  ])
  const map = new Map<string, PairSideInput>()
  for (const d of details) {
    const parsed = parseTitle(d.title)
    map.set(d.id, {
      videoId: d.id,
      coreTitleKey: parsed.coreTitleKey,
      facets: parsed.facets,
      year: d.year,
      type: d.type,
      sourceSiteKeys: d.site_keys,
      externalIds: extMap.get(d.id),
    })
  }
  return map
}

function snapshot(s: PairSideInput): PairFieldSnapshot {
  return {
    coreTitleKey: s.coreTitleKey,
    year: s.year,
    type: s.type,
    seasonNumber: s.facets.seasonNumber,
    releaseMarker: s.facets.releaseMarker,
    episodeStructureDigest: '', // Phase 2b 占位（episode 证据细化时填 + bump SCORER_VERSION）
    metadataDigest: '',
  }
}

/** 外部引用摘要（确定性，canonical 顺序 / D-105a-8 ⑥）。 */
function externalRefSummary(left: PairSideInput, right: PairSideInput): string[] {
  const out: string[] = []
  for (const [p, id] of Object.entries(left.externalIds?.exactIds ?? {})) out.push(`L:${p}:${id}`)
  for (const [p, id] of Object.entries(right.externalIds?.exactIds ?? {})) out.push(`R:${p}:${id}`)
  return out
}

/** 双方共享的 external_id 桶 key（`provider:id` 同值 ⟺ 同 ext 桶 / D-105a-17）。 */
function sharedExternalBucketKeys(left: PairSideInput, right: PairSideInput): string[] {
  const out: string[] = []
  const re = right.externalIds?.exactIds ?? {}
  for (const [p, id] of Object.entries(left.externalIds?.exactIds ?? {})) {
    if (re[p] === id) out.push(`${p}:${id}`)
  }
  return out
}

export interface PersistPairsOptions {
  readonly parserVersion: string
  readonly scorerVersion: string
  readonly triggerSource: IdentityTriggerSource
}

/**
 * 评分 + 阈值过滤（D-105a-4：< 0.75 且无强负 → 不生成候选）+ 单事务幂等 upsert
 * （逐 pair 独立小事务，重试安全）。返回全量 PairScore（含未持久化的低分 pair，
 * ingest shadow 用于 bind 对比；offline 调用方可忽略）。
 */
export async function scoreAndPersistPairs(
  db: Pool,
  sideMap: Map<string, PairSideInput>,
  pairs: readonly (readonly [string, string])[],
  opts: PersistPairsOptions,
  counters: PairPersistCounters,
): Promise<PairScore[]> {
  const pairScores: PairScore[] = []
  for (const [a, b] of pairs) {
    const sa = sideMap.get(a)
    const sb = sideMap.get(b)
    if (sa && sb) pairScores.push(scorePair(sa, sb))
  }

  for (const ps of pairScores) {
    counters.pairs++
    const blocked = ps.strongNegativeReasons.length > 0
    if (blocked) counters.blocked++
    // D-105a-4（D-105a-20 修订）：identityScore < 0.75 且无强负 → 灰区谓词判定——
    // 同 coreTitleKey + 年±1 双锚点命中则仍落候选（identity_score 如实存储，消费侧
    // 按分值沉底 + 人工裁定闸门）；不命中 → none 区不生成候选。三路径（offline /
    // ingest shadow / video-rescore）共用本判定，行为一致（D-105a-16 同口径）。
    if (ps.identityScore < CANDIDATE_MIN_THRESHOLD && !blocked) {
      if (!isGraySliceAdmissible(ps)) {
        counters.skippedLowScore++
        continue
      }
      counters.grayAdmitted++
    }
    const left = sideMap.get(ps.leftVideoId)
    const right = sideMap.get(ps.rightVideoId)
    if (!left || !right) continue
    const canonicalPairKey = `${ps.leftVideoId}|${ps.rightVideoId}`
    const evidenceHash = computeEvidenceHash({
      canonicalPairKey,
      parserVersion: opts.parserVersion,
      scorerVersion: opts.scorerVersion,
      thresholdConfigVersion: THRESHOLD_CONFIG_VERSION,
      blockingKeys: [
        left.coreTitleKey,
        right.coreTitleKey,
        ...sharedExternalBucketKeys(left, right),
      ],
      fieldSnapshot: { left: snapshot(left), right: snapshot(right) },
      externalRefSummary: externalRefSummary(left, right),
      strongNegativeReasons: ps.strongNegativeReasons,
    })
    const outcome = await upsertIdentityCandidate(db, {
      leftVideoId: ps.leftVideoId,
      rightVideoId: ps.rightVideoId,
      canonicalPairKey,
      parserVersion: opts.parserVersion,
      scorerVersion: opts.scorerVersion,
      evidenceJsonb: ps.evidence,
      evidenceHash,
      legacyScore: null, // 跨 group 召回无对应 legacy group（D-105a schema nullable）
      identityScore: ps.identityScore,
      strongNegativeReasons: ps.strongNegativeReasons,
      triggerSource: opts.triggerSource,
      groupKey: null,
      evidenceItems: ps.evidence,
    })
    switch (outcome.kind) {
      case 'created': counters.created++; break
      case 'superseded': counters.superseded++; break
      case 'noop': counters.noop++; break
      case 'revived': counters.revived++; break
      case 'skipped-rejected': counters.skippedRejected++; break
    }
  }
  return pairScores
}
