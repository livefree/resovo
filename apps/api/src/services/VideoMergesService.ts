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
  StatusTransitionOutcome,
} from '@resovo/types'
import {
  fetchRawCandidateGroups,
  countRawCandidateGroups,
  fetchVideoDetailsForCandidates,
  // D-105a-19（CHG-VIR-16-TBL-BE）：q 搜索 / title·year 排序用轻元数据（videos JOIN media_catalog）
  fetchVideoMetaLight,
} from '@/api/db/queries/video-merge-candidates'
// CHG-VIR-9-A：merge source=identity 读 identity_candidate 候选（空表降级 legacy）
// ADR-105a AMENDMENT 2026-06-05 D-105a-19（CHG-VIR-16-TBL-BE）：有界全量轻列折叠管线
// （listPendingCandidatePairs / countPendingCandidatePairs 在列表路径退役，函数本体保留供报表/测试）
import {
  listPendingCandidatePairsLight,
  listPendingPairsLightByVideoIds,
  listPendingPairsByIds,
  type PendingCandidatePairLightRow,
  type PendingCandidatePairRow,
} from '@/api/db/queries/identity-candidate'
import {
  fetchVideosByIds,
  fetchSourcesByVideoId,
  fetchSourcesByVideoIds,
  // ADR-105 AMENDMENT 2026-06-05 D-105-13~16（CHG-MERGE-DEDUP-EP）：自动去重取并集
  dedupeSourcesForMerge,
  detectResidualTargetConflicts,
  dedupeSourcesForSplitTarget,
  detectResidualSplitTargetConflicts,
  restoreSourcesByIds,
  setAuditDedupedSourceIds,
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
  fetchVideoTitles,
} from '@/api/db/queries/video-merge-mutations'
import { AuditLogService } from '@/api/services/AuditLogService'
import { NotificationEmitter } from '@/api/services/NotificationEmitter'
import { buildAuditNotificationEmit } from '@/api/services/notification-audit-emit'
import { MediaCatalogService } from '@/api/services/MediaCatalogService'
// CHG-VIR-9-B / ADR-178：merge 事务挂 decision(confirmed) + unmerge 联动 reverted（R8 / D-105a-11）
import { IdentityCandidatesService } from '@/api/services/IdentityCandidatesService'
import {
  findConfirmedDecisionsByAuditId,
  markDecisionReverted,
  // ADR-105 D-105-8（CHG-VIR-13-C2）：audit timeline 派生——页内单 SQL 批量反查 decision
  findDecisionsByAuditIds,
} from '@/api/db/queries/identity-decision'
import { AppError } from '@/api/lib/errors'
// ADR-105 AMENDMENT 2026-06-03 D-105-2/3/5（CHG-VIR-11-B）：split 组解析（拆到已有/新建；
// normalizeMergeKey 的 findOrCreate 组装一并移入 helper）
import { resolveSplitGroups } from './VideoMergesService.split-helpers'
// ADR-105 AMENDMENT 2026-06-04 D-105-9/10/11（CHG-VIR-13-D1）：操作内状态设置——
// (current,desired) 矩阵 BEGIN 前校验 + post-COMMIT transitionVideoState 唯一通道（R-105-T2）
import {
  resolveStatusAction,
  applyStatusTransition,
  applyGroupStatusTransitions,
  planTargetStatus,
  restoreTargetStatusBefore,
  SPLIT_INITIAL_STATE,
  type TargetStatusBefore,
} from './VideoMergesService.status-helpers'
import {
  computeOverlapScore,
  pickRecommendedTarget,
  mapVideoRow,
  buildGroupFromCluster,
} from './VideoMergesService.schemas'
// CHG-VIR-9-D / D-105a-18 → D-105a-19：pending pair → connected components 折叠（有界全量）
import { collapsePairs } from './identity/collapsePairsToGroups'
// D-105a-19（CHG-VIR-16-TBL-BE）：组级筛选/搜索谓词 + 组级排序（identity/legacy 双路径共用）
import {
  groupMatchesFilters,
  clusterTitles,
  sortIdentityClusterEntries,
} from './identity/groupFilters'
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

// ── D-105a-19（CHG-VIR-16-TBL-BE）：有界全量折叠常量 ─────────────────

/** 全局折叠 pending pair 上限（当前规模 ~200 的 10× 裕量；超出 → truncated + 闭包补全）。 */
export const MAX_COLLAPSE_PAIRS = 2000
/** R-1 闭包补全守卫：迭代轮次上限（分量典型 2-11 视频，一轮即闭合）。 */
const MAX_CLOSURE_ROUNDS = 3
/** R-1 闭包补全守卫：累计 pair 上限（3×cap）。 */
const MAX_CLOSURE_PAIRS = MAX_COLLAPSE_PAIRS * 3

