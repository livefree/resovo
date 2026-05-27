/**
 * SourcesMatrixService.ts — 播放线路矩阵业务层（ADR-117 / CHG-SN-5-11-PATCH）
 *
 * 职责：
 *   - listVideoGroups(): 视频分组列表（含聚合信号 + 分页）
 *   - getVideoGroupStats(): KPI 4 指标（segment 语义统一，ADR-117 §7）
 *   - getVideoMatrix(): 单视频线路×集数矩阵
 *   - listLineAliases(): 全局别名列表
 *   - upsertLineAlias(): 新建/更新别名 + fire-and-forget audit（ADR-117 §5）
 */

import { z } from 'zod'
import type { Pool } from 'pg'
import {
  listVideoGroups as listVideoGroupsRaw,
  getVideoGroupStats,
  getVideoMatrix,
  listLineAliases,
  upsertLineAlias,
  findLineAlias,
  listRoutesBySite as listRoutesBySiteRaw,
  selectRouteSampleSource,
  countRouteSources,
  softDeleteRouteBySite,
} from '@/api/db/queries/sources-matrix'
import { findVideoSourceById } from '@/api/db/queries/video_sources'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import type {
  DualSignalState,
  VideoGroupListParams,
  VideoGroupListResult,
  VideoGroupRow,
  VideoGroupStats,
  LineMatrixRow,
  SourceLineAlias,
  SourceRouteBySite,
} from '@resovo/types'
import { fetchVideosByIds } from '@/api/db/queries/video-merge-mutations'
import { AuditLogService } from '@/api/services/AuditLogService'
import { AppError } from '@/api/lib/errors'

// ── Zod schema（ADR-117 §端点契约）──────────────────────────────────

// HOTFIX-PATCH-2A §2-EXT-1/2（2026-05-25）：probe/render status 4 态枚举 + csvToArray 范式（参 crawler.runs.ts）
const PROBE_STATUS_VALUES = ['pending', 'ok', 'partial', 'dead'] as const
const RENDER_STATUS_VALUES = ['pending', 'ok', 'partial', 'dead'] as const
const csvToStringArray = <T extends string>(values: readonly T[]) =>
  z.string().optional().transform((s, ctx) => {
    if (!s) return undefined
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length === 0) return undefined
    for (const p of parts) {
      if (!values.includes(p as T)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `invalid value: ${p}` })
        return z.NEVER
      }
    }
    return parts as T[]
  })
// HOTFIX-PATCH-2B（2026-05-25）：siteKey 动态值 csv → array（无 enum 约束 / 字符长度 1-64 安全约束）
const csvToFreeStringArray = (maxLen = 64) =>
  z.string().optional().transform((s, ctx) => {
    if (!s) return undefined
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length === 0) return undefined
    for (const p of parts) {
      if (p.length > maxLen) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `value too long: ${p}` })
        return z.NEVER
      }
    }
    return parts
  })
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const VideoGroupsQuerySchema = z.object({
  page:          z.coerce.number().int().min(1).optional().default(1),
  limit:         z.coerce.number().int().min(1).max(100).optional().default(20),
  keyword:       z.string().optional(),
  segment:       z.enum(['grouped', 'dead', 'correction', 'orphan']).optional().default('grouped'),
  // HOTFIX-PATCH-2B（2026-05-25）：siteKey 单值 → 数组（distinct 端点首次消费实证 / EXISTS ANY()）
  siteKey:       csvToFreeStringArray(64),
  // HOTFIX-PATCH-2A §2-EXT-1/2：CSV → enum 数组（参 crawler.runs.ts csvToArray）/ raw EXISTS ANY()
  probeStatus:   csvToStringArray(PROBE_STATUS_VALUES),
  renderStatus:  csvToStringArray(RENDER_STATUS_VALUES),
  // HOTFIX-PATCH-2A §1-BUG-3：updatedAt 日期范围（YYYY-MM-DD）/ HAVING MAX(vs.updated_at) >= / <=
  updatedAtFrom: z.string().regex(ISO_DATE_RE, 'updatedAtFrom 必须是 YYYY-MM-DD 格式').optional(),
  updatedAtTo:   z.string().regex(ISO_DATE_RE, 'updatedAtTo 必须是 YYYY-MM-DD 格式').optional(),
  // ADR-150 阶段 5 EP-4（2026-05-24）：sort 全栈打通 / 4 字段白名单 zod enum
  sortField:     z.enum(['video', 'lineCount', 'sourceCount', 'updated_at']).optional(),
  sortDir:       z.enum(['asc', 'desc']).optional(),
})

