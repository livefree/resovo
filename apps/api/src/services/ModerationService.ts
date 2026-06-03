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
import {
  findVideoFeatures,
  listSimilarCandidates,
  type VideoFeatures,
  type SimilarCandidateRow,
} from '@/api/db/queries/moderation'
// CHG-VIR-9-A：审核台 similar 切 identity_candidate 来源（默认 identity，空表降级 legacy）
import { listPendingCandidatesByVideoId } from '@/api/db/queries/identity-candidate'
import { SCORER_VERSION } from '@/api/services/identity'
import { TITLE_PARSER_VERSION } from '@/api/services/TitleIdentityParser'
import type { EvidenceType } from '@resovo/types'
import { AppError, ERRORS } from '@/api/lib/errors'
import { baseLogger } from '@/api/lib/logger'

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
  /** CHG-SN-5-PRE-01-C：可选乐观锁，提供时 query 层比对 video_sources.updated_at。 */
  expectedUpdatedAt?: string
  actorId: string
  requestId?: string
}

export interface DisableDeadInput {
  videoId: string
  actorId: string
  requestId?: string
}

/** CHG-SN-4-10-A2 audit 补全 */
export interface ApproveInput {
  videoId: string
  actorId: string
  expectedUpdatedAt?: string
  requestId?: string
}

/** CHG-SN-4-10-A2 audit 补全 */
export interface ReopenInput {
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
    if (!label || !label.is_active) {
      throw new AppError('LABEL_UNKNOWN', ERRORS.LABEL_UNKNOWN.message, ERRORS.LABEL_UNKNOWN.status)
    }

    const resolvedReason = input.reason ?? label.label

    const result = await transitionVideoState(this.db, input.videoId, {
      action: 'reject',
      reviewedBy: input.actorId,
      reason: resolvedReason,
      expectedUpdatedAt: input.expectedUpdatedAt,
      reviewLabelKey: label.label_key,
    })

    if (!result) return null

    this.auditSvc.write({
      actorId: input.actorId,
      actionType: 'video.reject_labeled',
      targetKind: 'video',
      targetId: input.videoId,
      afterJsonb: { labelKey: label.label_key, reason: resolvedReason },
      requestId: input.requestId,
    })

    this.indexSync.unindexVideo(input.videoId).catch((err: unknown) => {
      baseLogger.warn({ err, videoId: input.videoId }, 'ES unindexVideo failed after rejectLabeled')
    })

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
    const result = await toggleVideoSource(this.db, {
      sourceId: input.sourceId,
      isActive: input.isActive,
      expectedUpdatedAt: input.expectedUpdatedAt,
    })
    if (!result) return null

    this.auditSvc.write({
      actorId: input.actorId,
      actionType: 'video_source.toggle',
      targetKind: 'video_source',
      targetId: input.sourceId,
      afterJsonb: { isActive: input.isActive, videoId: input.videoId },
      requestId: input.requestId,
    })

