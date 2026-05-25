/**
 * VideoMergesService.ts — video 合并/拆分/撤销业务层（ADR-105 / CHG-SN-5-09/-10）
 *
 * 职责：
 *   - listCandidates(): 查询候选组 + 计算 source_overlap_ratio 评分 + minScore 过滤 + 分页
 *   - merge(): 执行合并（事务内）+ fire-and-forget admin_audit_log
 *   - unmerge(): 撤销合并/拆分（事务内）+ fire-and-forget admin_audit_log
 *   - split(): 拆分 video（事务内）+ fire-and-forget admin_audit_log
 *
 * Schema + 评分辅助函数已拆分到 VideoMergesService.schemas.ts
 */

import type { Pool } from 'pg'
import type {
  ListCandidatesParams,
  ListCandidatesResult,
  CandidateGroup,
  VideoSummaryForMerge,
  MergeParams,
  MergeResult,
  UnmergeResult,
  SplitParams,
  SplitResult,
  ListAuditParams,
  ListAuditResult,
  MergeAuditRow,
} from '@resovo/types'
import {
  fetchRawCandidateGroups,
  countRawCandidateGroups,
  fetchVideoDetailsForCandidates,
} from '@/api/db/queries/video-merge-candidates'
import {
  fetchVideosByIds,
  fetchSourcesByVideoId,
  fetchSourcesByVideoIds,
  detectMergeConflicts,
  fetchAuditById,
  insertMergeAudit,
  transferSourcesToTarget,
  softDeleteVideos,
  restoreVideos,
  reassignSourcesToOriginal,
  markAuditReverted,
  insertNewVideo,
  assignSourcesToVideo,
  updateAuditTargetIds,
  listAuditTimeline,
  countAuditTimeline,
} from '@/api/db/queries/video-merge-mutations'
import { AuditLogService } from '@/api/services/AuditLogService'
import { AppError } from '@/api/lib/errors'
import { normalizeTitle } from '@/api/services/TitleNormalizer'
import {
  computeOverlapScore,
  pickRecommendedTarget,
  mapVideoRow,
} from './VideoMergesService.schemas'

// ── 公开 re-export（外部 import 路径保持不变）──────────────────
export {
  VideoTypeEnum,
  ListCandidatesSchema,
  MergeSchema,
  UnmergeSchema,
  SplitSchema,
  ListAuditSchema,
} from './VideoMergesService.schemas'

// ── Service ──────────────────────────────────────────────────────

export class VideoMergesService {
  private auditSvc: AuditLogService

  constructor(private db: Pool) {
    this.auditSvc = new AuditLogService(db)
  }

  async listCandidates(params: ListCandidatesParams): Promise<ListCandidatesResult> {
    const { type = null, minScore, limit, page } = params
    const typeFilter = type ?? null

    // 两步查询：先取候选组，再批量取 video 详情
    const offset = (page - 1) * limit
    const [rawGroups, total] = await Promise.all([
      fetchRawCandidateGroups(this.db, { type: typeFilter, offset, limit }),
      countRawCandidateGroups(this.db, { type: typeFilter }),
    ])

    if (rawGroups.length === 0) {
      return { data: [], total, page, limit }
    }

    // 批量获取所有相关 video 的详情
    const allVideoIds = rawGroups.flatMap(g => g.video_ids)
    const videoDetails = await fetchVideoDetailsForCandidates(this.db, allVideoIds)
    const videoMap = new Map(videoDetails.map(v => [v.id, mapVideoRow(v)]))

    // 组装候选组 + 计算评分 + 过滤
    const groups: CandidateGroup[] = []
    for (const raw of rawGroups) {
      const videos = raw.video_ids
        .map(id => videoMap.get(id))
        .filter((v): v is VideoSummaryForMerge => v !== undefined)

      if (videos.length < 2) continue

      const score = computeOverlapScore(videos)
      if (score < minScore) continue

      groups.push({
        groupKey: `${raw.title_normalized}|${raw.year ?? ''}|${raw.type}`,
        titleNormalized: raw.title_normalized,
        year: raw.year,
        type: raw.type,
        videos,
        score: Math.round(score * 10000) / 10000,  // 4 位小数
        recommendedTargetVideoId: pickRecommendedTarget(videos),
      })
    }

    // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 全栈打通 / Service 层 4 字段白名单
    // 默认 score DESC（保持向后兼容）/ tiebreaker groupKey ASC（CHG-SN-5-10-PATCH P2）
    const sortField = params.sortField ?? 'score'
    const sortDir = params.sortDir ?? 'desc'
    const dirSign = sortDir === 'asc' ? 1 : -1
    groups.sort((a, b) => {
      let cmp: number
      switch (sortField) {
        case 'score':
          cmp = a.score - b.score
          break
        case 'videoCount':
          cmp = a.videos.length - b.videos.length
          break
        case 'year':
          cmp = (a.year ?? 0) - (b.year ?? 0)
          break
        case 'titleNormalized':
          cmp = a.titleNormalized.localeCompare(b.titleNormalized)
          break
        default:
          cmp = a.score - b.score
      }
      if (cmp !== 0) return cmp * dirSign
      // tiebreaker：groupKey 升序（分页幂等）
      return a.groupKey.localeCompare(b.groupKey)
    })

    return { data: groups, total, page, limit }
  }