export const UpsertAliasSchema = z.object({
  displayName: z.string().min(1, '别名不能为空').max(100, '别名过长'),
})

// ADR-117 AMENDMENT 2026-05-19：path 校验同 UpsertAliasParamsSchema siteKey 字段
export const RoutesBySiteParamsSchema = z.object({
  siteKey: z.string().min(1).max(100),
}).strict()

// ADR-117 AMENDMENT 2 2026-05-19 / CHG-SN-7-REDO-01-E2：row 7/8/9 path 共享 schema
export const RouteActionParamsSchema = z.object({
  siteKey: z.string().min(1).max(100),
  sourceName: z.string().min(1).max(200),
}).strict()

// ADR-158 / CHG-351-A：单源 inline probe + render-check path 共享 schema（R2 / .uuid() 422 前置 vs 500 fallthrough）
export const SingleSourceParamsSchema = z.object({
  id: z.string().uuid(),
}).strict()

export interface RouteTestResult {
  readonly ok: boolean
  readonly latencyMs: number | null
  readonly sampleVideoId: string | null
  readonly probeJobId: string
}
export interface RouteReprobeResult {
  readonly probeJobId: string
  readonly queuedCount: number
}
export interface RouteDeleteResult {
  readonly deletedCount: number
  readonly deletedIds: readonly string[]
}

// ADR-158 / CHG-351-A：单源 inline 操作结果（与 RouteReprobeResult 形态对称 / queued 字面 true 标识异步入队语义）
export interface SingleSourceProbeResult {
  readonly probeJobId: string
  readonly queued: true
  readonly sourceId: string
}
export interface SingleSourceRenderCheckResult {
  readonly renderJobId: string
  readonly queued: true
  readonly sourceId: string
}

export type { VideoGroupListParams, VideoGroupListResult, VideoGroupStats, LineMatrixRow, SourceLineAlias, SourceRouteBySite }

// ── 聚合信号状态推导（ADR-117 §决策要点 2 / CHG-SN-5-11-PATCH-2 P0-2 业务逻辑归口 Service）─

/**
 * 派生行级聚合信号：
 * - 空 → 'pending'
 * - 全 ok → 'ok'
 * - 全 dead → 'dead'
 * - 含 ok/partial → 'partial'
 * - 其他 → 'pending'
 */
export function aggregateSignal(statuses: readonly string[]): DualSignalState {
  if (statuses.length === 0) return 'pending'
  if (statuses.every((s) => s === 'ok')) return 'ok'
  if (statuses.every((s) => s === 'dead')) return 'dead'
  if (statuses.some((s) => s === 'ok' || s === 'partial')) return 'partial'
  return 'pending'
}

// ── Service ─────────────────────────────────────────────────────────

export class SourcesMatrixService {
  private auditSvc: AuditLogService

  constructor(private db: Pool) {
    this.auditSvc = new AuditLogService(db)
  }