    this.indexSync.syncVideo(input.videoId).catch((err: unknown) => {
      baseLogger.warn({ err, videoId: input.videoId }, 'ES syncVideo failed after source toggle')
    })
    return result
  }

  /**
   * 单条审核通过（pending_review → approved）
   * CHG-SN-4-10-A2：替代路由层裸调 transitionVideoState，封装 audit log 写入
   * 返回 null 表示未进行状态切换（如非 pending_review / 乐观锁冲突）
   */
  async approve(input: ApproveInput) {
    const result = await transitionVideoState(this.db, input.videoId, {
      action: 'approve',
      reviewedBy: input.actorId,
      expectedUpdatedAt: input.expectedUpdatedAt,
    })

    if (!result) return null

    this.auditSvc.write({
      actorId: input.actorId,
      actionType: 'video.approve',
      targetKind: 'video',
      targetId: input.videoId,
      requestId: input.requestId,
    })

    return result
  }

  /**
   * 复审：rejected → pending_review
   * CHG-SN-4-10-A2：替代路由层裸调 transitionVideoState，封装 audit log 写入
   */
  async reopen(input: ReopenInput) {
    const result = await transitionVideoState(this.db, input.videoId, {
      action: 'reopen_pending',
    })

    if (!result) return null

    this.auditSvc.write({
      actorId: input.actorId,
      actionType: 'video.reopen',
      targetKind: 'video',
      targetId: input.videoId,
      requestId: input.requestId,
    })

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

    this.indexSync.syncVideo(input.videoId).catch((err: unknown) => {
      baseLogger.warn({ err, videoId: input.videoId }, 'ES syncVideo failed after disableDead')
    })
    return result
  }

  /**
   * CHG-SN-8-04-EP · ADR-137：类似视频召回
   *
   * 流程：findVideoFeatures（404 if null）→ listSimilarCandidates strict 粗筛（LIMIT 50）
   *       → 4 维加权 similarityScore → minScore=10 过滤 → score desc top-N
   *
   * CHG-SN-8-04-N1（ADR-137 §11 N1 闭合）：strict 候选 < limit 时发起 fallback relaxType 查询补足
   *   - fallback 查询排除首次结果 ids
   *   - 跨类型候选 type 维度 +0（公式自然），合并后整体 score 排序
   */
  async listSimilar(
    videoId: string,
    opts: { readonly limit: number; readonly yearRange: number; readonly source?: 'identity' | 'legacy' },
  ): Promise<SimilarResult> {
    const target = await findVideoFeatures(this.db, videoId)
    if (!target) {
      throw new AppError('NOT_FOUND', ERRORS.NOT_FOUND.message, ERRORS.NOT_FOUND.status)
    }

    // CHG-VIR-9-A：source=identity（默认）读 identity_candidate 候选；空表自动降级 legacy（ADR-137 AMENDMENT 2.0）
    if ((opts.source ?? 'identity') === 'identity') {
      const rows = await listPendingCandidatesByVideoId(this.db, {
        videoId,
        scorerVersion: SCORER_VERSION,
        parserVersion: TITLE_PARSER_VERSION,
        limit: opts.limit,
      })
      if (rows.length > 0) {
        const items: SimilarVideoItem[] = rows.map((row) => {
          const identityScore = Number(row.identity_score)
          return {
            id: row.neighbor_video_id,
            title: row.title,
            type: row.type,
            year: row.year,
            country: row.country,
            genres: row.genres,
            coverUrl: row.cover_url,
            metaScore: row.meta_score,
            reviewStatus: row.review_status,
            isPublished: row.is_published,
            // 旧字段保留（identity 来源填 round(identityScore*100) 保旧前端不空）
            similarityScore: Math.round(identityScore * 100),
            // identity 来源附加字段（向后兼容 optional / R3 与 similarityScore 分离）
            candidateId: row.candidate_id,
            identityScore,
            strongNegativeReasons: row.strong_negative_reasons as EvidenceType[],
            status: row.status as 'pending' | 'confirmed' | 'rejected',
          }
        })
        return { items, source: 'identity' }
      }
      // identity 候选空（未回填/job 未跑）→ 落回 legacy
    }

    // strict 查询：type 严格相等
    const strictCandidates = await listSimilarCandidates(this.db, {
      excludeId: target.id,
      type: target.type,
      year: target.year,
      yearRange: opts.yearRange,
    })

    // 评分 + minScore 过滤
    const strictScored = strictCandidates
      .map((row) => ({ row, score: computeSimilarityScore(target, row, opts.yearRange) }))
      .filter((entry) => entry.score >= MIN_SCORE)

    let allScored = strictScored

    // ADR-137 N1 fallback：strict 通过 minScore 后 < limit 时跨类型补足
    if (strictScored.length < opts.limit) {
      const strictIds = strictCandidates.map((row) => row.id)
      const fallbackCandidates = await listSimilarCandidates(this.db, {
        excludeId: target.id,
        type: target.type, // 占位（relaxType=true 时不参与 WHERE）
        year: target.year,
        yearRange: opts.yearRange,
        relaxType: true,
        excludeIds: strictIds,
        limit: Math.max(50 - strictCandidates.length, 10), // 留余度但保 LIMIT
      })
      const fallbackScored = fallbackCandidates
        .map((row) => ({ row, score: computeSimilarityScore(target, row, opts.yearRange) }))
        .filter((entry) => entry.score >= MIN_SCORE)
      allScored = [...strictScored, ...fallbackScored]
    }

    const finalScored = allScored
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.limit)

    const items: SimilarVideoItem[] = finalScored.map(({ row, score }) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      year: row.year,
      country: row.country,
      genres: row.genres,
      coverUrl: row.cover_url,
      metaScore: row.meta_score,
      reviewStatus: row.review_status,
      isPublished: row.is_published,
      similarityScore: score,
    }))
    return { items, source: 'legacy' }
  }
}

