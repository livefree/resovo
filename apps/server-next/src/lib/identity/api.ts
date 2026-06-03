/**
 * identity/api.ts — identity 候选人工裁定 API 客户端（CHG-VIR-9-C / ADR-178）
 *
 * 端点契约：ADR-178 §端点契约
 *   POST /admin/identity-candidates/:id/reject — 人工拒绝候选（candidate rejected + decision 记录）
 *
 * 双消费方共用真源：审核台 TabSimilar + /admin/merge MergeCandidatesSection。
 * confirm 不在此处——confirm 语义 = merge 透传 candidateId（lib/merge/api mergeVideos / D-178-3）。
 */

import { apiClient } from '@/lib/api-client'

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
