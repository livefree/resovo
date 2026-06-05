/**
 * VideoMergesService.status-helpers.ts — merge/split 操作内状态设置（CHG-VIR-13-D1）
 * ADR-105 AMENDMENT 2026-06-04 D-105-9/10/11：
 *   - resolveStatusAction：(current, desired) 二元组 → VideoStateTransitionAction 覆盖矩阵
 *     （评审 R1 修订定档：desired-only 固定映射对 approved-target 确定性 422 失效，
 *     必须以二元组为输入）。矩阵 = 实施真源，单测全枚举定档。
 *   - applyStatusTransition：post-COMMIT 经 transitionVideoState（唯一状态通道 R-105-T2）
 *     应用 action；失败不回滚 merge/split（D-105-10 非原子显式声明），结果可观测（R-105-T3）。
 *   - restoreTargetStatusBefore：unmerge 还原 snapshot.targetStatusBefore（D-105-11）。
 *
 * 独立 helper 文件：VideoMergesService.ts pre-existing 超 file-size budget，不再膨胀。
 */

import type { Pool } from 'pg'
import type { ReviewStatus, VisibilityStatus, VideoStatusSetting, StatusTransitionOutcome } from '@resovo/types'
import {
  transitionVideoState,
  type VideoStateTransitionAction,
} from '@/api/db/queries/videos.mutations'
import { fetchVideosByIds } from '@/api/db/queries/video-merge-mutations'
import { AppError } from '@/api/lib/errors'
import { baseLogger } from '@/api/lib/logger'

const statusLog = baseLogger.child({ module: 'video-merge-status' })

/** (review, visibility) 二元组键（is_published 由二元组唯一推导：approved|public→true，其余 false） */
type StatePairKey = `${ReviewStatus}|${VisibilityStatus}`

const pairKey = (review: ReviewStatus, visibility: VisibilityStatus): StatePairKey =>
  `${review}|${visibility}`

/**
 * (current, desired) → action 覆盖矩阵（D-105-9 实施真源）。
 *
 * 每条目均经双层逐行核对（缺一即不收录 → 422）：
 *   ① 应用层 9 值 action from-state 前置（videos.mutations.ts transitionVideoState switch）；
 *   ② DB trigger 转换白名单（migration 053 现行版，023/033/034 演进）。
 *
 * 未收录的差集（核对依据留档）：
 *   - pending|* → approved|hidden：approve 恒落 internal（034 修订），单 action 不可达
 *     （trigger 留有 pending|hidden→approved|hidden 通道，但应用层 9 值枚举无路径）；
 *   - approved|public → pending|*：staging_revert 前置 !is_published，须先 unpublish（两步 / M-SN-4 D-01）；
 *   - approved|* → rejected|hidden：reject 前置 pending_review（023 三层守门一致）；
 *   - approved|internal → pending|hidden / approved|hidden → pending|internal：
 *     staging_revert 保持原 visibility，跨 visibility 退回不可达；
 *   - rejected|hidden → pending|internal：reopen_pending 恒落 hidden（trigger 允许但应用层无单步路径）；
 *   - rejected|hidden → approved|*：须先 reopen_pending（两步）。
 */
const TRANSITION_MATRIX: Readonly<
  Partial<Record<StatePairKey, Partial<Record<StatePairKey, VideoStateTransitionAction>>>>
> = {
  'pending_review|internal': {
    'pending_review|hidden': 'set_hidden',
    'approved|public': 'approve_and_publish',
    'approved|internal': 'approve',
    'rejected|hidden': 'reject',
  },
  'pending_review|hidden': {
    'pending_review|internal': 'set_internal',
    'approved|public': 'approve_and_publish',
    'approved|internal': 'approve',
    'rejected|hidden': 'reject',
  },
  'approved|public': {
    'approved|internal': 'unpublish',
    'approved|hidden': 'set_hidden',
  },
  'approved|internal': {
    'approved|public': 'publish',
    'approved|hidden': 'set_hidden',
    'pending_review|internal': 'staging_revert',
  },
  'approved|hidden': {
    'approved|public': 'publish',
    'approved|internal': 'set_internal',
    'pending_review|hidden': 'staging_revert',
  },
  'rejected|hidden': {
    'pending_review|hidden': 'reopen_pending',
  },
}

/** split 新建 video 的固定出发态（insertNewVideo DB DEFAULT / migration 016；D-105-9 矩阵退化为 pending 行） */
export const SPLIT_INITIAL_STATE: { reviewStatus: ReviewStatus; visibilityStatus: VisibilityStatus } = {
  reviewStatus: 'pending_review',
  visibilityStatus: 'internal',
}

/**
 * (current, desired) → action 推导（BEGIN 前调用 / D-105-9）。
 * desired 两维 optional：缺省维度取 current 值归一化。
 *
 * @returns action；current == desired 时 null（调用方记 'skipped'，不调状态机）
 * @throws AppError VALIDATION_ERROR 422：无合法单步转换路径（矩阵白名单外）
 */
export function resolveStatusAction(
  current: { reviewStatus: ReviewStatus; visibilityStatus: VisibilityStatus },
  desired: VideoStatusSetting,
): VideoStateTransitionAction | null {
  const desiredReview = desired.reviewStatus ?? current.reviewStatus
  const desiredVisibility = desired.visibilityStatus ?? current.visibilityStatus
  const currentKey = pairKey(current.reviewStatus, current.visibilityStatus)
  const desiredKey = pairKey(desiredReview, desiredVisibility)

  if (currentKey === desiredKey) return null

  const action = TRANSITION_MATRIX[currentKey]?.[desiredKey]
  if (!action) {
    throw new AppError(
      'VALIDATION_ERROR',
      `状态设置不可达：${currentKey} → ${desiredKey} 无合法单步转换路径（状态机白名单），请在审核台分步操作`,
      422,
    )
  }
  return action
}