// ── CHG-SN-8-04-EP · ADR-137 similarity 评分 ─────────────────────

/** 内部过滤下限（ADR-137 §3 D-137-4）：score < 10 视为噪声不返回 */
const MIN_SCORE = 10

/** 4 维加权 0-100（ADR-137 §3 D-137-2 公式） */
export function computeSimilarityScore(
  target: VideoFeatures,
  row: Pick<SimilarCandidateRow, 'type' | 'year' | 'country' | 'genres'>,
  yearRange: number,
): number {
  let score = 0

  // 维度 1：type 匹配 +40（SQL 已强约束 type 相等，理论上始终命中；保留逻辑兼容未来 fallback 路径 N1）
  if (row.type === target.type) {
    score += 40
  }

  // 维度 2：year 接近 +25 × (1 - delta/yearRange)；任一为 null 不得分
  if (target.year != null && row.year != null && yearRange > 0) {
    const delta = Math.abs(row.year - target.year)
    if (delta <= yearRange) {
      score += Math.round(25 * (1 - delta / yearRange))
    }
  }

  // 维度 3：country 匹配 +15（双方均非 NULL 且相等）
  if (target.country && row.country && target.country === row.country) {
    score += 15
  }

  // 维度 4：genres Jaccard 相似度 ×20
  const targetGenres = new Set(target.genres)
  const rowGenres = new Set(row.genres)
  if (targetGenres.size > 0 && rowGenres.size > 0) {
    let intersection = 0
    for (const g of rowGenres) {
      if (targetGenres.has(g)) intersection++
    }
    const union = targetGenres.size + rowGenres.size - intersection
    if (union > 0) {
      score += Math.round(20 * (intersection / union))
    }
  }

  return Math.min(100, Math.max(0, score))
}

export interface SimilarVideoItem {
  readonly id: string
  readonly title: string
  readonly type: string
  readonly year: number | null
  readonly country: string | null
  readonly genres: readonly string[]
  readonly coverUrl: string | null
  readonly metaScore: number
  readonly reviewStatus: string
  readonly isPublished: boolean
  /** legacy=4 维加权 0-100；identity 来源=round(identityScore*100)（保旧前端不空 / R3 与 identityScore 分离） */
  readonly similarityScore: number
  // ── CHG-VIR-9-A：identity 来源附加字段（legacy 来源不填 / optional 向后兼容）─────
  /** identity_candidate.id（confirm/reject 操作锚点） */
  readonly candidateId?: string
  /** 多证据 identityScore ∈ [0,1]（D-105a-3） */
  readonly identityScore?: number
  /** 强负 veto 原因（UI「看起来像但被拦截」） */
  readonly strongNegativeReasons?: readonly EvidenceType[]
  /** 候选状态 */
  readonly status?: 'pending' | 'confirmed' | 'rejected'
}

/** listSimilar 结果（回显实际使用来源，便于 UI 判断是否降级 / CHG-VIR-9-A）。 */
export interface SimilarResult {
  readonly items: readonly SimilarVideoItem[]
  readonly source: 'identity' | 'legacy'
}