  /**
   * 列出视频分组：DB 查询返回 raw 状态数组，Service 派生 probeStatus / renderStatus
   * 聚合状态（ADR-117 §决策要点 2 业务规则归口 Service）。
   */
  async listVideoGroups(params: VideoGroupListParams): Promise<VideoGroupListResult> {
    const raw = await listVideoGroupsRaw(this.db, params)
    const data: VideoGroupRow[] = raw.data.map((r) => ({
      videoId: r.videoId,
      title: r.title,
      shortId: r.shortId,
      type: r.type,
      year: r.year,
      coverUrl: r.coverUrl,
      lineCount: r.lineCount,
      sourceCount: r.sourceCount,
      probeStatus: aggregateSignal(r.probeStatuses),
      renderStatus: aggregateSignal(r.renderStatuses),
      updatedAt: r.updatedAt,
      // HOTFIX-PATCH-2B-FIX1（2026-05-25）：siteKeys 透传（DB 层 STRING_AGG DISTINCT 派生 / 升序）
      siteKeys: r.siteKeys,
    }))
    return { data, total: raw.total, page: raw.page, limit: raw.limit }
  }

  getVideoGroupStats(): Promise<VideoGroupStats> {
    return getVideoGroupStats(this.db)
  }

  /**
   * 获取单视频线路×集数矩阵；video 不存在或已软删除时抛 NOT_FOUND 404
   * （ADR-117 §错误码 + D-117-9 修订）
   */
  async getVideoMatrix(videoId: string): Promise<LineMatrixRow[]> {
    const videos = await fetchVideosByIds(this.db, [videoId])
    const video = videos[0]
    if (!video || video.deleted_at !== null) {
      throw new AppError('NOT_FOUND', `video ${videoId} 不存在`, 404)
    }
    return getVideoMatrix(this.db, videoId)
  }

  listLineAliases(): Promise<SourceLineAlias[]> {
    return listLineAliases(this.db)
  }

  /**
   * 按 siteKey 聚合线路明细（ADR-117 AMENDMENT 2026-05-19）。
   * DB 仅返回 raw 状态数组；Service 派生 probeStatus/renderStatus via aggregateSignal
   * （与 listVideoGroups 100% 对称 / 零新业务逻辑）。
   */
  async listRoutesBySite(siteKey: string): Promise<SourceRouteBySite[]> {
    const raw = await listRoutesBySiteRaw(this.db, siteKey)
    return raw.map((r): SourceRouteBySite => ({
      sourceSiteKey: r.sourceSiteKey,
      sourceName: r.sourceName,
      displayName: r.displayName,
      probeStatus: aggregateSignal(r.probeStatuses),
      renderStatus: aggregateSignal(r.renderStatuses),
      avgLatencyMs: r.avgLatencyMs,
      sourceCount: r.sourceCount,
      activeCount: r.activeCount,
      lastProbedAt: r.lastProbedAt,
    }))
  }

  // ── ADR-117 AMENDMENT 2 2026-05-19 / CHG-SN-7-REDO-01-E2 ──────────
  // 行级 3 mutations：test / reprobe / delete（合并 actionType sources.route_action）

  /**
   * Opus Y2：freeze 守卫仅适用 reprobe + delete；test 端点不守卫（只读探测）。
   * 抛 SERVICE_UNAVAILABLE 503 由 Route 层 isAppError 映射。
   */
  private async assertNotFrozen(): Promise<void> {
    const freeze = await systemSettingsQueries.getSetting(this.db, 'crawler_global_freeze')
    if (freeze === 'true') {
      // 复用 ADR-110 既有码 STATE_CONFLICT 409（与 videos / staging / video-merges
      // 同模式 / Opus ADR-117 AMENDMENT 2 §错误码"100% 复用 ADR-110 14 码"约束）
      throw new AppError('STATE_CONFLICT', '采集已冻结，不可执行线路操作', 409)
    }
  }

