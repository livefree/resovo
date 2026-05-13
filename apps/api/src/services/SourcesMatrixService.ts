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
  listVideoGroups,
  getVideoGroupStats,
  getVideoMatrix,
  listLineAliases,
  upsertLineAlias,
  findLineAlias,
  type VideoGroupListParams,
  type VideoGroupListResult,
  type VideoGroupStats,
  type LineMatrixRow,
  type SourceLineAlias,
} from '@/api/db/queries/sources-matrix'
import { AuditLogService } from '@/api/services/AuditLogService'

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

export type { VideoGroupListParams, VideoGroupListResult, VideoGroupStats, LineMatrixRow, SourceLineAlias }

// ── Service ─────────────────────────────────────────────────────────

export class SourcesMatrixService {
  private auditSvc: AuditLogService

  constructor(private db: Pool) {
    this.auditSvc = new AuditLogService(db)
  }

  listVideoGroups(params: VideoGroupListParams): Promise<VideoGroupListResult> {
    return listVideoGroups(this.db, params)
  }

  getVideoGroupStats(): Promise<VideoGroupStats> {
    return getVideoGroupStats(this.db)
  }

  getVideoMatrix(videoId: string): Promise<LineMatrixRow[]> {
    return getVideoMatrix(this.db, videoId)
  }

  listLineAliases(): Promise<SourceLineAlias[]> {
    return listLineAliases(this.db)
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