// ── Service ──────────────────────────────────────────────────────

export class VideoMergesService {
  private auditSvc: AuditLogService
  private catalogSvc: MediaCatalogService
  /** NTLG-P1-c-B-2：解耦双写 emit 中枢（fire-and-forget） */
  private notificationEmitter: NotificationEmitter

  constructor(private db: Pool) {
    this.auditSvc = new AuditLogService(db)
    // CHG-VIR-PRE-1: split 新建 video 前需 findOrCreate 作品层 catalog（catalog_id NOT NULL / migration 029）。
    this.catalogSvc = new MediaCatalogService(db)
    this.notificationEmitter = new NotificationEmitter(db)
  }

  async listCandidates(params: ListCandidatesParams): Promise<ListCandidatesResult> {
    const { type = null, minScore, limit, page } = params
    const typeFilter = type ?? null

    // CHG-VIR-9-A：source=identity 读 identity_candidate 候选；空表自动降级 legacy。
    // CHG-VIR-9-D / D-105a-18：默认翻 identity（zod default 与 Service 兜底两处一致）。
    if ((params.source ?? 'identity') === 'identity') {
      const identityResult = await this.listIdentityCandidates(params)
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

    // D-105a-19（CHG-VIR-16-TBL-BE）：组级筛选/搜索——与 identity 路径共用谓词纯函数。
    // legacy SQL 组级分页在前 → 页内近似（与 minScore 既有过滤同源同阶，AMENDMENT 已登记；
    // total 不计新谓词；legacy 仅 identity 空表降级态）
    const filteredGroups = groups.filter((g) => groupMatchesFilters({
      identityScore: g.identity?.identityScore ?? 0,
      videoCount: g.videos.length,
      titles: g.videos.map((v) => ({ title: v.title, titleNormalized: v.titleNormalized })),
    }, params))

    // ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：sort 全栈打通 / Service 层白名单
    // D-105a-19：扩 identityScore case（CHG-VIR-7 起 legacy 组恒有 identity 字段）
    // 默认 score DESC（保持向后兼容）/ tiebreaker groupKey ASC（CHG-SN-5-10-PATCH P2）
    const sortField = params.sortField ?? 'score'
    const sortDir = params.sortDir ?? 'desc'
    const dirSign = sortDir === 'asc' ? 1 : -1
    filteredGroups.sort((a, b) => {
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
        case 'identityScore':
          cmp = (a.identity?.identityScore ?? 0) - (b.identity?.identityScore ?? 0)
          break
        default:
          cmp = a.score - b.score
      }
      if (cmp !== 0) return cmp * dirSign
      // tiebreaker：groupKey 升序（分页幂等）
      return a.groupKey.localeCompare(b.groupKey)
    })

    return { data: filteredGroups, total, page, limit, source: 'legacy' }
  }

