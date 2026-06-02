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

import type { DualSignalState, ResolutionTier } from './admin-moderation.types'

/**
 * @deprecated CHG-VSR-1（2026-06-01）：四 Tab segment 模型由 `SOURCE_QUICK_FILTERS`（B 方案 KPI 卡快捷筛选）取代。
 * 仅保留兼容（`SourcesClient` + `sources-matrix.ts` 仍引用），卡 5 末尾 UI 切换后删除枚举与 segment 查询分支（设计 §5.3）。
 */
export type SourceSegment = 'grouped' | 'dead' | 'correction' | 'orphan'

/**
 * 线路页快捷筛选（B 方案 KPI 卡 / 设计 §3.5）— 取代旧四 Tab（@deprecated `SourceSegment`）。
 * 均为探测维度②/质量派生，可组合 AND；`'all'` = 清空（仅 UI 卡身份用，`VideoGroupListParams.quickFilters` 不传 `'all'`）。
 * ADR-157 D-157-1 const + type 双形态（index.ts 须同步 value re-export）。
 */
export const SOURCE_QUICK_FILTERS = ['all', 'has_abnormal', 'needs_source', 'pending_probe', 'low_quality'] as const
export type SourceQuickFilter = (typeof SOURCE_QUICK_FILTERS)[number]

/**
 * 源问题维度（探测维度② / 设计 §0.2-A）。与启停维度①（`is_active`）**严格区分**。
 * - `connect_fail`：`probe_status='dead'`（连接失败 / 可达性）
 * - `render_fail`：`render_status='dead'`（试播失败 / 可播性）
 * - `pending_probe`：`probe_status='pending'`（待探测）
 * 「异常源」= `connect_fail` OR `render_fail`（任一 dead），**无独立枚举值**，由消费方按 OR 口径派生。
 */
export const SOURCE_PROBLEM_KINDS = ['connect_fail', 'render_fail', 'pending_probe'] as const
export type SourceProblemKind = (typeof SOURCE_PROBLEM_KINDS)[number]

/**
 * 「待补源视频」严重度（设计 §3.5.1）。待补源 = 视频无任何可播源（`is_active AND probe≠dead AND render≠dead`，不限上架）。
 * - `online_incident`：已上架且无可播源（红 / 线上事故 / 最紧急）
 * - `draft_pending`：未上架（草稿警示）
 */