/**
 * post-COMMIT 应用状态 transition（D-105-10）。
 * 失败不抛出（merge/split 已 COMMIT 不回滚），结构化日志留痕 + 返回 'failed'
 * （失败原因暂不结构化透出 / Y-105-T4，UI 按 R-105-T3 提示人工处理路径）。
 */
export async function applyStatusTransition(
  db: Pool,
  videoId: string,
  action: VideoStateTransitionAction,
  reviewedBy: string,
  reason?: string,
): Promise<Exclude<StatusTransitionOutcome, 'skipped'>> {
  try {
    const result = await transitionVideoState(db, videoId, { action, reviewedBy, reason })
    if (!result) {
      // null = video 不存在或已软删（理论不可达：merge target / split 新建均存活）
      statusLog.warn({ videoId, action }, 'post-COMMIT status transition skipped: video not found or deleted')
      return 'failed'
    }
    return 'applied'
  } catch (err) {
    // D-105-10 非原子声明：transition 失败（并发状态变更 / trigger 拒绝等）不回滚 merge/split
    statusLog.warn({ err, videoId, action }, 'post-COMMIT status transition failed')
    return 'failed'
  }
}

/** merge snapshot 写入的 target 合并前状态（D-105-11 / JSONB 自由字段零 DDL） */
export interface TargetStatusBefore {
  readonly reviewStatus: ReviewStatus
  readonly visibilityStatus: VisibilityStatus
  readonly isPublished: boolean
}

/**
 * merge targetStatus 的 BEGIN 前规划（D-105-9 + D-105-11 组合）：
 * 矩阵校验（非法 422 抛出）+ 将实际 apply 时产出 snapshot 用 targetStatusBefore。
 *
 * @returns undefined = 未携带 targetStatus（零行为变更 R-105-T1）；
 *          action null = no-op（COMMIT 后记 skipped，不写 before——无可还原的变更）
 */
export function planTargetStatus(
  targetRow: { review_status: string; visibility_status: string; is_published: boolean },
  desired: VideoStatusSetting | undefined,
):
  | { action: VideoStateTransitionAction; targetStatusBefore: TargetStatusBefore }
  | { action: null; targetStatusBefore?: undefined }
  | undefined {
  if (desired === undefined) return undefined
  const action = resolveStatusAction(
    {
      reviewStatus: targetRow.review_status as ReviewStatus,
      visibilityStatus: targetRow.visibility_status as VisibilityStatus,
    },
    desired,
  )
  if (action === null) return { action: null }
  return {
    action,
    targetStatusBefore: {
      reviewStatus: targetRow.review_status as ReviewStatus,
      visibilityStatus: targetRow.visibility_status as VisibilityStatus,
      isPublished: targetRow.is_published,
    },
  }
}

/**
 * split post-COMMIT 逐组应用新建 video 状态（D-105-10）。
 * 数组仅含携带 status 的新建组（未携带组无 transition 意图不产条目）。
 *
 * @param groupActions 与 groups 等长；undefined = 该组未携带 status / null = no-op skipped
 * @param createdVideoIdByGroup 组下标 → 新建 videoId（existing 组恒 undefined）
 * @returns 全组未携带 status 时 undefined（响应不出现 statusTransition / R-105-T1）
 */
export async function applyGroupStatusTransitions(
  db: Pool,
  groupActions: ReadonlyArray<VideoStateTransitionAction | null | undefined>,
  createdVideoIdByGroup: ReadonlyArray<string | undefined>,
  actorId: string,
): Promise<{ videoId: string; result: StatusTransitionOutcome }[] | undefined> {
  if (!groupActions.some((a) => a !== undefined)) return undefined
  const results: { videoId: string; result: StatusTransitionOutcome }[] = []
  for (let i = 0; i < groupActions.length; i++) {
    const action = groupActions[i]
    const videoId = createdVideoIdByGroup[i]
    if (action === undefined || videoId === undefined) continue
    results.push({
      videoId,
      result: action === null ? 'skipped' : await applyStatusTransition(db, videoId, action, actorId),
    })
  }
  return results
}

/**
 * unmerge 还原 target 状态（D-105-11）。COMMIT 后调用，同 D-105-10 非原子边界。
 * 还原同走 (current, before) 矩阵：合并后状态被人工改至无单步回路
 * （如 approve_and_publish 的反向 approved|public → pending|internal 须先 unpublish）
 * 时如实 'failed'，人工兜底——矩阵外两步还原须回 ADR 另行定档，本卡不发明协议。
 */
export async function restoreTargetStatusBefore(
  db: Pool,
  targetVideoId: string,
  before: TargetStatusBefore,
  actorId: string,
  reason?: string,
): Promise<StatusTransitionOutcome> {
  const [row] = await fetchVideosByIds(db, [targetVideoId])
  if (!row || row.deleted_at !== null) {
    statusLog.warn({ targetVideoId }, 'unmerge status restore failed: target not found or deleted')
    return 'failed'
  }

  let action: VideoStateTransitionAction | null
  try {
    action = resolveStatusAction(
      {
        reviewStatus: row.review_status as ReviewStatus,
        visibilityStatus: row.visibility_status as VisibilityStatus,
      },
      { reviewStatus: before.reviewStatus, visibilityStatus: before.visibilityStatus },
    )
  } catch (err) {
    statusLog.warn(
      { err, targetVideoId, before },
      'unmerge status restore failed: no single-step path back to targetStatusBefore',
    )
    return 'failed'
  }

  if (action === null) return 'skipped'
  return applyStatusTransition(db, targetVideoId, action, actorId, reason)
}
