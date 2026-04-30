/**
 * kpi-card.types.ts — KpiCard 共享组件 Props 契约（CHG-DESIGN-07 7A）
 *
 * 真源（按优先级）：
 *   1. `docs/designs/backend_design_v2.1/reference.md` §4.3 Card / KPI / Table 基础
 *   2. `docs/designs/backend_design_v2.1/reference.md` §5.1.2 4 张 MetricKpiCard mock 蓝图
 *   3. CHG-DESIGN-07 任务卡（SEQ-20260429-02 第 7 卡 · 7A 阶段）
 *   4. CLAUDE.md 「实现前定义 Props 类型」+ S 级模块 Opus 子代理硬约束
 *
 * 设计语义（reference §4.3）：
 *   - bg2 / border / radius r-3，padding 14px 16px
 *   - label 11px uppercase，letter spacing 1px
 *   - value 26px / weight 700，使用 tabular number
 *   - delta 11px，状态色仅作用于 value / delta，**不改变整卡大面积背景**
 *   - spark 60×18 svg 在右下角 opacity 0.4
 *   - is-warn / is-danger / is-ok 控制 border + value 染色
 *
 * variant union 覆盖 §5.1.2 4 张 KPI 全部状态：
 *   - 视频总量 695     → variant="default"   delta is-up      "↑ +47 今日"
 *   - 待审/暂存 484/23 → variant="is-warn"   delta default    "较昨日 +18"
 *   - 源可达率 98.7%   → variant="is-ok"     delta is-up      "↑ 0.3pt 7d"
 *   - 失效源 1,939     → variant="is-danger" delta is-down    "↓ -28 较昨日"
 *
 * Spark 解耦：通过 ReactNode `spark` slot 注入（而非 `data: number[]` 硬依赖）：
 *   - KpiCard 不强制 KPI 数据形态（避免 SiteHealthCard 之类消费方需要不同 spark 渲染时被锁死）
 *   - 消费方通常传 `<Spark data={...} variant="line" color="..." />` 但也可以传任意 60×18 ReactNode
 *
 * 与 CHG-DESIGN-12 cell 归属边界：
 *   - 本卡（CHG-DESIGN-07 7B）落地：KpiCard + Spark
 *   - CHG-DESIGN-12 落地：DualSignal / VisChip / thumb / pill / inline xs actions
 *   - 边界依据：KpiCard / Spark 是 Dashboard 优先消费方（4 张 KPI），视频库不消费
 *
 * 不变约束：
 *   - 颜色只用 packages/design-tokens semantic + admin-layout 层（`--admin-accent-*` / `--state-*` / `--bg-*`）
 *   - 不引入图标库依赖（icon slot 接受 ReactNode 由消费方注入 lucide-react 等）
 *   - Edge Runtime 兼容：纯展示组件，无 fetch / Cookie / localStorage
 */

import type { ReactNode } from 'react'

/**
 * KpiCard 状态变体（整卡警示染色维度）
 *
 * - `default`：中性卡（视频总量等基础指标）— border default + value fg-default
 * - `is-warn` / `is-danger` / `is-ok`：警示状态卡 — border 染状态色 + value 染状态色，但**不改变整卡大面积背景**
 *
 * 设计稿映射：
 * - `default` → border-default / value fg-default
 * - `is-warn` → border state-warning-border + value state-warning-fg
 * - `is-danger` → border state-error-border + value state-error-fg
 * - `is-ok` → border state-success-border + value state-success-fg
 *
 * 维度分离约束：
 *   delta 趋势染色（上升 / 下降）通过独立 `KpiCardDelta.direction` 控制（见下方 KpiDeltaDirection），
 *   不在 variant 维度。一张卡可同时是 `variant: 'is-warn'`（容器警示）+ `delta.direction: 'up'`
 *   （趋势上升），两个维度组合在 reference §5.1.2 中真实存在。
 */
export type KpiCardVariant = 'default' | 'is-warn' | 'is-danger' | 'is-ok'

/**
 * KpiCard.delta 趋势方向（可选）
 *
 * - `up`：渲染 ↑ 前缀 + state-success-fg 染色
 * - `down`：渲染 ↓ 前缀 + state-error-fg 染色
 * - `flat`：渲染中性灰文案，不加箭头（如「较昨日 +18」纯数字 delta）
 * - 省略：等同 `flat`
 */
export type KpiDeltaDirection = 'up' | 'down' | 'flat'

