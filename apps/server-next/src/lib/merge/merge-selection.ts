/**
 * merge-selection.ts — 候选组（部分）合并请求成形纯函数（CHG-VIR-17-PARTIAL FIX / Codex review）
 *
 * 根因：handleMerge 对「target ∈ 选中集合」无结构性守卫，仅靠 CandidateExpand 的
 * target 转移 effect 时序保证——selectedVideoIds 不含 targetVideoId 时请求仍会成形，
 * 把选中视频合并到**被排除的** target 上（语义反转的数据损坏，虽可撤销但错误）。
 *
 * 守卫口径（D-105a-18 遗留 ① 契约一体）：
 *   - target 必须在合并集合内（不在 → null，调用方拒绝发起）
 *   - candidateIds 仅含两端均在集合内的 pair（集合外 pair 传了后端 422）
 *   - 全选语义与 group.candidateIds 既有路径逐值不变（identity.pairs 同源 + fallback 保留）
 */

import type { CandidateGroup } from '@resovo/types'

export interface MergeSelection {
  readonly sourceVideoIds: string[]
  /** identity 来源 confirm 锚点（legacy 组 / 无 pair 锚点时 undefined 不传字段） */
  readonly candidateIds?: string[]
}

/**
 * 由候选组 + target + 可选选中集合成形合并请求参数。
 * 返回 null = target 不在合并集合内（结构性拒绝，调用方提示后中止）。
 *
 * @param selectedVideoIds 部分合并选中集合（含 target）；缺省或不足 2 个 → 整组语义
 */
export function buildMergeSelection(
  group: CandidateGroup,
  targetVideoId: string,
  selectedVideoIds?: readonly string[],
): MergeSelection | null {
  const members = selectedVideoIds && selectedVideoIds.length >= 2
    ? selectedVideoIds
    : group.videos.map((v) => v.id)
  const memberSet = new Set(members)

  // CHG-VIR-17-PARTIAL FIX（Codex review）：target 必须在合并集合内——
  // 它是合并保留者，被排除的视频不得作为 target（语义反转守卫）
  if (!memberSet.has(targetVideoId)) return null

  const isPartial = members.length < group.videos.length
  const sourceVideoIds = members.filter((id) => id !== targetVideoId)

  // CHG-VIR-9-C/9-D：identity 来源 confirm 锚点；CHG-VIR-17-PARTIAL：仅两端均在
  // 集合内的 pair（validateForMerge pair⊆集合 / 遗留 ① 契约）。锚点真源 =
  // identity.pairs 逐 pair candidateId；部分合并禁用整组 fallback（旧锚点含集合外 pair）
  const pairAnchors = (group.identity?.pairs ?? [])
    .filter((p) => memberSet.has(p.leftVideoId) && memberSet.has(p.rightVideoId))
    .map((p) => p.candidateId)
    .filter((id): id is string => id !== undefined)
  const candidateIds = pairAnchors.length > 0
    ? pairAnchors
    : isPartial
      ? undefined
      : group.candidateIds && group.candidateIds.length > 0
        ? [...group.candidateIds]
        : group.candidateId ? [group.candidateId] : undefined

  return { sourceVideoIds, ...(candidateIds ? { candidateIds } : {}) }
}
