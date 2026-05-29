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
  /**
   * HOTFIX-PATCH-2B-FIX1（2026-05-25）：该视频跨的站点列表（去重 / 升序）
   * SQL `STRING_AGG(DISTINCT vs.source_site_key, ',')` 派生 / 前端 siteKey 列 cell 显示
   */
  readonly siteKeys: readonly string[]
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
  /**
   * HOTFIX-PATCH-2B（2026-05-25）：siteKey 单值 → 数组（distinct 端点首次消费实证 / multi-select enum）
   * 多选语义"含至少一条线路在指定站点中的视频"（raw EXISTS ANY()）
   */
  readonly siteKey?: readonly string[]
  /**
   * ADR-150 阶段 5 EP-4-HOTFIX-PATCH-2A（2026-05-25）：probeStatus / renderStatus enum filter 全栈
   * 多选语义"含至少一条线路 status=X 的视频"（raw EXISTS ANY()）；不严格等同于 UI SignalPill 聚合显示
   */
  readonly probeStatus?: readonly string[]
  readonly renderStatus?: readonly string[]
  /**
   * ADR-150 阶段 5 EP-4-HOTFIX-PATCH-2A（2026-05-25）：updatedAt 日期范围 filter（YYYY-MM-DD）
   * 后端走 HAVING MAX(vs.updated_at) >= / <=（GROUP BY 后过滤）
   */
  readonly updatedAtFrom?: string
  readonly updatedAtTo?: string
  /**
   * ADR-150 阶段 5 EP-4（2026-05-24）：sort 全栈打通 sources（含 sources 排序断链顺手修）
   * 白名单 4 字段 / column.id = 后端 sortField 命名一致（D-150-4 桥接 sort 版同范式）
   */
  readonly sortField?: 'video' | 'lineCount' | 'sourceCount' | 'updated_at'
  readonly sortDir?: 'asc' | 'desc'
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
  /**
   * 运维短码（如 "泰山-2"）/ NULL = 未分配 / 永久绑定 (siteKey, sourceName)
   * Migration 079 / ADR-164 D-164-2 / 活跃部分唯一（idx_source_line_aliases_codename_active）/ 退役 90 天后可复用
   */
  readonly codename: string | null
  /**
   * Layer A effective_score priority_bonus 通道（0-100 / SMALLINT NOT NULL DEFAULT 0）
   * Migration 079 / ADR-164 D-164-3 / route-scoring.ts 归一化 priority/100
   */
  readonly priority: number
  /**
   * 软删时间戳 / NULL = 在役 / NOT NULL = 退役时间
   * Migration 079 / ADR-164 D-164-4 / 应用层判定 90 天冷却期
   */
  readonly retiredAt: string | null
  /**
   * true = worker 自动退役（全 dead 180 天 / plan §10.5）/ false = 人工 POST retire 端点
   * Migration 079 / ADR-164 D-164-8 / 区分人工/自动退役来源
   */
  readonly autoRetired: boolean
  readonly updatedAt: string
}

/**
 * 全线路视图行（CHG-SN-9-LINES-VIEW-UNIFY / ADR-164 §5.2 #5 / Wave 3 验收期补丁）
 *
 * 派生自 `video_sources DISTINCT (source_site_key, source_name) LEFT JOIN source_line_aliases`：
 * - **已分配**（source_line_aliases 有行）：displayName/codename/priority/retiredAt/autoRetired 取自 sla / assignedAt = sla.updated_at
 * - **未分配**（source_line_aliases 无行）：displayName fallback = source_name / codename=null / priority=0 / retiredAt=null / autoRetired=false / assignedAt=null
 *
 * 与 SourceLineAlias 区别：本类型保证全量返回 video_sources 派生的所有线路（含 unassigned），
 * 而 SourceLineAlias 仅描述 source_line_aliases 表内一行（已分配）。
 */
export interface SourceLineRow {
  readonly sourceSiteKey: string
  readonly sourceName: string
  /** 别名展示名 / 未分配时 = source_name */
  readonly displayName: string
  /** Layer B 山名代号 / 未分配时 null */
  readonly codename: string | null
  /** 0-100 / 未分配时 0 */
  readonly priority: number
  /** 软删时间戳 / 在役 → null */
  readonly retiredAt: string | null
  /** true = worker 自动退役 / false = 人工 / 默认 false */
  readonly autoRetired: boolean
  /** sla.updated_at / 未分配时 null（UI 区分"已分配 / 未分配"标识） */
  readonly assignedAt: string | null
  /** 视频数（DISTINCT video_id 命中该线路）*/
  readonly videoCount: number
  /** 活跃 episode 数 */
  readonly activeCount: number
  /** 总 episode 数（含 inactive） */
  readonly episodeCount: number
}

/**
 * codename 字库可用性查询响应（ADR-164 §5.6 / GET /admin/source-line-aliases/codename-pool）
 * 三段：available（运营可用列表）/ occupied（活跃使用中）/ cooling（退役 < 90 天）
 */
export interface CodenamePool {
  readonly available: readonly string[]
  readonly occupied: readonly string[]
  readonly cooling: readonly string[]
}

/**
 * upsert 别名 input（ADR-117 既有 PUT body 扩 codename + priority 可选字段 / ADR-164 §5.6）
 * displayName 必填（既有 NOT NULL 约束保留）/ codename + priority 可选（NULL/默认值合法）
 */
export interface UpsertAliasInput {
  readonly displayName: string
  readonly codename?: string | null
  readonly priority?: number
}

/**
 * 退役 input（ADR-164 §5.6 / POST /admin/source-line-aliases/:siteKey/:sourceName/retire）
 * reason 可选退役原因（≤ 200 字符 / audit payload 记录）
 */
export interface RetireAliasInput {
  readonly reason?: string
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
