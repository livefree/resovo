/**
 * sources/types.ts — /admin/sources 视图数据类型契约（CHG-SN-5-11）
 *
 * 真源端点：apps/api/src/routes/admin/sources-matrix.ts
 *   - GET  /admin/sources/video-groups              — 视频分组列表
 *   - GET  /admin/sources/video-groups/stats        — KPI 统计
 *   - GET  /admin/sources/video-groups/:id/matrix   — 线路×集数矩阵
 *   - GET  /admin/source-line-aliases               — 全局别名列表
 *   - PUT  /admin/source-line-aliases/:key/:name    — 新建/更新别名
 */

export type SourceSegment = 'grouped' | 'dead' | 'correction' | 'orphan'
export type SignalStatus = 'ok' | 'partial' | 'dead' | 'pending'

export interface VideoGroupRow {
  videoId: string
  title: string
  shortId: string
  type: string
  year: number | null
  coverUrl: string | null
  lineCount: number
  sourceCount: number
  probeStatus: SignalStatus
  renderStatus: SignalStatus
  updatedAt: string
}

export interface VideoGroupListResult {
  readonly data: readonly VideoGroupRow[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

export interface VideoGroupListParams {
  page?: number
  limit?: number
  keyword?: string
  segment?: SourceSegment
  siteKey?: string
}

export interface VideoGroupStats {
  total: number
  active: number
  dead: number
  orphan: number
}

export interface EpisodeCell {
  episodeNumber: number
  sourceId: string
  sourceUrl: string
  probeStatus: SignalStatus
  renderStatus: SignalStatus
  isActive: boolean
}

export interface LineMatrixRow {
  sourceSiteKey: string
  sourceName: string
  displayName: string | null
  episodes: EpisodeCell[]
}

export interface SourceLineAlias {
  sourceSiteKey: string
  sourceName: string
  displayName: string
  updatedAt: string
}
