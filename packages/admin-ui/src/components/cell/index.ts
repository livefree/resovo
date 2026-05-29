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

// ── BarSignal（CHG-SN-4-04 D-14 第 1 件）────────────────────────

export { BarSignal } from './bar-signal'
export type {
  BarSignalProps,
  BarSignalSize,
} from './bar-signal.types'

// ── DecisionCard（CHG-SN-4-04 D-14 第 5 件 · 跨层下沉例外 ADR-106）

export { DecisionCard } from './decision-card'
export type {
  DecisionCardProps,
  DecisionCardVideo,
} from './decision-card.types'

// ── DualSignal ──────────────────────────────────────────────────
// CHG-SN-4-04 R2：DualSignalState 类型源收敛至 `@resovo/types`；本包不再 own 类型 owner。
// 旧消费方迁移：`import type { DualSignalDisplayState } from '@resovo/types'`

export { DualSignal } from './dual-signal'
export type { DualSignalProps } from './dual-signal.types'

// ── DualSignalCount（CHG-360-A / ADR-159）─────────────────────────
// X/Y 聚合显示 / partial 黄色 / 用于 line（多 episode）+ video（多线路）聚合上下文
// 单 source 仍用 SignalChip（"可用 / 失效"）— 不混用

export { DualSignalCount } from './dual-signal-count'
export type { DualSignalCountProps } from './dual-signal-count.types'

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

// ── UserRef / CodeText / IdRef / MutedText（CHG-SN-6-RETRO-3-C / arch-reviewer Opus PASS）
// 4 audit / history / 通用列共享 cell；零业务下沉，primitive Props，i18n 不下沉
// 沉淀阈值：每个 cell ≥ 3 消费方场景（详见各 .types.ts 头部注释）

export { UserRef } from './user-ref'
export type { UserRefProps } from './user-ref.types'

export { CodeText } from './code-text'
export type { CodeTextProps } from './code-text.types'

export { IdRef } from './id-ref'
export type { IdRefProps } from './id-ref.types'

export { MutedText } from './muted-text'
export type { MutedTextProps } from './muted-text.types'

// ── SignalChip（FIX-B / CHG-SN-7-MISC-MOD-PLAYER；arch-reviewer Opus PASS）
// 单路信号 Chip（probe / render）；供 LinesPanel EpisodeRow 展开后集数级可视化

export { SignalChip } from './signal-chip'
export type {
  SignalChipProps,
  SignalChipVariant,
  SignalChipSize,
} from './signal-chip.types'
