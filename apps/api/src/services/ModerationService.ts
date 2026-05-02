/**
 * ModerationService.ts — 审核台业务编排
 * CHG-SN-4-05: 状态机 + audit log + ES 索引联动
 */

import type { Pool } from 'pg'
import type { Client as ESClient } from '@elastic/elasticsearch'
import { transitionVideoState } from '@/api/db/queries/videos'
import { AuditLogService } from '@/api/services/AuditLogService'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'
import { findReviewLabelByKey } from '@/api/db/queries/reviewLabels'
import { toggleVideoSource, disableDeadSources } from '@/api/db/queries/video_sources'
import { ERRORS } from '@/api/lib/errors'

export interface RejectLabeledInput {
  videoId: string
  labelKey: string
  reason?: string
  expectedUpdatedAt?: string
  actorId: string
  requestId?: string
}

export interface StaffNoteInput {
  videoId: string
  note: string | null
  actorId: string
  requestId?: string
}

export interface StagingRevertInput {
  videoId: string
  expectedUpdatedAt?: string
  actorId: string
  requestId?: string
}

export interface SourceToggleInput {
  videoId: string
  sourceId: string
  isActive: boolean
  actorId: string
  requestId?: string
}

export interface DisableDeadInput {
  videoId: string
  actorId: string
  requestId?: string
}

export class ModerationService {
  private auditSvc: AuditLogService
  private indexSync: VideoIndexSyncService

  constructor(
    private db: Pool,
    private es: ESClient,
  ) {
    this.auditSvc = new AuditLogService(db)
    this.indexSync = new VideoIndexSyncService(db, es)
  }

  async rejectLabeled(input: RejectLabeledInput) {
    const label = await findReviewLabelByKey(this.db, input.labelKey)
    const resolvedLabelKey = label?.is_active ? input.labelKey : 'other'
    const resolvedReason = input.reason ?? (label?.label ?? '其他')

    const result = await transitionVideoState(this.db, input.videoId, {
      action: 'reject',
      reviewedBy: input.actorId,
      reason: resolvedReason,
      expectedUpdatedAt: input.expectedUpdatedAt,
    })

    if (!result) return null

    await this.db.query(
      `UPDATE videos SET review_label_key = $1, review_reason = $2 WHERE id = $3`,
      [resolvedLabelKey, resolvedReason, input.videoId],
    )

    this.auditSvc.write({
      actorId: input.actorId,
      actionType: 'video.reject_labeled',
      targetKind: 'video',
      targetId: input.videoId,
      afterJsonb: { labelKey: resolvedLabelKey, reason: resolvedReason },
      requestId: input.requestId,
    })

    void this.indexSync.unindexVideo(input.videoId)

    return result
  }

  async updateStaffNote(input: StaffNoteInput) {
    const result = await this.db.query<{ id: string; updated_at: string }>(
      `UPDATE videos SET staff_note = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, updated_at`,
      [input.note, input.videoId],
    )
    const row = result.rows[0]
    if (!row) return null

    this.auditSvc.write({
      actorId: input.actorId,
      actionType: 'video.staff_note',
      targetKind: 'video',
      targetId: input.videoId,
      afterJsonb: { note: input.note },
      requestId: input.requestId,
    })

    return row
  }

  async stagingRevert(input: StagingRevertInput) {
    const result = await transitionVideoState(this.db, input.videoId, {
      action: 'staging_revert',
      expectedUpdatedAt: input.expectedUpdatedAt,
    })

    if (!result) return null

    this.auditSvc.write({
      actorId: input.actorId,
      actionType: 'staging.revert',
      targetKind: 'staging',
      targetId: input.videoId,
      requestId: input.requestId,
    })

    return result
  }

  async toggleSource(input: SourceToggleInput) {
    const result = await toggleVideoSource(this.db, input.sourceId, input.isActive)
    if (!result) return null

    this.auditSvc.write({
      actorId: input.actorId,
      actionType: 'video_source.toggle',
      targetKind: 'video_source',
      targetId: input.sourceId,
      afterJsonb: { isActive: input.isActive, videoId: input.videoId },
      requestId: input.requestId,
    })

    void this.indexSync.syncVideo(input.videoId)
    return result
  }

  async disableDead(input: DisableDeadInput) {
    const result = await disableDeadSources(this.db, input.videoId)

    this.auditSvc.write({
      actorId: input.actorId,
      actionType: 'video_source.disable_dead_batch',
      targetKind: 'video',
      targetId: input.videoId,
      afterJsonb: { count: result.disabled, sourceIds: result.sourceIds },
      requestId: input.requestId,
    })

    void this.indexSync.syncVideo(input.videoId)
    return result
  }
}
