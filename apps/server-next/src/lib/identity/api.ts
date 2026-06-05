/**
 * identity/api.ts — identity 候选人工裁定 API 客户端（CHG-VIR-9-C / ADR-178 + ADR-179）
 *
 * 端点契约：ADR-178 + ADR-179 §端点契约
 *   POST /admin/identity-candidates/:id/reject — 人工拒绝候选（candidate rejected + decision 记录）
 *   POST /admin/identity-candidates/:id/revive — rejected 候选人工复活（ADR-179 D-179-2/3 / CHG-VIR-13-C2 消费）
 *   GET  /admin/identity-decisions             — identity 裁定记录列表（ADR-179 D-179-1 / 决策记录子视图数据源）
 *
 * 双消费方共用真源：审核台 TabSimilar + /admin/merge MergeCandidatesSection / MergeDecisionsSection。
 * confirm 不在此处——confirm 语义 = merge 透传 candidateId（lib/merge/api mergeVideos / D-178-3）。
 */

import { apiClient } from '@/lib/api-client'
import type {
  ListIdentityDecisionsResult,
  ReviveCandidateResult,
} from '@resovo/types'

export interface RejectIdentityCandidateResult {
  readonly candidateId: string
  readonly status: 'rejected'
  readonly decisionId: string
}

/**
 * 人工拒绝 identity 候选（pending→rejected；非 pending 后端统一 409 STATE_CONFLICT）。
 * 复活链（R6）由离线 job 负责，前端无需特殊处理。
 */
export async function rejectIdentityCandidate(
  candidateId: string,
  reason?: string,
): Promise<RejectIdentityCandidateResult> {
  const body = reason ? { reason } : {}
  const res = await apiClient.post<{ data: RejectIdentityCandidateResult }>(
    `/admin/identity-candidates/${encodeURIComponent(candidateId)}/reject`,
    body,
  )
  return res.data
}

/**
 * 人工复活 rejected 候选（ADR-179 D-179-2/3 / CHG-VIR-13-C2）：新建 pending + revived_from 链，
 * 原行零修改；撞 pending 唯一约束幂等返回既有（reused: true，UI 据此提示「已有待裁定候选」）。
 */
export async function reviveIdentityCandidate(
  candidateId: string,
  reason?: string,
): Promise<ReviveCandidateResult> {
  const body = reason ? { reason } : {}
  const res = await apiClient.post<{ data: ReviveCandidateResult }>(
    `/admin/identity-candidates/${encodeURIComponent(candidateId)}/revive`,
    body,
  )
  return res.data
}

/** identity 裁定记录列表（ADR-179 D-179-1；ADR-110 列表包络 / CHG-VIR-13-C2 决策记录子视图） */
export async function listIdentityDecisions(params: {
  decision?: 'confirmed' | 'rejected'
  candidateId?: string
  reverted?: boolean
  limit: number
  page: number
}): Promise<ListIdentityDecisionsResult> {
  const qs = new URLSearchParams()
  if (params.decision) qs.set('decision', params.decision)
  if (params.candidateId) qs.set('candidateId', params.candidateId)
  if (params.reverted !== undefined) qs.set('reverted', String(params.reverted))
  qs.set('limit', String(params.limit))
  qs.set('page', String(params.page))
  return apiClient.get<ListIdentityDecisionsResult>(`/admin/identity-decisions?${qs.toString()}`)
}