  // ── merge ─────────────────────────────────────────────────────────

  async merge(params: MergeParams, actorId: string): Promise<MergeResult> {
    const { sourceVideoIds, targetVideoId, reason } = params
    const allIds = [...sourceVideoIds, targetVideoId]

    // 1. 校验所有 video 存在且未删除
    const videos = await fetchVideosByIds(this.db, allIds)
    const videoMap = new Map(videos.map(v => [v.id, v]))

    for (const id of allIds) {
      if (!videoMap.has(id)) {
        throw new AppError('NOT_FOUND', `video ${id} 不存在`, 404)
      }
    }

    const targetVideoRow = videoMap.get(targetVideoId)!
    if (targetVideoRow.deleted_at !== null) {
      throw new AppError('STATE_CONFLICT', 'targetVideoId 已被合并到其他视频（不可作为合并目标）', 409)
    }

    for (const id of sourceVideoIds) {
      const v = videoMap.get(id)!
      if (v.deleted_at !== null) {
        throw new AppError('STATE_CONFLICT', `sourceVideoId ${id} 已被合并到其他视频（无法作为合并源）`, 409)
      }
    }

    // 2. 前置冲突探测（uq_sources_video_episode_url）
    // ADR-105 R-105-1 + CHG-SN-5-10-PATCH P0-2：探测合并后集合内任意两点冲突
    // （覆盖 source-vs-source + source-vs-target 全部路径）
    const conflictCount = await detectMergeConflicts(this.db, [...sourceVideoIds, targetVideoId])
    if (conflictCount > 0) {
      throw new AppError(
        'STATE_CONFLICT',
        `source 与 target 视频存在重复 (episode_number, source_url) 组合 ${conflictCount} 条，请先在 /admin/sources 视图处理（保留其一删除其余）后再合并`,
        409,
      )
    }

    // 3. 构建 snapshot（source videos 完整数据 + 它们的 sources）
    const sourcesOfSources = await fetchSourcesByVideoIds(this.db, sourceVideoIds)
    const snapshotJsonb = {
      videos: sourceVideoIds.map(id => videoMap.get(id)),
      sources: sourcesOfSources.map(s => ({ id: s.id, video_id: s.video_id })),
    }

    // 4. 事务：INSERT audit + 转移 sources + 软删除 source videos
    const client = await this.db.connect()
    let auditId: string
    try {
      await client.query('BEGIN')

      auditId = await insertMergeAudit(client, {
        action: 'merge',
        sourceVideoIds,
        targetVideoIds: [targetVideoId],
        snapshotJsonb,
        performedBy: actorId,
        reason: reason ?? null,
      })

      await transferSourcesToTarget(client, sourceVideoIds, targetVideoId)
      await softDeleteVideos(client, sourceVideoIds)

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    // 5. 拼装合并后 target 摘要（ADR-105 §端点契约 row 2：targetVideo: VideoSummary）
    // CHG-SN-5-10-PATCH P0-1：COMMIT 后查 target 详情反映合并后 sourceCount/sourceSiteKeys 新状态
    const [targetDetail] = await fetchVideoDetailsForCandidates(this.db, [targetVideoId])
    if (!targetDetail) {
      // 理论不可达：COMMIT 已完成 + targetVideo 未被删除（前置校验通过）
      throw new AppError('NOT_FOUND', `target video ${targetVideoId} 在合并后不可用`, 404)
    }
    const targetVideo = mapVideoRow(targetDetail)

    // 6. fire-and-forget admin_audit_log（COMMIT 后才写，防虚假记录）
    this.auditSvc.write({
      actorId,
      actionType: 'video.merge',
      targetKind: 'video',
      targetId: targetVideoId,
      beforeJsonb: { sourceVideoIds, snapshot: snapshotJsonb },
      afterJsonb: { auditId, targetVideoId },
    })

    return { auditId, targetVideo }
  }

  // ── unmerge ───────────────────────────────────────────────────────

  async unmerge(
    auditId: string,
    actorId: string,
    reason?: string,
  ): Promise<UnmergeResult> {
    // 1. 拉取 audit 记录
    const audit = await fetchAuditById(this.db, auditId)
    if (!audit) {
      throw new AppError('NOT_FOUND', `audit ${auditId} 不存在`, 404)
    }
    if (audit.reverted_at !== null) {
      throw new AppError('STATE_CONFLICT', '该合并/拆分已被撤销（reverted_at IS NOT NULL）', 409)
    }

    const snapshotSources = (
      (audit.snapshot_jsonb as { sources?: Array<{ id: string; video_id: string }> }).sources ?? []
    )

    let restoredVideoIds: string[]

    if (audit.action === 'merge') {
      // 撤销合并：还原 source videos + 归还 sources
      restoredVideoIds = audit.source_video_ids

      const client = await this.db.connect()
      try {
        await client.query('BEGIN')
        await restoreVideos(client, restoredVideoIds)
        await reassignSourcesToOriginal(client, snapshotSources)
        await markAuditReverted(client, auditId, actorId, reason ?? null)
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    } else {
      // 撤销拆分：还原原始 video + 归还 sources + 软删除拆分后 new videos
      restoredVideoIds = audit.source_video_ids
      const newVideoIds = audit.target_video_ids

      const client = await this.db.connect()
      try {
        await client.query('BEGIN')
        await restoreVideos(client, restoredVideoIds)
        await reassignSourcesToOriginal(client, snapshotSources)
        await softDeleteVideos(client, newVideoIds)
        await markAuditReverted(client, auditId, actorId, reason ?? null)
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }

    // fire-and-forget admin_audit_log
    const firstRestoredId = restoredVideoIds[0] ?? auditId
    const revertedFromTargetVideoId = audit.action === 'merge' ? audit.target_video_ids[0] : undefined
    this.auditSvc.write({
      actorId,
      actionType: 'video.unmerge',
      targetKind: 'video',
      targetId: firstRestoredId,
      beforeJsonb: { auditId, action: audit.action, revertedFromTargetVideoId },
      afterJsonb: { restoredVideoIds },
    })

    return { restoredVideoIds }
  }

  // ── split ─────────────────────────────────────────────────────────

  async split(params: SplitParams, actorId: string): Promise<SplitResult> {
    // CHG-SN-5-10-PATCH P2：SplitParams 不含 reason（ADR §端点契约 Body 不含）
    const { videoId, groups } = params

    // 1. 校验原 video 存在
    const videos = await fetchVideosByIds(this.db, [videoId])
    const video = videos[0]
    if (!video) {
      throw new AppError('NOT_FOUND', `video ${videoId} 不存在`, 404)
    }
    if (video.deleted_at !== null) {
      throw new AppError('STATE_CONFLICT', '该视频已被合并，请先 unmerge 后再 split', 409)
    }

    // 2. 拉取全部 sources + 校验完整划分（Y-105-3）
    const currentSources = await fetchSourcesByVideoId(this.db, videoId)
    const currentSourceIdSet = new Set(currentSources.map(s => s.id))
    const groupSourceIds = groups.flatMap(g => g.sourceIds)
    const groupSourceIdSet = new Set(groupSourceIds)

    if (groupSourceIds.length !== groupSourceIdSet.size) {
      throw new AppError(
        'VALIDATION_ERROR',
        'groups.sourceIds 必须覆盖且仅覆盖拆分前 video 的全部 sources（不允许孤儿或重复）',
        422,
      )
    }

    for (const id of groupSourceIdSet) {
      if (!currentSourceIdSet.has(id)) {
        throw new AppError(
          'VALIDATION_ERROR',
          'groups.sourceIds 必须覆盖且仅覆盖拆分前 video 的全部 sources（不允许孤儿或重复）',
          422,
        )
      }
    }

    if (groupSourceIdSet.size !== currentSourceIdSet.size) {
      throw new AppError(
        'VALIDATION_ERROR',
        'groups.sourceIds 必须覆盖且仅覆盖拆分前 video 的全部 sources（不允许孤儿或重复）',
        422,
      )
    }

    // 3. 构建 snapshot（原始 video + 全部 sources）
    const snapshotJsonb = {
      videos: [video],
      sources: currentSources.map(s => ({ id: s.id, video_id: s.video_id })),
    }

    // 4. 事务：INSERT audit + 创建新 videos + 分配 sources + 软删除原 video
    const client = await this.db.connect()
    let auditId: string
    const newVideoIds: string[] = []

    try {
      await client.query('BEGIN')

      // 先 INSERT audit（source_video_ids 已知；target_video_ids 待拆分后补）
      // 使用空数组占位，后续 UPDATE 填入真实新 video ids
      auditId = await insertMergeAudit(client, {
        action: 'split',
        sourceVideoIds: [videoId],
        targetVideoIds: [],
        snapshotJsonb,
        performedBy: actorId,
        reason: null,
      })

      for (const group of groups) {
        const shortId = Math.random().toString(36).slice(2, 10)
        const newVideoId = await insertNewVideo(client, {
          shortId,
          title: group.newVideoMeta.title,
          year: group.newVideoMeta.year ?? null,
          type: group.newVideoMeta.type,
          titleNormalized: normalizeTitle(group.newVideoMeta.title),
        })
        newVideoIds.push(newVideoId)
        await assignSourcesToVideo(client, group.sourceIds, newVideoId)
      }

      // 回填 target_video_ids（CHG-SN-5-10-PATCH P2：抽出到 mutations.updateAuditTargetIds）
      await updateAuditTargetIds(client, auditId, newVideoIds)

      await softDeleteVideos(client, [videoId])

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    // fire-and-forget admin_audit_log
    this.auditSvc.write({
      actorId,
      actionType: 'video.split',
      targetKind: 'video',
      targetId: videoId,
      beforeJsonb: { originalVideoId: videoId, snapshot: snapshotJsonb },
      afterJsonb: { auditId, newVideoIds },
    })

    return { auditId, newVideoIds }
  }

  // ── audit timeline (CHG-SN-6-AUDIT-TIMELINE / RETRO 4/7) ──────────

  async listAudit(params: ListAuditParams): Promise<ListAuditResult> {
    const { action = null, videoId = null, limit, page } = params
    const offset = (page - 1) * limit
    const [rows, total] = await Promise.all([
      listAuditTimeline(this.db, { action, videoId, offset, limit }),
      countAuditTimeline(this.db, { action, videoId }),
    ])
    const data: MergeAuditRow[] = rows.map((r) => ({
      id: r.id,
      action: r.action,
      sourceVideoIds: r.source_video_ids,
      targetVideoIds: r.target_video_ids,
      performedBy: r.performed_by,
      performedByUsername: r.performed_by_username,
      reason: r.reason,
      performedAt: r.performed_at,
      revertedAt: r.reverted_at,
      revertedBy: r.reverted_by,
      revertedReason: r.reverted_reason,
    }))
    return { data, total, page, limit }
  }
}