export const NEEDS_SOURCE_SEVERITIES = ['online_incident', 'draft_pending'] as const
export type NeedsSourceSeverity = (typeof NEEDS_SOURCE_SEVERITIES)[number]

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

  // ── CHG-VSR-1（设计 §3.3）：播放线路双表重设计派生列（加性 optional，卡 3 API 填充）──
  // ⚠ 以下均为「线路级计数/派生」，区别于本行既有 probeStatus/renderStatus（Service aggregateSignal 的 worst-of 单值，非计数）。
  /** 可用源数 = `is_active=true`（**维度①启停**）。0 染 danger（= 全被禁用/无源）。卡 3 填充 */
  readonly activeSourceCount?: number
  /** 连接失败源数 = `probe_status='dead'`（**维度②探测·计数**；区别于行级聚合 `probeStatus` worst-of 单值）。卡 3 填充 */
  readonly connectFailCount?: number
  /** 试播失败源数 = `render_status='dead'`（**维度②探测·计数**；区别于行级聚合 `renderStatus` worst-of 单值）。卡 3 填充 */
  readonly renderFailCount?: number
  /** 待探测源数 = `probe_status='pending'`（**维度②**）。卡 3 填充 */
  readonly pendingProbeCount?: number
  /** 禁用源数 = `is_active=false`（**维度①**，中性非问题，§3.2 issues 列可选中性 badge）。卡 3 填充 */
  readonly disabledCount?: number
  /**
   * 视频级最高源分辨率档（展示用）。**逐源取 `quality_detected ?? quality` 回退后，跨该视频全部源取最高档**
   * （档位序 `4K > 2K > 1080P > 720P > 480P > 360P > 240P`，4K 最高；全空 → `null`）。
   * `null` = 无任何已知质量（显「质量未知」，**不并入低质量**）。值域/命名复用 canonical 类型 `ResolutionTier`（admin-moderation.types.ts，
   * 与 `StagingRow.qualityHighest` 同名同型）；上述档位序**无共享常量**（`aggregate.ts` 的 `QUALITY_ORDER` 是 admin-ui module-local、非导出），由 producer 卡 3 在 SQL CASE 内实现。
   * ⚠ **聚合口径勿照搬 LinesPanel `pickHighestQuality`（aggregate.ts，module-local）——它仅取 `quality_detected`、不含 `quality` 回退**；
   *   本字段须含 `quality_detected ?? quality` 回退链（设计 §0.2/§3.3，059 D-12），producer 卡 3 不得直接复用该函数。
   * 排序/低质量判定走服务端 rank 派生键（见 `VideoGroupListParams.lowQuality` / `sortField='quality'`，非 DTO 字段）。卡 3 填充
   */
  readonly qualityHighest?: ResolutionTier | null
  /** 画质已检测覆盖率 0–1（`COUNT(quality_detected IS NOT NULL)/COUNT(*)`，画质实测比例非 probe）。卡 3 填充 */
  readonly qualityCoverage?: number
  /** 延迟中位数 ms（`percentile_cont(0.5) WITHIN GROUP ORDER BY latency_ms`）。卡 3 填充 */
  readonly latencyMedianMs?: number | null
  /** 待补源 = 无任何可播源（`is_active AND probe≠dead AND render≠dead`，§3.5.1，不限上架）。卡 3 填充 */
  readonly needsSource?: boolean
  /** 是否已上架（**仅供消费方派生 `NeedsSourceSeverity`**：已上架+needsSource=online_incident 红；非展示列）。卡 3 填充 */
  readonly isPublished?: boolean
  /** 最近检测时间 = `MAX(last_probed_at)` 回退 `MAX(vs.updated_at)`。卡 3 填充 */
  readonly lastCheckedAt?: string | null
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
   * CHG-VSR-1（设计 §3.5）：快捷筛选 KPI 卡（B 方案），可组合 AND；UI 不传 `'all'`。
   * ⚠ 与 `lowQuality` 对「低质量」是**同一低质量谓词**（见下 `lowQuality` 定义）：
   *   producer 须 **OR 合流** `quickFilters.includes('low_quality') || lowQuality===true`，二者不叠加不冲突（卡 3 单测覆盖等价性）。
   * 两个独立 UI 入口：`quickFilters`=KPI 卡（跨列快捷筛选）/ `lowQuality`=质量列列筛选（DataTableAutoFilter boolean）。
   */
  readonly quickFilters?: readonly SourceQuickFilter[]
  /**
   * 质量列 boolean 列筛选（低质量）。与 `quickFilters` 的 `'low_quality'` 同谓词（见上 OR 合流）。
   * **低质量定义（producer 卡 3 实现）**：视频级最高源分辨率 `< 720P`（即 `ResolutionTier` 后三档 480P/360P/240P）。
   * 排序/阈值键由服务端逐源 **`quality_detected ?? quality` 回退**后按 `ResolutionTier` 档位派生
   *   （`quality_rank`，纯 SQL 内部、非 DTO 字段；口径须与 `qualityHighest` 一致，含 `quality` 回退）；
   * 「质量未知」（无任何已知质量）**不并入**低质量。卡 3 实现
   */
  readonly lowQuality?: boolean
  /** 最近检测 date-range（YYYY-MM-DD / `last_probed_at`；后端 `HAVING MAX(vs.last_probed_at)`）。卡 3 实现 */
  readonly lastCheckedFrom?: string
  readonly lastCheckedTo?: string
  /**
   * ADR-150 阶段 5 EP-4（2026-05-24）+ CHG-VSR-1 扩（§3.4）：sort 白名单。
   * 新增 `activeSources`(active_source_count) / `quality`(服务端 ResolutionTier 档位排序键 / 见 `lowQuality`) / `lastChecked`(MAX(last_probed_at))。
   * 值 = producer SORT_FIELD_MAP key（与展示字段名可不同）；既有 camel/snake 混用属技术债，本卡不修（新增统一 camel）。
   */
  readonly sortField?: 'video' | 'lineCount' | 'sourceCount' | 'updated_at' | 'activeSources' | 'quality' | 'lastChecked'
  readonly sortDir?: 'asc' | 'desc'
}

/**
 * 线路页 KPI 统计。
 * ⚠ **维度混居**（卡 5 rename 级联后收敛）：
 *   - `total/active/dead/orphan` = 旧四 Tab 遗留；`active/dead/orphan` 基于**维度① source_check_status**
 *     （active=ok|partial / dead=all_dead / orphan=all_dead AND !is_published）。
 *   - `abnormal/needsSource/pendingProbe/lowQuality` = CHG-VSR-1 新增 B 方案 5 KPI 卡，基于**维度②探测/质量**。
 *   ⇒ `abnormal`（维度② connect OR render dead）**≠** `dead`（维度① all_dead），producer 不得混算（设计 §0.2）。
 *   卡 5 完成 rename 级联后移除 `dead/orphan` 旧字段。
 */
export interface VideoGroupStats {
  readonly total: number
  readonly active: number
  readonly dead: number
  readonly orphan: number
  /** CHG-VSR-1：含异常源（连接 OR 试播失败，**维度②**）。卡 3 填充 */
  readonly abnormal?: number
  /** CHG-VSR-1：待补源（无可播源，§3.5.1）。卡 3 填充 */
  readonly needsSource?: number
  /** CHG-VSR-1：待探测（`probe_status='pending'`，**维度②**）。卡 3 填充 */
  readonly pendingProbe?: number
  /** CHG-VSR-1：低质量（最高源分辨率 < 720P，仅已知质量；定义见 `VideoGroupListParams.lowQuality`）。卡 3 填充 */
  readonly lowQuality?: number
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