  /**
   * CHG-VIR-9-A：source=identity 读 identity_candidate pending 候选（默认来源 / 9-D 翻转）。
   * 返回 null 表示候选**真空表**（调用方降级 legacy）。
   *
   * ADR-105a AMENDMENT 2026-06-05 D-105a-19（CHG-VIR-16-TBL-BE）：有界全量轻列折叠五阶段管线
   * 取代「pair 级 SQL 分页 + 页内折叠」（D-105a-18 supersede）：组级筛选/排序/搜索/分页，
   * total = 过滤后**组数**（曾为 pending pair 数）；跨页同分量拆行近似随之消除。
   *
   * 降级判定收窄：轻列全量为空（无任何 pending pair）才降级 legacy——**筛选/搜索空不降级**
   * （返回 identity envelope + data:[] + total:0；悄降 legacy 全量数据是 9-C FIX-2 已登记的
   * 「更坏的语义漂移」同型错误）。
   */
  private async listIdentityCandidates(params: ListCandidatesParams): Promise<ListCandidatesResult | null> {
    const { page, limit } = params
    const versions = { scorerVersion: SCORER_VERSION, parserVersion: TITLE_PARSER_VERSION }

    // stage 1：轻列全量（cap+1 探测截断）。降级判定在任何组级筛选之前。
    const probe = await listPendingCandidatePairsLight(this.db, { ...versions, limit: MAX_COLLAPSE_PAIRS + 1 })
    if (probe.length === 0) return null
    const truncated = probe.length > MAX_COLLAPSE_PAIRS
    const lightPairs = truncated
      ? await this.completeClusterClosure(probe.slice(0, MAX_COLLAPSE_PAIRS), versions)
      : probe

    // stage 2：全局 union-find（泛型轻列行）
    // stage 3 前置：组相似度 = min over pair identity_score（aggregateGroup D-105a-15 同口径）
    const entries = collapsePairs(lightPairs).map((cluster) => ({
      cluster,
      clusterKey: cluster.clusterKey,
      videoIds: cluster.videoIds,
      identityScore: Math.min(...cluster.pairs.map((p) => Number(p.identity_score))),
      videoCount: cluster.videoIds.length,
    }))

    // q / title·year 排序需要轻元数据（仅激活时拉取，≤ 2×cap 单次有界 join / 评审 Y-1）
    const needMeta = params.q !== undefined
      || params.sortField === 'titleNormalized' || params.sortField === 'year'
    const metaMap = needMeta
      ? new Map(
          (await fetchVideoMetaLight(this.db, [...new Set(entries.flatMap((e) => e.cluster.videoIds))]))
            .map((m) => [m.id, m]),
        )
      : undefined

    // stage 3：组级谓词（与 legacy 路径共用 groupMatchesFilters，双路径语义一致）
    const filtered = entries.filter((e) => groupMatchesFilters({
      identityScore: e.identityScore,
      videoCount: e.videoCount,
      ...(metaMap ? { titles: clusterTitles(e.cluster.videoIds, metaMap) } : {}),
    }, params))

    // stage 4：组级排序（缺省 identityScore DESC；tiebreaker clusterKey ASC 分页幂等）
    sortIdentityClusterEntries(filtered, params.sortField, params.sortDir, metaMap)

    // stage 5：组级分页切片 → 仅页分量回查完整行 + video 详情 → 重建 PairCluster<完整行>
    const total = filtered.length
    const offset = (page - 1) * limit
    const pageEntries = filtered.slice(offset, offset + limit)
    const base = { total, page, limit, source: 'identity' as const, ...(truncated ? { truncated } : {}) }
    if (pageEntries.length === 0) return { data: [], ...base }

    const fullRows = await listPendingPairsByIds(
      this.db,
      pageEntries.flatMap((e) => e.cluster.pairs.map((p) => p.id)),
    )
    const fullById = new Map(fullRows.map((r) => [r.id, r]))
    const details = await fetchVideoDetailsForCandidates(
      this.db,
      [...new Set(pageEntries.flatMap((e) => e.cluster.videoIds))],
    )
    const videoMap = new Map(details.map((v) => [v.id, mapVideoRow(v)]))
    const groups = pageEntries
      .map((e) => {
        // 评审 Y-4：light cluster 不直接喂 buildGroupFromCluster——按轻列序重组完整行
        // （分量内 pair 保序契约；并发 confirm/reject 脱落的 pair 防御性过滤）
        const pairs = e.cluster.pairs
          .map((p) => fullById.get(p.id))
          .filter((p): p is PendingCandidatePairRow => p !== undefined)
        if (pairs.length === 0) return null
        return buildGroupFromCluster(
          { videoIds: e.cluster.videoIds, clusterKey: e.cluster.clusterKey, pairs },
          videoMap,
        )
      })
      .filter((g): g is CandidateGroup => g !== null)
    return { data: groups, ...base }
  }

