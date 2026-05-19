/**
 * user-submissions/types.ts — `/admin/user-submissions` 视图类型 re-export 桥接
 *
 * 真源在 `@resovo/types` 的 `admin-moderation.types.ts`（CHG-SN-7-REDO-02-A 落地）。
 * 本文件仅 re-export 保持 `@/lib/user-submissions/types` import path 一致性。
 *
 * 任务卡：CHG-SN-7-REDO-02-C
 * 关联 ADR：ADR-124 §类型契约
 */

export type {
  UserSubmissionType,
  UserSubmissionStatus,
  UserSubmissionRow,
  UserSubmissionListResp,
} from '@resovo/types'

/** GET /admin/user-submissions query 参数 */
export interface ListUserSubmissionsQuery {
  readonly page?: number
  readonly limit?: number
  readonly type?: 'bad_source' | 'wish_list' | 'metadata_correction' | 'all'
  readonly status?: 'pending' | 'processed' | 'rejected' | 'all'
  readonly sortField?: 'created_at' | 'processed_at'
  readonly sortDir?: 'asc' | 'desc'
}

/** POST /admin/user-submissions/:id/process body */
export interface ProcessSubmissionInput {
  readonly action_taken?: string
}

/** POST /admin/user-submissions/:id/reject body */
export interface RejectSubmissionInput {
  readonly reason: string
}

/** POST /admin/user-submissions/batch-process body */
export interface BatchProcessInput {
  readonly ids: readonly string[]
  readonly action_taken?: string
}

/** POST /admin/user-submissions/batch-reject body */
export interface BatchRejectInput {
  readonly ids: readonly string[]
  readonly reason: string
}
