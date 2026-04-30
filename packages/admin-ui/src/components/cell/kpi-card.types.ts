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
 * variant + delta.direction 两个独立维度组合覆盖 §5.1.2 4 张 KPI 全部状态：
 *   - 视频总量 695     → variant="default"   delta.direction="up"   text="↑ +47 今日"
 *   - 待审/暂存 484/23 → variant="is-warn"   delta.direction="flat" text="较昨日 +18"
 *   - 源可达率 98.7%   → variant="is-ok"     delta.direction="up"   text="↑ 0.3pt 7d"
 *   - 失效源 1,939     → variant="is-danger" delta.direction="down" text="↓ -28 较昨日"
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
 * KpiCard.delta 趋势方向（可选）— **仅控制 delta 文本染色，不注入任何箭头字符**
 *
 * - `up`：delta 文本染 `var(--state-success-fg)`
 * - `down`：delta 文本染 `var(--state-error-fg)`
 * - `flat`：delta 文本染 `var(--fg-muted)`（中性灰，如「较昨日 +18」纯数字 delta）
 * - 省略：等同 `flat`
 *
 * **箭头字符策略**（与 KpiCardDelta.text 联合契约）：
 * 箭头视觉（↑ / ↓）由消费方按本地化 / 文案策略自行写入 `text` 字段，本组件**不**自动注入；
 * `direction` 仅决定染色 token。这样消费方可以传如：
 * - `{ text: "↑ +47 今日",  direction: 'up' }`   → 文本含箭头，染绿
 * - `{ text: "较昨日 +18", direction: 'flat' }`  → 纯数字，染灰
 * - `{ text: "▲ +0.3pt 7d", direction: 'up' }`  → 用三角符号代替箭头，仍染绿
 */
export type KpiDeltaDirection = 'up' | 'down' | 'flat'

/**
 * KpiCard delta 子结构
 *
 * 设计稿示例（reference §5.1.2 4 张 KPI delta 列）：
 * - `{ text: "↑ +47 今日",  direction: 'up' }`    → 视频总量
 * - `{ text: "较昨日 +18",  direction: 'flat' }`  → 待审/暂存（容器 is-warn，但 delta 仅 +18 数字）
 * - `{ text: "↑ 0.3pt 7d", direction: 'up' }`    → 源可达率
 * - `{ text: "↓ -28 较昨日", direction: 'down' }` → 失效源
 *
 * 渲染契约：
 * - 本组件渲染 `text` 字段**原样**（11px 字号 / state-* 颜色由 direction 决定）
 * - 不注入任何箭头 / 三角 / 符号字符（消费方负责文案完整性）
 * - 详见 KpiDeltaDirection 顶部"箭头字符策略"段
 */
export interface KpiCardDelta {
  /** delta 文本（11px；state-* 染色由 direction 决定）；箭头字符由消费方写入此字段 */
  readonly text: string
  /** 趋势方向（仅控制颜色染色，不注入任何箭头字符） */
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
 * - variant=`is-warn|is-danger|is-ok` → 容器 border + value 染色（default 不染）
 * - delta.direction=`up|down|flat` → delta 文本染色（state-success-fg / state-error-fg / fg-muted），**独立于 variant**
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
   * **slot 渲染契约**（实装可证一致；7B 实装必须遵守）：
   * - `spark` prop 为 `undefined` 或 `null`（falsy）→ KpiCard **不渲染** `[data-kpi-card-spark]`
   *   节点；footer 仅含 delta（如有），通过 footer 容器 `min-height: 18px` 维持 4 张 KPI 横向对齐
   * - `spark` prop 为非 null ReactNode（包括 ReactElement 如 `<Spark data={[]} />`，即使该元素
   *   渲染结果为 null）→ KpiCard 渲染 `[data-kpi-card-spark]` 60×18 容器；容器内由 ReactNode
   *   自行决定是否产生 svg DOM（消费方传 `<Spark data={[]} />` 时容器存在但内部 svg 为空）
   * - 该契约源于 React 心智：父组件无法在渲染前/中/后探测子元素的渲染输出，仅能判断 prop 自身的
   *   truthy 性。消费方按需精确控制：**不需要 spark 时直接不传 prop / 传 null**；**需要 60×18
   *   占位区（保持视觉一致）时传非 null ReactNode**
   * - 4 张 KPI 横向对齐保障：footer 容器固定 `min-height: 18px`（无 spark 时 delta 撑高 ≤ 18px，
   *   仍由 min-height 兜底；有 spark 时 60×18 与 min-height 一致）
   * - spark 容器区域固定 60×18，overflow hidden（消费方传超出尺寸的节点会被裁剪）
   */
  readonly spark?: ReactNode

  /** 标题前的 icon slot（可选；reference 4 张 KPI 默认无 icon） */
  readonly icon?: ReactNode

  /** 整卡可点击时的回调；提供时容器渲染为 button + 加 hover 态 */
  readonly onClick?: () => void

  /**
   * 数据来源标记（'mock' | 'live' | 不传）
   *
   * 三种状态的 DOM attribute 行为（实装可证一致；7B 单测覆盖）：
   * - 不传 / undefined → KpiCard 根节点**不渲染** `data-source` attribute（语义"未声明"）
   * - `'mock'` → KpiCard 根节点渲染 `data-source="mock"`
   * - `'live'` → KpiCard 根节点渲染 `data-source="live"`
   *
   * 注意：**显式 `'live'` 与不传不等价**（前者带 attribute、后者无 attribute）。消费方语义选择：
   * - "缺省 / 来源未知"场景 → 不传 prop（多数业务卡）
   * - "mock fallback"场景 → 传 `'mock'`（reference §5.1.4 教训：API 字段缺失时 fallback
   *   mock 并显式标记，不渲染破折号 `'—'`）
   * - "明确声明 live 数据"场景 → 传 `'live'`（用于多源混合卡需要区分时；Dashboard 4 张
   *   KPI 复用 ModerationStats 真字段时建议显式标 'live' 便于后续 INFRA-VISUAL-DIFF-CI
   *   按数据来源差异化截图基线）
   *
   * 视觉上三种状态**渲染完全相同**（attribute 不影响 CSS 选择器以外的视觉）；attribute 仅作为
   * e2e / unit / visual-diff CI 断言钩子的语义信号。
   */
  readonly dataSource?: 'mock' | 'live'

  /**
   * a11y aria-label（可选；省略时按 value 类型派生）
   *
   * 派生策略（实装可证一致；SSR 安全）：
   * - 显式传 `ariaLabel` → 直接使用
   * - 省略 + value 是 `string` 或 `number` → 派生 `${label}: ${value}`（如 "视频总量: 695"）
   * - 省略 + value 是非 string/number ReactNode（如 `<span>484 / 23</span>`）→ 仅使用 `label`
   *   并在 dev 环境 `console.warn` 提示消费方应显式传 ariaLabel（SSR 不可靠地从 ReactNode 树
   *   提取 textContent，强制 string/number 派生）
   */
  readonly ariaLabel?: string

  /** 测试钩子 */
  readonly testId?: string
}
