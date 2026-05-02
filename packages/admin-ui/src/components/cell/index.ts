/**
 * cell/index.ts — admin-ui Cell 共享组件层
 *
 * 落地节奏（按 SEQ-20260429-02）：
 *   - CHG-DESIGN-07 7A：Props 契约（kpi-card.types.ts / spark.types.ts）✅
 *   - CHG-DESIGN-07 7B：实装（kpi-card.tsx / spark.tsx）+ 单测 ✅
 *   - CHG-DESIGN-12 12A：5 cell 契约（pill / dual-signal / vis-chip / thumb / inline-row-actions）✅
 *   - CHG-DESIGN-12 12B：5 cell 实装 + 单测（本阶段）
 */

// ── KpiCard ─────────────────────────────────────────────────────

export { KpiCard } from './kpi-card'
export type {
  KpiCardProps,
  KpiCardDelta,
  KpiCardVariant,
  KpiDeltaDirection,
} from './kpi-card.types'

// ── Spark ───────────────────────────────────────────────────────

export { Spark } from './spark'
export type {
  SparkProps,
  SparkVariant,
} from './spark.types'

// ── Pill ────────────────────────────────────────────────────────

export { Pill } from './pill'
export type {
  PillProps,
  PillVariant,
} from './pill.types'

// ── DualSignal ──────────────────────────────────────────────────
// CHG-SN-4-04 R2：DualSignalState 类型源收敛至 `@resovo/types`；本包不再 own 类型 owner。
// 旧消费方迁移：`import type { DualSignalDisplayState } from '@resovo/types'`

export { DualSignal } from './dual-signal'
export type { DualSignalProps } from './dual-signal.types'

// ── VisChip ─────────────────────────────────────────────────────

export { VisChip } from './vis-chip'
export type {
  VisChipProps,
  VisibilityStatus,
  ReviewStatus,
} from './vis-chip.types'

// ── Thumb ───────────────────────────────────────────────────────

export { Thumb } from './thumb'
export type {
  ThumbProps,
  ThumbSize,
} from './thumb.types'

// ── InlineRowActions ────────────────────────────────────────────

export { InlineRowActions } from './inline-row-actions'
export type {
  InlineRowActionsProps,
  InlineRowAction,
} from './inline-row-actions.types'