/**
 * KpiCard delta 子结构
 *
 * 设计稿示例：
 * - `{ text: "↑ +47 今日", direction: 'up' }`
 * - `{ text: "较昨日 +18", direction: 'flat' }`
 * - `{ text: "↑ 0.3pt 7d", direction: 'up' }`
 * - `{ text: "↓ -28 较昨日", direction: 'down' }`
 *
 * 注：`text` 中的 ↑/↓ 字符**不**由本组件自动注入（消费方按本地化 / 文案策略自行决定）；
 *     `direction` 仅控制颜色染色，箭头视觉由消费方文案负责。
 */
export interface KpiCardDelta {
  /** delta 文本，11px / state-* 染色（按 direction） */
  readonly text: string
  /** 趋势方向（控制颜色染色，不注入箭头） */
  readonly direction?: KpiDeltaDirection
}

/**
 * KpiCard 主 Props
 *
 * 必填：label + value
 * 可选：delta / variant / spark / icon / onClick / 链接 hint / a11y
 *
 * 渲染契约（reference §4.3）：
 * ```
 * ┌──────────────────────────────────┐
 * │ ICON  LABEL（11px upper）         │ <- header row
 * │                                  │
 * │  VALUE（26px / 700 / tabular）   │ <- value row
 * │                                  │
 * │ delta（11px）   spark 60×18 .4   │ <- footer row（spark 右下）
 * └──────────────────────────────────┘
 * ```
 *
 * 状态规则：
 * - variant=`is-warn|danger|ok` → 容器 border + value 染色
 * - delta.direction=`up|down` → delta 文本染色（独立于 variant）
 * - icon slot：可选；reference §5.1.2 KPI 默认无 icon（设计稿 4 张 KPI 都没图标），但开放 slot 给未来新指标或 SiteHealthCard 等复用
 */
export interface KpiCardProps {
  /** 指标标签（11px uppercase / letter-spacing 1px / fg-muted） */
  readonly label: string

  /**
   * 指标主值（26px / weight 700 / tabular number）
   *
   * 类型为 ReactNode 而非 string / number — 允许复合渲染如「484 / 23」（待审/暂存）的双数值场景；
   * 消费方负责文案格式化（千分位 / 百分号 / 复合分隔符）。
   *
   * 渲染节点带 `data-card-value` 标记，用于 7C/7D regression gate 断言"值 slot 不出现 '—'"。
   */
  readonly value: ReactNode

  /** delta 子结构（可选） */
  readonly delta?: KpiCardDelta

  /** 卡片状态变体（默认 'default'） */
  readonly variant?: KpiCardVariant

  /**
   * Spark 视觉 slot（可选）
   *
   * 渲染于卡片右下角，opacity 0.4（容器层应用，消费方传 spark 节点不需自己加 opacity）。
   * 典型用法：`<Spark data={[...]} variant="line" color="var(--accent-default)" />`
   * 但也可以传任意 60×18 ReactNode（自定义 svg / 图标 / 状态指示器）。
   *
   * **null / undefined 行为契约**（7B 实装必须遵守）：
   * - `spark` 为 undefined 或渲染结果为 null（如消费方传 `<Spark data={[]} />` 而 Spark 0 数据
   *   点 return null）时，KpiCard 容器 spark 区域**不渲染占位空白**，footer row 仍保留 delta
   *   左对齐布局
   * - 4 张 KPI 并排时若部分卡无 spark，footer 行高仍由 delta 行撑开，**视觉对齐不受影响**
   * - spark 容器区域固定 60×18，overflow hidden（消费方传超出尺寸的节点会被裁剪）
   */
  readonly spark?: ReactNode

  /** 标题前的 icon slot（可选；reference 4 张 KPI 默认无 icon） */
  readonly icon?: ReactNode

  /** 整卡可点击时的回调；提供时容器渲染为 button + 加 hover 态 */
  readonly onClick?: () => void

  /**
   * 数据来源标记（mock | live | 不传）
   *
   * - 不传 / undefined：默认（live 数据，正常渲染）
   * - `'mock'`：节点带 `data-source="mock"`，便于 regression gate 识别 fallback 字段
   *   （用于 reference §5.1.4 教训：API 字段缺失时不渲染破折号，必须 fallback mock 并显式标记）
   *
   * 视觉上 mock 标记**不**改变渲染；仅作为 e2e / unit 断言钩子和未来 INFRA-VISUAL-DIFF-CI 的语义信号。
   */
  readonly dataSource?: 'mock' | 'live'

  /** a11y aria-label（可选；省略时由 label + value 组合） */
  readonly ariaLabel?: string

  /** 测试钩子 */
  readonly testId?: string
}
