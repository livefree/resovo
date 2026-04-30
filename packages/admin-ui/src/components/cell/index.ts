/**
 * cell/index.ts — admin-ui Cell 共享组件层（CHG-DESIGN-07 7A 阶段占位）
 *
 * 落地节奏（按 SEQ-20260429-02）：
 *   - CHG-DESIGN-07 7A（本阶段）：仅 type 契约（kpi-card.types.ts / spark.types.ts）
 *   - CHG-DESIGN-07 7B：实装（kpi-card.tsx / spark.tsx）+ 单测
 *   - CHG-DESIGN-12：扩张本目录（DualSignal / VisChip / thumb / pill / inline xs actions）
 *
 * 7A 阶段仅导出 type；7B 实装时再追加组件命名导出。
 */

export type {
  KpiCardProps,
  KpiCardDelta,
  KpiCardVariant,
  KpiDeltaDirection,
} from './kpi-card.types'

export type {
  SparkProps,
  SparkVariant,
} from './spark.types'
