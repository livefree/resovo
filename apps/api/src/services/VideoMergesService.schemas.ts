/**
 * VideoMergesService.schemas.ts — zod 验证 schema + 评分算法辅助函数
 * 从 VideoMergesService.ts 拆出，覆盖 Schema 定义和内部 helpers
 */

import { z } from 'zod'
import type {
  VideoSummaryForMerge,
  CandidateGroup,
  EvidenceType,
  EvidenceItem,
  PairScore,
} from '@resovo/types'
import type { RawVideoDetailRow } from '@/api/db/queries/video-merge-candidates'
import type { PendingCandidatePairRow } from '@/api/db/queries/identity-candidate'
import { SCORER_VERSION, aggregateGroup } from './identity'
import type { PairCluster } from './identity/collapsePairsToGroups'

// ── zod schema（ADR-105 §端点契约）────────────────────────────────

export const VideoTypeEnum = z.enum([
  'movie', 'series', 'anime', 'variety', 'documentary',
  'short', 'sports', 'music', 'news', 'kids', 'other',
])

export const ListCandidatesSchema = z.object({
  type: VideoTypeEnum.optional(),
  minScore: z.coerce.number().min(0).max(1).default(0.6),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
  // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 白名单 4 字段（Service 层 sort）
  sortField: z.enum(['score', 'videoCount', 'year', 'titleNormalized']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  // CHG-VIR-9-A：候选来源（identity 读 candidate 表，空表降级 legacy）
  // CHG-VIR-9-D / D-105a-18：默认翻 identity（9-A AMENDMENT「待 shadow 稳定后另起小卡翻默认」兑现）
  source: z.enum(['identity', 'legacy']).default('identity'),
})

export const MergeSchema = z.object({
  sourceVideoIds: z.array(z.string().uuid()).min(1).max(10),
  targetVideoId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  // CHG-VIR-9-B / ADR-178 D-178-3：关联 identity_candidate（confirmed→merge 单事务 / R8）。
  // 纯增量 optional，缺省时 merge 行为逐值不变。
  // CHG-VIR-9-D 起 deprecate：新消费方用 candidateIds（数组），单数保留向后兼容。
  candidateId: z.string().uuid().optional(),
  // CHG-VIR-9-D / D-105a-18：折叠组 confirm——连通分量全部 pending pair 的 candidate id，
  // 事务内循环挂 K 个 decision(confirmed) 同一 audit_id。与 candidateId 互斥。
  // cap = C(11,2) = 55（Codex review FIX：merge 集合上限 11 视频〔sourceVideoIds max 10 + target〕
  // 的完全图 pair 数；原 cap 20 会把合法 11-video 折叠组 confirm 误拒 422）。
  candidateIds: z.array(z.string().uuid()).min(1).max(55).optional(),
}).refine(
  v => !v.sourceVideoIds.includes(v.targetVideoId),
  { message: 'targetVideoId 不得在 sourceVideoIds 中', path: ['targetVideoId'] },
).refine(
  v => new Set(v.sourceVideoIds).size === v.sourceVideoIds.length,
  { message: 'sourceVideoIds 不得含重复值', path: ['sourceVideoIds'] },
).refine(
  v => !(v.candidateId && v.candidateIds),
  { message: 'candidateId 与 candidateIds 不得同时提供', path: ['candidateIds'] },
).refine(
  v => !v.candidateIds || new Set(v.candidateIds).size === v.candidateIds.length,
  { message: 'candidateIds 不得含重复值', path: ['candidateIds'] },
)

export const UnmergeSchema = z.object({
  reason: z.string().max(500).optional(),
})

export const SplitSchema = z.object({
  groups: z.array(z.object({
    sourceIds: z.array(z.string().uuid()).min(1),
    newVideoMeta: z.object({
      title: z.string().min(1).max(500),
      year: z.number().int().min(1800).max(2100).optional(),
      type: VideoTypeEnum,
    }),
  })).min(2).max(20),
})

// CHG-SN-6-AUDIT-TIMELINE (RETRO 4/7) — ADR-105 AMENDMENT 2026-05-14
export const ListAuditSchema = z.object({
  action: z.enum(['merge', 'split']).optional(),
  videoId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
}).strict()

// ── 评分算法 v1（ADR-105 §4）──────────────────────────────────────

/**
 * 计算 source_overlap_ratio：
 * 组内 ≥2 个 video 共享的 source_site_key 数 / 组内所有 unique site_key 数
 * ∈ [0, 1]；空 site_keys 时 score = 0。
 */
export function computeOverlapScore(videos: readonly VideoSummaryForMerge[]): number {
  const allKeys = new Set<string>()
  const keyCount = new Map<string, number>()

  for (const v of videos) {
    for (const key of v.sourceSiteKeys) {
      allKeys.add(key)
      keyCount.set(key, (keyCount.get(key) ?? 0) + 1)
    }
  }

  if (allKeys.size === 0) return 0

  let sharedCount = 0
  for (const count of keyCount.values()) {
    if (count >= 2) sharedCount++
  }

  return sharedCount / allKeys.size
}

/**
 * 推荐合并 target：source 最多的 video；同等时取最早 createdAt。
 */
export function pickRecommendedTarget(videos: readonly VideoSummaryForMerge[]): string {
  return [...videos].sort((a, b) => {
    if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount
    return a.createdAt.localeCompare(b.createdAt)
  })[0]?.id ?? videos[0]!.id
}

/** 将 DB 原始行映射为 VideoSummaryForMerge */
export function mapVideoRow(row: RawVideoDetailRow): VideoSummaryForMerge {
  return {
    id: row.id,
    title: row.title,
    titleNormalized: row.title_normalized,
    year: row.year,
    type: row.type,
    createdAt: row.created_at,
    sourceCount: parseInt(row.source_count, 10),
    sourceSiteKeys: row.site_keys,
  }
}

/** pending pair 行 → PairScore（blockingReasons 从 evidence 重算：hit 正向，排除强负 + 弱信号 / 与 scorePair 口径一致） */
function pairRowToScore(p: PendingCandidatePairRow): PairScore {
  const identityScore = Number(p.identity_score)
  const strongNegativeReasons = p.strong_negative_reasons as EvidenceType[]
  const evidence = Array.isArray(p.evidence_jsonb) ? (p.evidence_jsonb as EvidenceItem[]) : []
  const blockingReasons = evidence
    .filter((e) => e.hit && e.polarity !== 'strong-negative' && e.type !== 'release_marker_weak_signal')
    .map((e) => e.type)
  return {
    leftVideoId: p.left_video_id,
    rightVideoId: p.right_video_id,
    identityScore,
    strongNegativeReasons,
    blockingReasons,
    evidence,
    autoMergeBlocked: strongNegativeReasons.length > 0,
    // CHG-VIR-9-D / D-105a-18：折叠后逐 pair confirm/reject 操作锚点
    candidateId: p.id,
  }
}

/**
 * CHG-VIR-9-D / D-105a-18：连通分量 → N-video CandidateGroup（merge source=identity）。
 * 9-A buildGroupFromPair（每 pair→2-video group）的折叠演进版：group 聚合复用 aggregateGroup
 * （D-105a-15 min/union），groupKey = clusterKey（成员 video_id 升序 join，幂等稳定）。
 * 防御：videoMap 缺失成员时仅保留两端齐全的 pair；有效 video < 2 或 pair 为空 → null。
 */
export function buildGroupFromCluster(
  cluster: PairCluster,
  videoMap: Map<string, VideoSummaryForMerge>,
): CandidateGroup | null {
  const videos = cluster.videoIds
    .map((id) => videoMap.get(id))
    .filter((v): v is VideoSummaryForMerge => v !== undefined)
  if (videos.length < 2) return null
  const present = new Set(videos.map((v) => v.id))
  const pairs = cluster.pairs.filter(
    (p) => present.has(p.left_video_id) && present.has(p.right_video_id),
  )
  if (pairs.length === 0) return null

  const identity = aggregateGroup(pairs.map(pairRowToScore), SCORER_VERSION)
  // legacyScore 保守口径：min over pairs（与 identity min 同哲学；null 沿 9-A 旧语义当 0）
  const score = Math.min(...pairs.map((p) => (p.legacy_score != null ? Number(p.legacy_score) : 0)))
  const candidateIds = pairs.map((p) => p.id)
  const first = videos[0]!
  return {
    groupKey: cluster.clusterKey,
    titleNormalized: first.titleNormalized,
    year: first.year,
    type: first.type,
    videos,
    score,
    recommendedTargetVideoId: pickRecommendedTarget(videos),
    identity,
    // CHG-VIR-9-C 单数锚点：N=2 单 pair 时保留填充（9-C 深链/既有消费方兼容）；多 pair 不填
    ...(pairs.length === 1 ? { candidateId: pairs[0]!.id } : {}),
    candidateIds,
  }
}