  /**
   * D-105a-19 截断态闭包补全（评审红线 R-1 方案 (b)）：identity_score DESC 硬截断与连通分量
   * （pair 传递闭包）正交——界内分量缺成员/缺 candidateId 锚点时 videoCount 筛选不可信、
   * confirm 漏 pair 复现。补全 = 对界内 pair 触及的 video 集合补查全部 pending pair，
   * 有界迭代至闭包（轮次 ≤ MAX_CLOSURE_ROUNDS / 累计 ≤ MAX_CLOSURE_PAIRS 守卫；守卫触顶的
   * 残余不完整仅存在于 truncated 极端态且已被警示条覆盖）。
   * 返回按 identity_score DESC, canonical_pair_key ASC 重排（分量内 pair 保序契约）。
   */
  private async completeClusterClosure(
    pairs: readonly PendingCandidatePairLightRow[],
    versions: { scorerVersion: string; parserVersion: string },
  ): Promise<PendingCandidatePairLightRow[]> {
    const collected = [...pairs]
    const seenPairs = new Set(collected.map((p) => p.id))
    const videoIds = new Set(collected.flatMap((p) => [p.left_video_id, p.right_video_id]))

    for (let round = 0; round < MAX_CLOSURE_ROUNDS && collected.length < MAX_CLOSURE_PAIRS; round++) {
      const fetched = await listPendingPairsLightByVideoIds(this.db, { ...versions, videoIds: [...videoIds] })
      const fresh = fetched.filter((p) => !seenPairs.has(p.id))
      if (fresh.length === 0) break
      let hasNewVideo = false
      for (const p of fresh) {
        seenPairs.add(p.id)
        collected.push(p)
        if (!videoIds.has(p.left_video_id)) { videoIds.add(p.left_video_id); hasNewVideo = true }
        if (!videoIds.has(p.right_video_id)) { videoIds.add(p.right_video_id); hasNewVideo = true }
      }
      if (!hasNewVideo) break // 闭包达成：无新成员则下一轮不会再有新 pair
    }

    return collected.sort((a, b) => {
      const cmp = Number(b.identity_score) - Number(a.identity_score)
      if (cmp !== 0) return cmp
      return a.canonical_pair_key.localeCompare(b.canonical_pair_key)
    })
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
   * （+ candidateIds 时同事务循环挂 K 个 decision(confirmed) 同一 audit_id / R8 单 BEGIN/COMMIT，
   * 任一 from-state 冲突 → 整 merge ROLLBACK / CHG-VIR-9-D D-105a-18）。
   */
  private async runMergeTransaction(params: {
    sourceVideoIds: string[]
    targetVideoId: string
    reason: string | undefined
    candidateIds: readonly string[]
    snapshotJsonb: Record<string, unknown>
    actorId: string
  }): Promise<{ auditId: string; decisionIds: string[]; dedupedSourceIds: string[] }> {
    const { sourceVideoIds, targetVideoId, reason, candidateIds, snapshotJsonb, actorId } = params
    const client = await this.db.connect()
    let auditId: string
    let dedupedSourceIds: string[] = []
    const decisionIds: string[] = []
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

      // D-105-13（CHG-MERGE-DEDUP-EP）：转移前确定性去重——重复 (episode_number, source_url)
      // 软删非保留行（target 恒胜 > sourceVideoIds 序首胜），合并 = 线路取并集不再 409
      dedupedSourceIds = await dedupeSourcesForMerge(client, sourceVideoIds, targetVideoId)
      if (dedupedSourceIds.length > 0) {
        // D-105-14：snapshot 补 dedupedSourceIds（unmerge「先归还后复活」还原依据）
        await setAuditDedupedSourceIds(client, auditId, dedupedSourceIds)
      }
      // Y-105-D3 防御性残余预检：幸存 source 行 vs target 全部行（含软删占槽位）——
      // 命中则转移必撞唯一键，明确 409 整体 ROLLBACK（零物理删除，人工处理路径）
      const residual = await detectResidualTargetConflicts(client, sourceVideoIds, targetVideoId)
      if (residual > 0) {
        throw new AppError(
          'STATE_CONFLICT',
          `target 视频存在 ${residual} 条历史软删线路与待转入线路冲突（唯一键占位），请联系管理员处理后重试`,
          409,
        )
      }

      await transferSourcesToTarget(client, sourceVideoIds, targetVideoId)
      await softDeleteVideos(client, sourceVideoIds)

      for (const candidateId of candidateIds) {
        decisionIds.push(await IdentityCandidatesService.attachConfirmedDecision(client, {
          candidateId,
          videoMergeAuditId: auditId,
          performedBy: actorId,
        }))
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
    return { auditId, decisionIds, dedupedSourceIds }
  }

  async merge(params: MergeParams, actorId: string): Promise<MergeResult> {
    const { sourceVideoIds, targetVideoId, reason } = params
    // CHG-VIR-9-D：candidateId（单数，deprecate 保留）与 candidateIds（折叠组）归一化为数组
    //（schema refine 已保证互斥）；空数组 = 不挂 decision（主路径零变更）。
    const candidateIds = params.candidateIds ?? (params.candidateId ? [params.candidateId] : [])
    const allIds = [...sourceVideoIds, targetVideoId]

    // 1. 校验所有 video 存在且未删除（404/409 / 抽 assertVideosMergeable）
    const videoMap = await this.assertVideosMergeable(sourceVideoIds, targetVideoId)

    // 2. （ADR-105 AMENDMENT 2026-06-05 D-105-13）原 R-105-1 预检 409 废止——重复
    // (episode_number, source_url) 改为事务内确定性去重取并集（见 runMergeTransaction）

    // 2b. CHG-VIR-9-B / ADR-178 D-178-3：candidate 事务前快速失败校验（BEGIN 之前，主路径零变更）
    // CHG-VIR-9-D：折叠组 K 个 candidate 逐个校验（存在404/pending409/pair⊆合并集合422）
    for (const candidateId of candidateIds) {
      await IdentityCandidatesService.validateForMerge(this.db, candidateId, allIds)
    }

    // 2c. D-105-9（CHG-VIR-13-D1）：targetStatus 矩阵校验（BEGIN 前，非法组合 422 快速失败）。
    // plan 三态：undefined = 未携带（零行为变更 R-105-T1）/ action null = no-op / action + before
    const statusPlan = planTargetStatus(videoMap.get(targetVideoId)!, params.targetStatus)

    // 3. 构建 snapshot（source videos 完整数据 + 它们的 sources）
    // D-105-11：将实际 apply（action 非 no-op）时补 targetStatusBefore（unmerge 还原依据；
    // post-COMMIT failed 时 target 仍 = before，还原退化 skipped 自洽）
    const sourcesOfSources = await fetchSourcesByVideoIds(this.db, sourceVideoIds)
    const snapshotJsonb: Record<string, unknown> = {
      videos: sourceVideoIds.map(id => videoMap.get(id)),
      sources: sourcesOfSources.map(s => ({ id: s.id, video_id: s.video_id })),
      ...(statusPlan?.targetStatusBefore !== undefined
        ? { targetStatusBefore: statusPlan.targetStatusBefore }
        : {}),
    }

    // 4. 事务（抽 runMergeTransaction / R8 单 BEGIN/COMMIT；D-105-13 事务内去重）
    const { auditId, decisionIds, dedupedSourceIds } = await this.runMergeTransaction({
      sourceVideoIds, targetVideoId, reason, candidateIds, snapshotJsonb, actorId,
    })

    // 4b. D-105-10（CHG-VIR-13-D1）：post-COMMIT 状态写入（唯一通道 transitionVideoState；
    // 失败不回滚 merge，statusTransition 可观测 R-105-T3）
    let statusTransition: StatusTransitionOutcome | undefined
    if (statusPlan !== undefined) {
      statusTransition = statusPlan.action === null
        ? 'skipped'
        : await applyStatusTransition(this.db, targetVideoId, statusPlan.action, actorId, reason)
    }

    // 5. 拼装合并后 target 摘要（ADR-105 §端点契约 row 2：targetVideo: VideoSummary）
    // CHG-SN-5-10-PATCH P0-1：COMMIT 后查 target 详情反映合并后 sourceCount/sourceSiteKeys 新状态
    //（4b 之后查询 → reviewStatus/visibilityStatus 透出反映状态设置后形态）
    const [targetDetail] = await fetchVideoDetailsForCandidates(this.db, [targetVideoId])
    if (!targetDetail) {
      // 理论不可达：COMMIT 已完成 + targetVideo 未被删除（前置校验通过）
      throw new AppError('NOT_FOUND', `target video ${targetVideoId} 在合并后不可用`, 404)
    }
    const targetVideo = mapVideoRow(targetDetail)

    // 6. fire-and-forget admin_audit_log（COMMIT 后才写，防虚假记录）
    // CHG-VIR-9-B / ADR-178 D-178-6：candidate 路径 afterJsonb 纯增量补 candidateIds/decisionIds
    //（CHG-VIR-9-D：单数 candidateId/decisionId 字段升级为数组，audit jsonb 非契约字段）
    // D-105-12（CHG-VIR-13-D1）：携带 targetStatus 时纯增量补请求值 + statusTransition 结果
    this.auditSvc.write({
      actorId,
      actionType: 'video.merge',
      targetKind: 'video',
      targetId: targetVideoId,
      beforeJsonb: { sourceVideoIds, snapshot: snapshotJsonb },
      afterJsonb: {
        auditId,
        targetVideoId,
        ...(candidateIds.length > 0 ? { candidateIds, decisionIds } : {}),
        ...(params.targetStatus !== undefined
          ? { targetStatus: params.targetStatus, statusTransition }
          : {}),
        // D-105-16（CHG-MERGE-DEDUP-EP）：去重结果纯增量补记
        ...(dedupedSourceIds.length > 0 ? { dedupedSourceIds } : {}),
      },
    })

    // NTLG-P1-c-B-2：解耦双写 emit（COMMIT 后——与 audit.write 同范式防虚假记录；fire-and-forget）
    this.notificationEmitter.emit(
      buildAuditNotificationEmit({ actionType: 'video.merge', targetId: targetVideoId }),
    )

    return {
      auditId,
      targetVideo,
      ...(statusTransition !== undefined ? { statusTransition } : {}),
      // D-105-16：实际去重条数（>0 时透出；R-105-D4 纯增量）
      ...(dedupedSourceIds.length > 0 ? { dedupedCount: dedupedSourceIds.length } : {}),
    }
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

    // D-105-11（CHG-VIR-13-D1）：merge audit snapshot 含 targetStatusBefore → COMMIT 后还原；
    // 存量 audit 无该字段 → 不动（旧行为逐值一致，响应不出现 statusTransition）
    const targetStatusBefore = audit.action === 'merge'
      ? (audit.snapshot_jsonb as { targetStatusBefore?: TargetStatusBefore }).targetStatusBefore
      : undefined

    // D-105-14（CHG-MERGE-DEDUP-EP）：被去重软删的源 ids（merge/split 双场景；
    // 存量 audit 无该字段 → 空数组零行为变更 R-105-D3）
    const dedupedRaw = (audit.snapshot_jsonb as { dedupedSourceIds?: string[] }).dedupedSourceIds
    const dedupedSourceIds = Array.isArray(dedupedRaw) ? dedupedRaw : []

    let restoredVideoIds: string[]

    if (audit.action === 'merge') {
      // 撤销合并：还原 source videos + 归还 sources
      restoredVideoIds = audit.source_video_ids

      const client = await this.db.connect()
      try {
        await client.query('BEGIN')
        await restoreVideos(client, restoredVideoIds)
        await reassignSourcesToOriginal(client, snapshotSources)
        // D-105-14：先归还后复活（顺序避免瞬时撞 target 槽位 / 评审确认）
        await restoreSourcesByIds(client, dedupedSourceIds)
        await markAuditReverted(client, auditId, actorId, reason ?? null)
        // CHG-VIR-9-B / ADR-178 D-178-4：经 audit_id 反查关联 confirmed decision 原地置 reverted
        // （decision 值不变 / candidate 保持 confirmed 不回 pending，避撞 uq_identity_candidate_pending）
        // CHG-VIR-9-D / D-105a-18：折叠组一个 audit 挂 K 个 decision → 循环全部 revert（R8 对称）
        const decisions = await findConfirmedDecisionsByAuditId(client, auditId)
        for (const decision of decisions) {
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
      // 撤销拆分：还原原始 video + 归还 sources + 软删除拆分后**新建**的 videos。
      // ADR-105 AMENDMENT 2026-06-03 D-105-4 / R-105-S4（CHG-VIR-11-B）：拆到已有 video 的
      // target 不得软删（拆分前已存在）——软删严格按 snapshot.created_target_video_ids 驱动；
      // 存量 audit 无该字段 → 兜底全视为新建（与旧行为逐值一致）。已有 target 本次转入的
      // sources 经 reassignSourcesToOriginal 按拆分前归属归还原 video（既有逻辑天然覆盖）。
      restoredVideoIds = audit.source_video_ids
      const createdRaw = (audit.snapshot_jsonb as { created_target_video_ids?: string[] })
        .created_target_video_ids
      const createdVideoIds = Array.isArray(createdRaw) ? createdRaw : audit.target_video_ids

      const client = await this.db.connect()
      try {
        await client.query('BEGIN')
        await restoreVideos(client, restoredVideoIds)
        await reassignSourcesToOriginal(client, snapshotSources)
        // D-105-14/15：split 拆到已有 video 的转入去重行同恢复（先归还后复活）
        await restoreSourcesByIds(client, dedupedSourceIds)
        await softDeleteVideos(client, createdVideoIds)
        await markAuditReverted(client, auditId, actorId, reason ?? null)
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }

    // D-105-11（CHG-VIR-13-D1）：post-COMMIT 还原 target 状态（同 D-105-10 非原子边界，
    // 失败不回滚 unmerge；还原同走 (current, before) 矩阵，无单步回路时如实 failed 人工兜底）
    let statusTransition: StatusTransitionOutcome | undefined
    if (targetStatusBefore !== undefined) {
      const mergeTargetId = audit.target_video_ids[0]
      statusTransition = mergeTargetId !== undefined
        ? await restoreTargetStatusBefore(this.db, mergeTargetId, targetStatusBefore, actorId, reason)
        : 'failed'
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
      afterJsonb: {
        restoredVideoIds,
        ...(statusTransition !== undefined ? { statusTransition } : {}),
      },
    })

    return {
      restoredVideoIds,
      ...(statusTransition !== undefined ? { statusTransition } : {}),
    }
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

    // ADR-105 AMENDMENT 2026-06-03 D-105-2/3/5（CHG-VIR-11-B）：组解析与校验全部 BEGIN 前——
    // targetVideoId 组（拆到已有 video）校验 ≠videoId/存在/未软删 + 冲突预检（同 R-105-1 范式）；
    // newVideoMeta 组沿 CHG-VIR-PRE-1 事务前 findOrCreate catalog（回滚至多留无害孤儿 catalog）。
    const resolvedGroups = await resolveSplitGroups(this.db, this.catalogSvc, videoId, groups)

    // 3b. D-105-9（CHG-VIR-13-D1）：per-group status 矩阵校验（BEGIN 前，非法组合 422 整体不执行）。
    // current 恒 SPLIT_INITIAL_STATE（insertNewVideo DB DEFAULT pending_review|internal / migration 016）；
    // targetVideoId 组结构上无 newVideoMeta 不可携带（R-105-T5）。
    // undefined = 该组未携带 status（响应不产条目）；null = current==desired no-op skipped
    const groupStatusActions = groups.map((g) =>
      g.newVideoMeta?.status !== undefined
        ? resolveStatusAction(SPLIT_INITIAL_STATE, g.newVideoMeta.status)
        : undefined,
    )

    // 4. 事务：INSERT audit + 创建新 videos / 转入已有 videos + 分配 sources + 软删除原 video
    const client = await this.db.connect()
    let auditId: string
    // D-105-4：created（新建，unmerge 时软删）与全部 target（audit.target_video_ids）分别记录
    const newVideoIds: string[] = []
    const allTargetVideoIds: string[] = []
    // D-105-10：组下标 → 新建 videoId（post-COMMIT 状态写入定位；existing 组恒 undefined）
    const createdVideoIdByGroup: (string | undefined)[] = new Array(resolvedGroups.length)
    // D-105-15（CHG-MERGE-DEDUP-EP）：拆到已有 video 转入行的去重软删 ids（unmerge 还原依据）
    const dedupedSourceIds: string[] = []

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

      for (let i = 0; i < resolvedGroups.length; i++) {
        const group = resolvedGroups[i]!
        if (group.kind === 'existing') {
          // D-105-15（CHG-MERGE-DEDUP-EP）：转入前去重——与已有 target 重复 (ep,url) 的
          // 转入行软删（target 恒胜 / D-105-5 不动已有 target；Y-105-D4 时序 = assign 之前）
          dedupedSourceIds.push(
            ...(await dedupeSourcesForSplitTarget(client, [...group.sourceIds], group.targetVideoId)),
          )
          // Y-105-D3 防御性残余预检（幸存转入行 vs target 含软删占槽位）
          const residual = await detectResidualSplitTargetConflicts(
            client, [...group.sourceIds], group.targetVideoId,
          )
          if (residual > 0) {
            throw new AppError(
              'STATE_CONFLICT',
              `拆分目标视频存在 ${residual} 条历史软删线路与转入线路冲突（唯一键占位），请联系管理员处理后重试`,
              409,
            )
          }
          // D-105-5 / R-105-S3：仅转入 sources，不改已有 video 任何元数据
          await assignSourcesToVideo(client, [...group.sourceIds], group.targetVideoId)
          allTargetVideoIds.push(group.targetVideoId)
          continue
        }
        const shortId = Math.random().toString(36).slice(2, 10)
        const newVideoId = await insertNewVideo(client, {
          shortId,
          catalogId: group.catalogId,
          title: group.title,
          type: group.type,
        })
        newVideoIds.push(newVideoId)
        allTargetVideoIds.push(newVideoId)
        createdVideoIdByGroup[i] = newVideoId
        await assignSourcesToVideo(client, [...group.sourceIds], newVideoId)
      }

      // 回填 target_video_ids + snapshot.created_target_video_ids（D-105-4 / 零 DDL 自由字段）
      await updateAuditTargetIds(client, auditId, allTargetVideoIds, newVideoIds)
      // D-105-15：snapshot 补 dedupedSourceIds（unmerge「先归还后复活」还原依据）
      if (dedupedSourceIds.length > 0) {
        await setAuditDedupedSourceIds(client, auditId, dedupedSourceIds)
      }

      await softDeleteVideos(client, [videoId])

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    // 4b. D-105-10（CHG-VIR-13-D1）：post-COMMIT 逐一应用新建 video 状态（失败不回滚 split；
    // 数组仅含携带 status 的新建组，未携带组无 transition 意图不产条目）
    const statusTransition = await applyGroupStatusTransitions(
      this.db, groupStatusActions, createdVideoIdByGroup, actorId,
    )

    // fire-and-forget admin_audit_log（D-105-6：afterJsonb 扩 existingTargetVideoIds；
    // D-105-12：携带 status 时纯增量补请求值 + statusTransition 结果）
    const existingTargetVideoIds = allTargetVideoIds.filter((id) => !newVideoIds.includes(id))
    this.auditSvc.write({
      actorId,
      actionType: 'video.split',
      targetKind: 'video',
      targetId: videoId,
      beforeJsonb: { originalVideoId: videoId, snapshot: snapshotJsonb },
      afterJsonb: {
        auditId,
        newVideoIds,
        existingTargetVideoIds,
        ...(statusTransition !== undefined
          ? {
              requestedStatuses: groups.flatMap((g, i) =>
                g.newVideoMeta?.status !== undefined
                  ? [{ groupIndex: i, status: g.newVideoMeta.status }]
                  : []),
              statusTransition,
            }
          : {}),
        // D-105-16（CHG-MERGE-DEDUP-EP）：去重结果纯增量补记
        ...(dedupedSourceIds.length > 0 ? { dedupedSourceIds } : {}),
      },
    })

    return {
      auditId,
      newVideoIds,
      ...(statusTransition !== undefined ? { statusTransition } : {}),
      // D-105-16：实际去重条数（>0 时透出；R-105-D4 纯增量）
      ...(dedupedSourceIds.length > 0 ? { dedupedCount: dedupedSourceIds.length } : {}),
    }
  }

  // ── audit timeline (CHG-SN-6-AUDIT-TIMELINE / RETRO 4/7) ──────────

  /**
   * D-105-8（CHG-VIR-13-C2）：+4 optional 派生（actorType / relatedCandidateIds /
   * relatedDecisionIds / videoTitlesSnapshot）。分页/排序/计数逐值不变（R-105-T4：
   * 派生在页内 rows 上做，单 SQL 批量反查零 N+1）。
   */
  async listAudit(params: ListAuditParams): Promise<ListAuditResult> {
    const { action = null, videoId = null, limit, page } = params
    const offset = (page - 1) * limit
    const [rows, total] = await Promise.all([
      listAuditTimeline(this.db, { action, videoId, offset, limit }),
      countAuditTimeline(this.db, { action, videoId }),
    ])

    // 页内批量派生（D-105-8）：decision 反查（Y-105-T3 partial 索引）+ target 标题实时查
    const auditIds = rows.map((r) => r.id)
    const targetIds = [...new Set(rows.flatMap((r) => r.target_video_ids))]
    const [decisions, targetTitles] = await Promise.all([
      findDecisionsByAuditIds(this.db, auditIds),
      fetchVideoTitles(this.db, targetIds),
    ])
    const decisionsByAudit = new Map<string, typeof decisions>()
    for (const d of decisions) {
      const list = decisionsByAudit.get(d.video_merge_audit_id) ?? []
      list.push(d)
      decisionsByAudit.set(d.video_merge_audit_id, list)
    }
    const targetTitleById = new Map(targetTitles.map((t) => [t.id, t.title]))

    const data: MergeAuditRow[] = rows.map((r) => {
      const related = decisionsByAudit.get(r.id) ?? []
      // source 标题：snapshot 投影（软删唯一可靠源，缺失兜底）；target：实时查（未删）
      const snapshotTitleById = new Map(
        (r.snapshot_video_titles ?? [])
          .filter((v): v is { videoId: string; title: string | null } => typeof v?.videoId === 'string')
          .map((v) => [v.videoId, v.title]),
      )
      const videoTitlesSnapshot = [
        ...r.source_video_ids.map((id) => ({
          videoId: id,
          title: snapshotTitleById.get(id) ?? '(已删除视频)',
        })),
        ...r.target_video_ids.map((id) => ({
          videoId: id,
          title: targetTitleById.get(id) ?? snapshotTitleById.get(id) ?? '(已删除视频)',
        })),
      ].map((v) => ({ videoId: v.videoId, title: v.title ?? '(已删除视频)' }))

      return {
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
        // D-105-8：无关联 decision → 'human'（人工 merge 页直接操作无 candidate 锚点场景）；
        // 多 decision 同事务挂载恒同 actor，取任一
        actorType: related[0]?.actor_type ?? 'human',
        relatedCandidateIds: related.map((d) => d.candidate_id),
        relatedDecisionIds: related.map((d) => d.id),
        videoTitlesSnapshot,
      }
    })
    return { data, total, page, limit }
  }
}
