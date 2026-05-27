/**
 * dual-signal-count.types.ts — DualSignalCount 共享组件 Props 契约（CHG-360 / ADR-159）
 *
 * 真源：
 *   1. ADR-159 双轨信号 X/Y 聚合显示协议（D-159-1..7）
 *   2. arch-reviewer (claude-opus-4-7) A-CONDITIONAL → 主循环消化 5 红线 + 7 黄线 → 等同 A
 *
 * 业务语义：
 *   双轨信号「聚合显示」— 显示 "X/Y" 格式（如 "02/03"）+ 颜色编码 partial 黄色 / all_ok 绿色 / all_dead 红色 / pending 灰色。
 *
 * **使用场景**（D-159-3）：仅用于多元素聚合上下文 — line 维度（多 episode）/ video 维度（多线路）。
 *   单 source 必须用 `<SignalChip>`（单值 "可用 / 失效"）— 对 total=1 强行 X/Y 是类型污染 + 无信息增益。
 *
 * 设计稿渲染（与 DualSignal 视觉对齐）：
 * ```
 * ┌────────────┐
 * │ ● 探 02/03 │  ← probe 行（黄色 partial / 3 集中 2 集可用）
 * └────────────┘
 * ┌────────────┐
 * │ ● 播 03/03 │  ← render 行（绿色 all_ok）
 * └────────────┘
 * ```
 *
 * 颜色映射（D-159-4 / 复用 SourceCheckStatus 4 值 → token）：
 *   - state='ok'       → 绿 var(--state-success-fg) / "X/Y"
 *   - state='partial'  → 黄 var(--state-warning-fg) / "X/Y"
 *   - state='all_dead' → 红 var(--state-error-fg)   / "0/Y"
 *   - state='pending'  → 灰 var(--fg-muted)         / "—"（total=0 占位）
 *
 * 数字格式（D-159-5 / Y4）：
 *   - X / Y 均 < 10 时 padStart(2, '0') — "02/03"（与用户原话示例一致）
 *   - X / Y ≥ 10 时不 zero-pad — "12/15"
 *   - 公式：`String(n).padStart(Math.max(2, String(total).length), '0')`
 *
 * a11y（D-159-6 / Y7）：
 *   - 整体 role="group" + aria-label "探测/播放聚合信号"
 *   - 每行 aria-label 显式语义："链接探测：3 条中 2 条可用" / "实际播放：3 集均可用"
 *   - 不能只读 "2/3"（屏幕阅读器无法推断 "X 中 Y" 语义）
 *
 * R2/G2 设计决策：
 *   - 与 DualSignal **分离两个组件**（拒绝单组件 mode prop / 拒绝运行时类型分支）
 *   - 数据形 `DualSignalAggregate` 对象 vs `DualSignalDisplayState` 字符串是两种数据形 → 两个组件
 *   - 既有 DualSignal / SignalChip 消费方（4-6 处）零破坏
 */

import type { DualSignalAggregate } from '@resovo/types'

/**
 * DualSignalCount Props
 *
 * 渲染：垂直 column flex（与 DualSignal 同模式），上 probe pill + 下 render pill。
 * pill 内：`● 探 X/Y` 三段式（dot + 标签 + 数字 / 与 DualSignal 三段式对齐 / 复用 dual-signal-probe/render token）。
 */
export interface DualSignalCountProps {
  /** probe（链接探测）X/Y 聚合 / total >= 0；total=0 显示 "—" 灰色 */
  readonly probe: DualSignalAggregate

  /** render（实际播放）X/Y 聚合 */
  readonly render: DualSignalAggregate

  /**
   * 每个 pill 的最小宽度（px；默认 62 / 与 DualSignal 视觉对齐）
   *
   * 与 DualSignal 同消费方混排时（如 ModListRow 既显示单视频 X/Y 又显示其他视频单值）保持像素对齐。
   */
  readonly minPillWidth?: number

  /** 测试钩子 */
  readonly testId?: string
}