  /**
   * row 7 同步快探 episode 1 + 异步全量 probe job（U4 决策）
   * - 404 若 (siteKey, sourceName) 无任何 deleted_at IS NULL 行
   * - HEAD 3s 超时（Y3 上限）；timeout 不视为 5xx，返回 ok=false
   */
  async testRoute(
    siteKey: string,
    sourceName: string,
    actorId: string,
    requestId?: string,
  ): Promise<RouteTestResult> {
    const sample = await selectRouteSampleSource(this.db, siteKey, sourceName)
    if (!sample) {
      throw new AppError('NOT_FOUND', `线路 ${siteKey}/${sourceName} 不存在`, 404)
    }

    const start = performance.now()
    let ok = false
    try {
      const res = await fetch(sample.sourceUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      })
      ok = res.ok && res.status < 400
    } catch {
      // 超时 / 网络错误 → ok=false，不抛 5xx（Y3 / Opus U4）
      ok = false
    }
    const latencyMs = ok ? Math.round(performance.now() - start) : null

    // 异步全量 probe job：本卡复用占位 jobId（Y3 advisory 未来对接 source-health worker）
    const probeJobId = `probe-${siteKey}-${sourceName}-${Date.now()}`

    const result: RouteTestResult = {
      ok,
      latencyMs,
      sampleVideoId: sample.videoId,
      probeJobId,
    }

    this.auditSvc.write({
      actorId,
      actionType: 'sources.route_action',
      targetKind: 'source_route',
      targetId: `${siteKey}/${sourceName}`,
      beforeJsonb: null,
      afterJsonb: { action: 'test', ok, latencyMs, sampleVideoId: sample.videoId, probeJobId },
      requestId: requestId ?? null,
    })

