/**
 * cell/index.ts — admin-ui Cell 共享组件层（CHG-DESIGN-07 7B 实装就位）
 *
 * 落地节奏（按 SEQ-20260429-02）：
 *   - CHG-DESIGN-07 7A：Props 契约（kpi-card.types.ts / spark.types.ts）✅
 *   - CHG-DESIGN-07 7B：实装（kpi-card.tsx / spark.tsx）+ 单测（本阶段）
 *   - CHG-DESIGN-12：扩张本目录（DualSignal / VisChip / thumb / pill / inline xs actions）
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
