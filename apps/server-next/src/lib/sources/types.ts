/**
 * sources/types.ts — /admin/sources 视图类型 re-export 桥接（CHG-SN-5-11-PATCH-2 D-117-7）
 *
 * 真源在 `@resovo/types` 的 `sources-matrix.types.ts`。本文件仅 re-export 保持现有
 * `@/lib/sources/types` import path 不破坏，过渡期消费方可逐步直接 import from
 * `@resovo/types`（CLAUDE.md "统一类型入口"）。
 */

export type {
  SourceSegment,
  VideoGroupRow,
  VideoGroupListResult,
  VideoGroupListParams,
  VideoGroupStats,
  EpisodeCell,
  LineMatrixRow,
  SourceLineAlias,
} from '@resovo/types'