    return result
  }

  /**
   * row 8 重新探测：enqueue 全线路 probe job（不修改 video_sources）
   * - Y2：freeze 守卫拦截
   */
  async reprobeRoute(
    siteKey: string,
    sourceName: string,
    actorId: string,
    requestId?: string,
  ): Promise<RouteReprobeResult> {
    await this.assertNotFrozen()

    const queuedCount = await countRouteSources(this.db, siteKey, sourceName)
    if (queuedCount === 0) {
      throw new AppError('NOT_FOUND', `线路 ${siteKey}/${sourceName} 不存在`, 404)
    }

    // 占位 probe jobId（与 testRoute 同模式，复用 source-health worker 待 E2 后续完善）
    const probeJobId = `reprobe-${siteKey}-${sourceName}-${Date.now()}`

    this.auditSvc.write({
      actorId,
      actionType: 'sources.route_action',
      targetKind: 'source_route',
      targetId: `${siteKey}/${sourceName}`,
      beforeJsonb: null,
      afterJsonb: { action: 'reprobe', probeJobId, queuedCount },
      requestId: requestId ?? null,
    })

    return { probeJobId, queuedCount }
  }

  /**
   * row 9 软删除：UPDATE deleted_at=NOW() 所有 (siteKey, sourceName) 未删除 video_sources
   * - U2 软删除 / R2 红线
   * - Y2 freeze 守卫拦截
   */
  async deleteRoute(
    siteKey: string,
    sourceName: string,
    actorId: string,
    requestId?: string,
  ): Promise<RouteDeleteResult> {
    await this.assertNotFrozen()

    const beforeCount = await countRouteSources(this.db, siteKey, sourceName)
    if (beforeCount === 0) {
      throw new AppError('NOT_FOUND', `线路 ${siteKey}/${sourceName} 不存在`, 404)
    }

    const deletedIds = await softDeleteRouteBySite(this.db, siteKey, sourceName)
    const deletedCount = deletedIds.length

    this.auditSvc.write({
      actorId,
      actionType: 'sources.route_action',
      targetKind: 'source_route',
      targetId: `${siteKey}/${sourceName}`,
      // ≤50 条限制 audit payload 体积；超出标记 truncated
      beforeJsonb: {
        deletedIds: deletedIds.slice(0, 50),
        totalCount: beforeCount,
        truncated: deletedIds.length > 50,
      },
      afterJsonb: { action: 'delete', deletedCount },
      requestId: requestId ?? null,
    })

    return { deletedCount, deletedIds }
  }

  // ── ADR-158 / CHG-351-A 单源 inline 操作 ──────────────────────────
  //
  // 与 row 7-9 line-level mutations 互补：
  //   - 操作粒度：单 video_sources.id（vs siteKey+sourceName 复合键）
  //   - 触发场景：审核台 LinesPanel inline 按钮（vs 后台 sources 管理批量运维）
  //   - actionType: `video_source.inline_action`（与 video_source.toggle 单源域前缀对齐）
  //   - targetKind 复用 `video_source`（零扩展 / TARGET_KINDS 已存在）
  //   - freeze 守卫：probe ✅ 守 / render-check ❌ 不守（D-158-5 / Y1 diagnostic 可用性优先）
  //   - 占位 jobId 命名空间 `probe-vs-` / `render-vs-`（D-158-6 / Y3 防与 row 7-9 前缀冲突）
  //   - error path（404 / 409 / 422）不写 audit（D-158-7 / Y2 + ADR-121 D-121-4）

  /**
   * 单源 probe：入队 source-health worker 重探指定 video_sources.id（占位 jobId / advisory A2）
   * - 404 sourceId 不存在或已软删除
   * - 409 freeze=true（守 freeze / 与采集资源同源）
   */
  async probeOne(
    sourceId: string,
    actorId: string,
    requestId?: string,
  ): Promise<SingleSourceProbeResult> {
    await this.assertNotFrozen()

    const source = await findVideoSourceById(this.db, sourceId)
    if (!source) {
      throw new AppError('NOT_FOUND', `source ${sourceId} 不存在`, 404)
    }

    const probeJobId = `probe-vs-${sourceId}-${Date.now()}`

    this.auditSvc.write({
      actorId,
      actionType: 'video_source.inline_action',
      targetKind: 'video_source',
      targetId: sourceId,
      beforeJsonb: null,
      afterJsonb: { action: 'probe', probeJobId, sourceId },
      requestId: requestId ?? null,
    })

    return { probeJobId, queued: true as const, sourceId }
  }

  /**
   * 单源 render-check：入队 player-render-check worker 检测指定 video_sources.id 渲染（占位 jobId / advisory A2+A4）
   * - 404 sourceId 不存在或已软删除
   * - 不守 freeze（D-158-5 / Y1 diagnostic 可用性 / render-check 不消采集资源）
   */
  async renderCheckOne(
    sourceId: string,
    actorId: string,
    requestId?: string,
  ): Promise<SingleSourceRenderCheckResult> {
    const source = await findVideoSourceById(this.db, sourceId)
    if (!source) {
      throw new AppError('NOT_FOUND', `source ${sourceId} 不存在`, 404)
    }

    const renderJobId = `render-vs-${sourceId}-${Date.now()}`

    this.auditSvc.write({
      actorId,
      actionType: 'video_source.inline_action',
      targetKind: 'video_source',
      targetId: sourceId,
      beforeJsonb: null,
      afterJsonb: { action: 'render_check', renderJobId, sourceId },
      requestId: requestId ?? null,
    })

    return { renderJobId, queued: true as const, sourceId }
  }

  async upsertLineAlias(
    sourceSiteKey: string,
    sourceName: string,
    displayName: string,
    actorId: string,
    requestId?: string,
  ): Promise<SourceLineAlias> {
    const before = await findLineAlias(this.db, sourceSiteKey, sourceName)
    const alias = await upsertLineAlias(this.db, sourceSiteKey, sourceName, displayName, actorId)

    this.auditSvc.write({
      actorId,
      actionType: 'source_line_alias.upsert',
      targetKind: 'source_line_alias',
      targetId: `${sourceSiteKey}/${sourceName}`,
      beforeJsonb: before as unknown as Record<string, unknown> | null,
      afterJsonb: alias as unknown as Record<string, unknown>,
      requestId: requestId ?? null,
    })

    return alias
  }
}
