/**
 * bar-signal.types.ts — BarSignal 共享组件 Props 契约（CHG-SN-4-04 D-14 下沉清单第 1 件）
 *
 * 真源（按优先级）：
 *   1. M-SN-4 plan v1.4 §3 复用矩阵明列 "M-SN-4 下沉" — BarSignal probe/render 双柱图
 *   2. 子方案 `docs/designs/backend_design_v2.1/M-SN-4-04-admin-ui-shared-components-plan_20260502.md` §2.1
 *   3. `@resovo/types` `DualSignalDisplayState`（CHG-SN-4-03 已就位）
 *
 * 业务语义：
 *   视频"链接探测 (probe / Level 1)"+"实际渲染 (render / Level 2)" 两路独立信号；
 *   横向并排两条柱图，柱高度 = 信号强度，柱颜色 = 状态等级。
 *   与 DualSignal（双 pill 文案版本）并存：DualSignal 适合行内紧凑展示，BarSignal 适合
 *   视觉强调（队列卡 / 决策卡 / 线路抽屉头部）。
 *
 * 设计稿渲染（横向并排）：
 *   ┌──┐ ┌──┐
 *   │██│ │▓▓│   ← probe（实柱，颜色按状态）│ render（虚柱，颜色按状态）
 *   │██│ │▓▓│
 *   └──┘ └──┘
 *    探   播
 *
 * 状态映射：
 *   - 'ok'      → 绿（`--admin-status-ok` / `--dual-signal-probe` ok 变体）
 *   - 'partial' → 黄（`--admin-status-warning`）
 *   - 'dead'    → 红（`--admin-status-danger`）
 *   - 'pending' → 灰（`--admin-status-pending` 或 muted；DB 4 值之一）
 *   - 'unknown' → 灰虚线（仅前端展示态；接口失败 / 未加载占位）
 *
 * 不变约束（packages/admin-ui v1）：
 *   - 颜色仅消费 packages/design-tokens（CSS 变量；零硬编码 hex）
 *   - 零图标库依赖（不 import lucide-react；如需图标由消费方注入 ReactNode）
 *   - Edge Runtime 兼容（模块顶层零 fetch / cookie / localStorage）
 *
 * 可访问性：
 *   - 默认 `<span role="img">` + `aria-label`；存在 `onClick` 时升级为 `<button>` + `aria-label` + 键盘可达
 *   - aria-label 默认中文「链接探测：{state}；实际渲染：{state}」由消费方注入完整文案
 */

import type { DualSignalDisplayState } from '@resovo/types'

/**
 * BarSignal 尺寸预设（与 cell/spark 对齐）。
 */
export type BarSignalSize = 'sm' | 'md'

/**
 * BarSignal Props
 */
export interface BarSignalProps {
  /** Level 1 链接探测状态（含 'unknown' 占位） */
  readonly probeState: DualSignalDisplayState

  /** Level 2 实际渲染状态（含 'unknown' 占位） */
  readonly renderState: DualSignalDisplayState

  /** 尺寸预设；默认 'md' */
  readonly size?: BarSignalSize

  /**
   * 完整 a11y label；建议消费方注入完整文案。
   * 不接 i18n（packages/admin-ui 不下沉 i18n），文案由消费方拼接。
   * 默认值：'probe/render 健康指示'（兜底，不推荐生产使用）
   */
  readonly ariaLabel?: string

  /**
   * 点击回调；存在时根元素升级为 button（键盘可达），否则 span。
   * 典型场景：点击打开 LineHealthDrawer。
   */
  readonly onClick?: () => void

  /** 测试钩子 */
  readonly testId?: string
}
