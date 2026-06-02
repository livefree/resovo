/**
 * sources/types.ts — /admin/sources 视图类型 re-export 桥接（CHG-SN-5-11-PATCH-2 D-117-7）
 *
 * 真源在 `@resovo/types` 的 `sources-matrix.types.ts`。本文件仅 re-export 保持现有
 * `@/lib/sources/types` import path 不破坏，过渡期消费方可逐步直接 import from
 * `@resovo/types`（CLAUDE.md "统一类型入口"）。
 */

export type {
  VideoGroupRow,
  VideoGroupListResult,
  VideoGroupListParams,
  VideoGroupStats,
  EpisodeCell,
  LineMatrixRow,
  SourceLineAlias,
  SourceLineRow,
  SourceRouteBySite,
  // CHG-VSR-1：双表重设计枚举类型（探测维度②术语 / 快捷筛选 / 待补源严重度）
  SourceQuickFilter,
  SourceProblemKind,
  NeedsSourceSeverity,
} from '@resovo/types'

// CHG-VSR-1（ADR-157 双形态）：枚举 const 值经统一入口透出（type-only re-export 不带 const）
export {
  SOURCE_QUICK_FILTERS,
  SOURCE_PROBLEM_KINDS,
  NEEDS_SOURCE_SEVERITIES,
} from '@resovo/types'

// ── CHG-VSR-PRE-2（§5.5 / arch-reviewer 蓝图 Y1 + R4）：中性线路控制器数据契约 ──────

/**
 * 中性单行播放源数据（`GET /admin/sources?videoId=` snake_case 响应行最小集）。
 *
 * Y1：审核台 `ContentSourceRow` ∪ 编辑抽屉 `VideoSource` ∩ admin-ui `RawSourceRow` 的交集超集，
 *     供 `useSourceLinesController` 与三消费方共用。可直接 `groupSourcesByLine(rows)`（结构兼容 RawSourceRow）。
 * 命名约束：**勿复名**既有 `SourceLineRow`（全线路别名视图行，语义不同）。
 *
 * 字段策略：
 *   - 聚合 / 乐观锁所需字段必填（id / source_name / source_url / episode_number / is_active /
 *     probe_status / render_status / latency_ms / updated_at / source_site_key）。
 *   - 派生 / 展示字段 optional（quality_detected + ADR-164 alias 三字段同源 + 站点/标题便利字段）。
 *     后端 `listAdminSources` `SELECT s.*` + alias LEFT JOIN 已实际返回（CHG-368-B-FOLLOWUP-* 系列）。
 */
export interface SourceLineRowData {
  readonly id: string
  /** Migration 061 行级乐观锁版本字段（CHG-SN-5-PRE-01-C） */
  readonly updated_at: string
  readonly source_site_key: string | null
  readonly source_name: string
  readonly source_url: string
  readonly episode_number: number | null
  readonly is_active: boolean
  readonly probe_status: string
  readonly render_status: string
  readonly latency_ms: number | null
  // ── 派生 / 展示 optional ──
  readonly quality_detected?: string | null
  /** 行级站点（后端 COALESCE(s.source_site_key, v.site_key)） */
  readonly site_key?: string | null
  readonly video_title?: string | null
  // ── ADR-164 alias 派生 3 字段集（D-164-2/-4/-8 / 同源不变式 / aggregate.ts 取首行）──
  readonly codename?: string | null
  readonly retired_at?: string | null
  readonly auto_retired?: boolean
}

/** 线路控制器动作类别（R4 结构化反馈 / 消费方据此映射 toast·alert·红条 i18n） */
export type SourceActionType =
  | 'toggle'
  | 'disableDead'
  | 'refetch'
  | 'probeEpisode'
  | 'renderCheckEpisode'
  | 'probeAll'
  | 'renderCheckAll'

/**
 * 动作终态：
 * - `success`：成功（probe/render 时配合 `dead` 区分线路失效；batch 配合 `summary`）
 * - `race`  ：409 REVIEW_RACE（仅 toggle / hook 已内部重 fetch，消费方只需提示）
 * - `freeze`：409 采集冻结（probe / batch）
 * - `failed`：其他失败
 */
export type SourceActionStatus = 'success' | 'race' | 'freeze' | 'failed'

export interface SourceActionBatchSummary {
  readonly total: number
  readonly ok: number
  readonly dead: number
  readonly failed: number
}

/**
 * R4：hook 不 push toast/alert，仅产出结构化结果经 `options.onActionResult` 注入。
 * 消费方映射：审核台→useToast / TabLines→alert(VE) / sources 展开区自定（CHG-VSR-6）。
 */
export interface SourceActionResult {
  readonly action: SourceActionType
  readonly status: SourceActionStatus
  /** 单源 probe/render-check 成功且新状态为 dead（仅 success 时有意义） */
  readonly dead?: boolean
  /** 批量 probe/render-check summary（probeAll / renderCheckAll success 时携带） */
  readonly summary?: SourceActionBatchSummary
  /**
   * 失败原始错误码（status='failed' 时携带 ApiClientError.code，供消费方精确映射 i18n）。
   * 例：TabLines 据 `STATE_INVALID` 区分提示；审核台忽略。
   */
  readonly code?: string
}
