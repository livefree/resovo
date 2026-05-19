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
} from '@/api/db/queries/sources-matrix'
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

export const VideoGroupsQuerySchema = z.object({
  page:          z.coerce.number().int().min(1).optional().default(1),
  limit:         z.coerce.number().int().min(1).max(100).optional().default(20),
  keyword:       z.string().optional(),
  segment:       z.enum(['grouped', 'dead', 'correction', 'orphan']).optional().default('grouped'),
  siteKey:       z.string().optional(),
  probeStatus:   z.string().optional(),
  renderStatus:  z.string().optional(),
})

export const UpsertAliasSchema = z.object({
  displayName: z.string().min(1, '别名不能为空').max(100, '别名过长'),
})

// ADR-117 AMENDMENT 2026-05-19：path 校验同 UpsertAliasParamsSchema siteKey 字段
export const RoutesBySiteParamsSchema = z.object({
  siteKey: z.string().min(1).max(100),
}).strict()

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
