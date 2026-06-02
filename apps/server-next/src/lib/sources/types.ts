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
