/**
 * sources-matrix.types.ts — /admin/sources 视图数据类型契约（ADR-117 / CHG-SN-5-11-PATCH-2 D-117-7 迁移）
 *
 * 真源端点：`apps/api/src/routes/admin/sources-matrix.ts`
 *   - GET  /admin/sources/video-groups              — 视频分组列表
 *   - GET  /admin/sources/video-groups/stats        — KPI 统计
 *   - GET  /admin/sources/video-groups/:id/matrix   — 线路×集数矩阵
 *   - GET  /admin/source-line-aliases               — 全局别名列表
 *   - PUT  /admin/source-line-aliases/:key/:name    — 新建/更新别名（admin only）
 *
 * 共享层：本文件是 admin /sources 视图的唯一类型真源；apps/server-next + apps/api
 * 不得本地重复定义同名 type / interface。
 */

import type { DualSignalState } from './admin-moderation.types'

export type SourceSegment = 'grouped' | 'dead' | 'correction' | 'orphan'

export interface VideoGroupRow {
  readonly videoId: string
  readonly title: string
  readonly shortId: string
  readonly type: string
  readonly year: number | null
  readonly coverUrl: string | null
  readonly lineCount: number
  readonly sourceCount: number
  /** 行级聚合 probe 信号（Service 层 aggregateSignal 合成） */
  readonly probeStatus: DualSignalState
  /** 行级聚合 render 信号（Service 层 aggregateSignal 合成） */
  readonly renderStatus: DualSignalState
  readonly updatedAt: string
}

export interface VideoGroupListResult {
  readonly data: readonly VideoGroupRow[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

export interface VideoGroupListParams {
  readonly page?: number
  readonly limit?: number
  readonly keyword?: string
  readonly segment?: SourceSegment
  readonly siteKey?: string
  readonly probeStatus?: string
  readonly renderStatus?: string
}

export interface VideoGroupStats {
  readonly total: number
  readonly active: number
  readonly dead: number
  readonly orphan: number
}

export interface EpisodeCell {
  readonly episodeNumber: number
  readonly sourceId: string
  readonly sourceUrl: string
  readonly probeStatus: DualSignalState
  readonly renderStatus: DualSignalState
  readonly isActive: boolean
}

export interface LineMatrixRow {
  readonly sourceSiteKey: string
  readonly sourceName: string
  readonly displayName: string | null
  readonly episodes: readonly EpisodeCell[]
}

export interface SourceLineAlias {
  readonly sourceSiteKey: string
  readonly sourceName: string
  readonly displayName: string
  readonly updatedAt: string
}

/**
 * ADR-117 AMENDMENT 2026-05-19 / CHG-SN-7-REDO-01-E：
 * GET /admin/sources/routes/by-site/:siteKey 行。
 * 单站点聚合一条线路（sourceName）跨 N 个 video_sources 行的 worst 状态 + 平均延迟 + 别名。
 */
export interface SourceRouteBySite {
  readonly sourceSiteKey: string
  readonly sourceName: string
  readonly displayName: string | null
  readonly probeStatus: DualSignalState
  readonly renderStatus: DualSignalState
  readonly avgLatencyMs: number | null
  readonly sourceCount: number
  readonly activeCount: number
  readonly lastProbedAt: string | null
}
