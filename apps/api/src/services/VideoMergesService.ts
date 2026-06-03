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
// CHG-VIR-9-A：merge source=identity 读 identity_candidate 候选（默认 legacy，空表降级）
import { listPendingCandidatePairs, countPendingCandidatePairs } from '@/api/db/queries/identity-candidate'
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
import { MediaCatalogService } from '@/api/services/MediaCatalogService'
// CHG-VIR-9-B / ADR-178：merge 事务挂 decision(confirmed) + unmerge 联动 reverted（R8 / D-105a-11）
import { IdentityCandidatesService } from '@/api/services/IdentityCandidatesService'
import {
  findConfirmedDecisionByAuditId,
  markDecisionReverted,
} from '@/api/db/queries/identity-decision'
import { AppError } from '@/api/lib/errors'
import { normalizeMergeKey } from '@/api/services/TitleNormalizer'
import {
  computeOverlapScore,
  pickRecommendedTarget,
  mapVideoRow,
  buildGroupFromPair,
} from './VideoMergesService.schemas'
// CHG-VIR-7 Phase 2a：多证据身份评分（identityScore/evidence，与 legacyScore 分离 / R3）
import { scoreGroup, SCORER_VERSION } from './identity'
import { TITLE_PARSER_VERSION } from './TitleIdentityParser'

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
  private catalogSvc: MediaCatalogService

  constructor(private db: Pool) {
    this.auditSvc = new AuditLogService(db)
    // CHG-VIR-PRE-1: split 新建 video 前需 findOrCreate 作品层 catalog（catalog_id NOT NULL / migration 029）。
    this.catalogSvc = new MediaCatalogService(db)
  }

  async listCandidates(params: ListCandidatesParams): Promise<ListCandidatesResult> {
    const { type = null, minScore, limit, page } = params
    const typeFilter = type ?? null

    // CHG-VIR-9-A：source=identity 读 identity_candidate 候选（每 pending pair→2-video group）；
    // 空表自动降级 legacy（默认 legacy，待 shadow 稳定后翻默认）。
    if ((params.source ?? 'legacy') === 'identity') {
      const identityResult = await this.listIdentityCandidates(page, limit)
      if (identityResult) return identityResult
      // identity 候选空 → 落回 legacy
    }

    // 两步查询：先取候选组，再批量取 video 详情
    const offset = (page - 1) * limit
    const [rawGroups, total] = await Promise.all([
      fetchRawCandidateGroups(this.db, { type: typeFilter, offset, limit }),
      countRawCandidateGroups(this.db, { type: typeFilter }),
    ])

    if (rawGroups.length === 0) {
      return { data: [], total, page, limit, source: 'legacy' }
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
        score: Math.round(score * 10000) / 10000,  // 4 位小数（legacyScore）
        recommendedTargetVideoId: pickRecommendedTarget(videos),
        // CHG-VIR-7：附加多证据身份评分（D-105a-9/15）。纯 CPU 无新 DB 往返；
        // minScore 过滤/排序/分页仍只看 legacyScore（Y-105a-1，候选数量/排序逐值不变）
        identity: scoreGroup(videos),
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

    return { data: groups, total, page, limit, source: 'legacy' }
  }

  /**
   * CHG-VIR-9-A：source=identity 读 identity_candidate pending 候选，每 pair→2-video CandidateGroup。
   * 返回 null 表示候选**真空表**（调用方降级 legacy）。merge 默认 legacy，本路径待 shadow 稳定后翻默认。
   *
   * CHG-VIR-9-C FIX-2（Codex review）：total = 全量 pending count（曾误用当前页 groups.length，
   * 候选超 limit 时前端无法翻页）；total>0 但本页空（offset 超尾）返回空 data 而**不悄降 legacy**
   * （identity 模式翻页中突现 legacy 全量数据是更坏的语义漂移）。
   */
  private async listIdentityCandidates(page: number, limit: number): Promise<ListCandidatesResult | null> {
    const offset = (page - 1) * limit
    const versions = { scorerVersion: SCORER_VERSION, parserVersion: TITLE_PARSER_VERSION }
    const [pairs, total] = await Promise.all([
      listPendingCandidatePairs(this.db, { ...versions, limit, offset }),
      countPendingCandidatePairs(this.db, versions),
    ])
    if (total === 0) return null

    const videoIds = [...new Set(pairs.flatMap((p) => [p.left_video_id, p.right_video_id]))]
    const details = await fetchVideoDetailsForCandidates(this.db, videoIds)
    const videoMap = new Map(details.map((v) => [v.id, mapVideoRow(v)]))
    const groups = pairs
      .map((p) => buildGroupFromPair(p, videoMap))
      .filter((g): g is CandidateGroup => g !== null)
    return { data: groups, total, page, limit, source: 'identity' }
  }

  // ── merge ─────────────────────────────────────────────────────────

  /** merge 步骤 1：校验所有 video 存在 + target/source 未被软删（404/409）。返回 videoMap 供 snapshot 用。 */
  private async assertVideosMergeable(
    sourceVideoIds: string[],
    targetVideoId: string,
  ): Promise<Map<string, Awaited<ReturnType<typeof fetchVideosByIds>>[number]>> {
    const allIds = [...sourceVideoIds, targetVideoId]
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
    return videoMap
  }

  /**
   * merge 步骤 4：事务执行 INSERT audit + 转移 sources + 软删除 source videos
   * （+ candidateId 时同事务挂 decision(confirmed)+candidate confirmed / R8 单 BEGIN/COMMIT）。
   */
  private async runMergeTransaction(params: {
    sourceVideoIds: string[]
    targetVideoId: string
    reason: string | undefined
    candidateId: string | undefined
    snapshotJsonb: Record<string, unknown>
    actorId: string
  }): Promise<{ auditId: string; decisionId: string | null }> {
    const { sourceVideoIds, targetVideoId, reason, candidateId, snapshotJsonb, actorId } = params
    const client = await this.db.connect()
    let auditId: string
    let decisionId: string | null = null
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

      if (candidateId) {
        decisionId = await IdentityCandidatesService.attachConfirmedDecision(client, {
          candidateId,
          videoMergeAuditId: auditId,
          performedBy: actorId,
        })
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
    return { auditId, decisionId }
  }

  async merge(params: MergeParams, actorId: string): Promise<MergeResult> {
    const { sourceVideoIds, targetVideoId, reason, candidateId } = params
    const allIds = [...sourceVideoIds, targetVideoId]

    // 1. 校验所有 video 存在且未删除（404/409 / 抽 assertVideosMergeable）
    const videoMap = await this.assertVideosMergeable(sourceVideoIds, targetVideoId)

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

    // 2b. CHG-VIR-9-B / ADR-178 D-178-3：candidateId 事务前快速失败校验（BEGIN 之前，主路径零变更）
    if (candidateId) {
      await IdentityCandidatesService.validateForMerge(this.db, candidateId, allIds)
    }

    // 3. 构建 snapshot（source videos 完整数据 + 它们的 sources）
    const sourcesOfSources = await fetchSourcesByVideoIds(this.db, sourceVideoIds)
    const snapshotJsonb = {
      videos: sourceVideoIds.map(id => videoMap.get(id)),
      sources: sourcesOfSources.map(s => ({ id: s.id, video_id: s.video_id })),
    }

    // 4. 事务（抽 runMergeTransaction / R8 单 BEGIN/COMMIT）
    const { auditId, decisionId } = await this.runMergeTransaction({
      sourceVideoIds, targetVideoId, reason, candidateId, snapshotJsonb, actorId,
    })

    // 5. 拼装合并后 target 摘要（ADR-105 §端点契约 row 2：targetVideo: VideoSummary）
    // CHG-SN-5-10-PATCH P0-1：COMMIT 后查 target 详情反映合并后 sourceCount/sourceSiteKeys 新状态
    const [targetDetail] = await fetchVideoDetailsForCandidates(this.db, [targetVideoId])
    if (!targetDetail) {
      // 理论不可达：COMMIT 已完成 + targetVideo 未被删除（前置校验通过）
      throw new AppError('NOT_FOUND', `target video ${targetVideoId} 在合并后不可用`, 404)
    }
    const targetVideo = mapVideoRow(targetDetail)

    // 6. fire-and-forget admin_audit_log（COMMIT 后才写，防虚假记录）
    // CHG-VIR-9-B / ADR-178 D-178-6：candidateId 路径 afterJsonb 纯增量补 candidateId/decisionId
    this.auditSvc.write({
      actorId,
      actionType: 'video.merge',
      targetKind: 'video',
      targetId: targetVideoId,
      beforeJsonb: { sourceVideoIds, snapshot: snapshotJsonb },
      afterJsonb: candidateId
        ? { auditId, targetVideoId, candidateId, decisionId }
        : { auditId, targetVideoId },
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
        // CHG-VIR-9-B / ADR-178 D-178-4：经 audit_id 反查关联 confirmed decision 原地置 reverted
        // （decision 值不变 / candidate 保持 confirmed 不回 pending，避撞 uq_identity_candidate_pending）
        const decision = await findConfirmedDecisionByAuditId(client, auditId)
        if (decision) {
          await markDecisionReverted(client, decision.id, actorId, reason ?? null)
        }
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

    // CHG-VIR-PRE-1: 事务前为每个拆分组 findOrCreate 作品层 catalog（catalog_id NOT NULL / migration 029）。
    // findOrCreate 自身原子（幂等：同 (title_normalized, year, type) 复用现有 catalog）；置于 split 事务外——
    // 即便后续 split 事务回滚，新建 catalog 至多成无 video 指向的孤儿行（共享作品层无害，下次同作品复用），
    // 以此避免改 MediaCatalogService.findOrCreate 签名去支持外部事务 client。
    const groupCatalogIds: string[] = []
    for (const group of groups) {
      const catalog = await this.catalogSvc.findOrCreate({
        title: group.newVideoMeta.title,
        titleNormalized: normalizeMergeKey(group.newVideoMeta.title),
        year: group.newVideoMeta.year ?? null,
        type: group.newVideoMeta.type,
        metadataSource: 'manual',
      })
      groupCatalogIds.push(catalog.id)
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

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i]!
        const shortId = Math.random().toString(36).slice(2, 10)
        const newVideoId = await insertNewVideo(client, {
          shortId,
          catalogId: groupCatalogIds[i]!,
          title: group.newVideoMeta.title,
          type: group.newVideoMeta.type,
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
