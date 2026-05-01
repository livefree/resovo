/**
 * pill.types.ts — Pill 共享组件 Props 契约（CHG-DESIGN-12 12A）
 *
 * 真源（按优先级）：
 *   1. `docs/designs/backend_design_v2.1/styles/components.css` `.pill / .pill--*` (398-422)
 *   2. `docs/designs/backend_design_v2.1/reference.md` §4.2「Pill：11px/500，1px 7px，radius full，**必须含 6px dot**；
 *      状态必须使用 soft 背景，不要用实色大块」
 *   3. `docs/designs/backend_design_v2.1/reference.md` §6 各表格 pill 列规范（type / image / review / sources 等）
 *   4. CHG-DESIGN-12 任务卡（SEQ-20260429-02 第 12 卡 · 12A 阶段）
 *
 * 设计语义（reference §4.2）：
 *   - `display: inline-flex; align-items: center; gap: 4px`
 *   - `padding: 1px 7px; font-size: 11px; font-weight: 500`
 *   - `border-radius: var(--radius-full)`
 *   - **必须含 6px dot**（设计稿硬约束；CSS `.pill .dot { width:6px; height:6px; border-radius:50% }`）
 *   - 状态变体使用 soft 背景（`{state}-soft / {state}-fg`）；不允许实色大块背景
 *
 * variant 映射（design-tokens 真源；无 `(soft)` 后缀语义 — `-bg` 即 soft 背景）：
 *   - `neutral`（默认无 .pill--*）→ `--bg-surface-raised / --fg-muted`
 *   - `ok` → `--state-success-bg / --state-success-fg`
 *   - `warn` → `--state-warning-bg / --state-warning-fg`
 *   - `danger` → `--state-error-bg / --state-error-fg`
 *   - `info` → `--state-info-bg / --state-info-fg`
 *   - `accent` → `--admin-accent-soft / --admin-accent-on-soft`
 *   - `probe` → `--dual-signal-probe-soft / --dual-signal-probe`（DualSignal 内部用；packages/design-tokens 已定义）
 *   - `render` → `--dual-signal-render-soft / --dual-signal-render`（同上）
 *
 * 与 CHG-DESIGN-07 KpiCard / Spark 共存：
 *   - 7B 已落地 KpiCard + Spark；本卡（12B）落地 Pill / DualSignal / VisChip / Thumb / InlineRowActions
 *   - cell 共享组件总览 7：KpiCard / Spark / Pill / DualSignal / VisChip / Thumb / InlineRowActions
 *
 * 不变约束：
 *   - 颜色仅消费 packages/design-tokens（`--state-*` / `--admin-accent-*`）
 *   - 不引入图标库依赖（dot 是简单 span 元素）
 *   - Edge Runtime 兼容
 */

import type { ReactNode } from 'react'

/**
 * Pill 状态变体（按 reference §4.2 + components.css `.pill--*` 映射）
 *
 * - `neutral`（默认）：中性灰；用于无状态语义的 type label（reference §6.1 type 列）
 * - `ok` / `warn` / `danger` / `info`：4 状态；用于 review / probe / image 等状态列
 * - `accent`：品牌 accent；用于"激活 / 选中"语义（如 sidebar active item）
 * - `probe` / `render`：DualSignal 双信号专属配色（设计稿 components.css `.pill--probe / --render`
 *   + design-tokens `--dual-signal-probe(-soft)` / `--dual-signal-render(-soft)`）；
 *   仅供 DualSignal 内部消费，业务消费方应直接用 `<DualSignal>` 而非自己组装 probe/render Pill
 */
export type PillVariant = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'probe' | 'render'

/**
 * Pill Props
 *
 * 渲染契约（reference §4.2 + components.css）：
 * ```
 * ┌──────────────────────┐
 * │ ● label              │  ← inline-flex / 1px 7px / 11px/500 / radius full
 * └──────────────────────┘
 *   ↑
 *   6px dot（必须；variant 决定颜色）
 * ```
 *
 * dot 渲染规则：
 * - 默认渲染（设计稿硬约束）；消费方**不可隐藏 dot**
 * - dot 颜色 = variant 主色（如 `ok` → `--state-success-fg`）
 *
 * a11y：
 * - 默认 `role="status"`（隐式告知屏幕阅读器为状态指示器）
 * - children 文本即 a11y 名（无需 ariaLabel；除非 children 非 string ReactNode）
 */
export interface PillProps {
  /**
   * Pill 文本 / 内容
   *
   * 类型 ReactNode 允许复合（如 reference §6.1 sources 列 `<strong>{n}</strong> + <span muted>{活跃}</span>`），
   * 但常规用法是 string（"已通过" / "已拒" / "待审"等）。
   */
  readonly children: ReactNode

  /** 状态变体（默认 'neutral'） */
  readonly variant?: PillVariant

  /**
   * a11y aria-label（可选；省略时由 children 派生）
   *
   * children 是 string → ariaLabel 默认 = children
   * children 是非 string ReactNode → 必须显式传 ariaLabel（dev 环境 console.warn 提示）
   */
  readonly ariaLabel?: string

  /** 测试钩子 */
  readonly testId?: string
}
