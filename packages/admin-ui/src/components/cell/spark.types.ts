/**
 * spark.types.ts — Spark 共享组件 Props 契约（CHG-DESIGN-07 7A）
 *
 * 真源（按优先级）：
 *   1. `docs/designs/backend_design_v2.1/reference.md` §4.3「spark 60×18 svg 在右下角 opacity .4」
 *   2. `docs/designs/backend_design_v2.1/reference.md` §5.1.2 KpiCard spark 字段（accent / warn / ok / danger 4 色映射）
 *   3. `docs/designs/backend_design_v2.1/reference.md` §5.1.2 SiteHealthCard「Spark 60×18」（独立消费方）
 *   4. CHG-DESIGN-07 任务卡（SEQ-20260429-02 第 7 卡 · 7A 阶段）
 *
 * 设计语义：
 *   - 默认尺寸 60×18 svg（与 KpiCard / SiteHealthCard 设计稿一致）
 *   - line / area 两种 variant：
 *     · line：单线条 stroke，无填充（默认）
 *     · area：线条 + 半透明填充（用于强调累积趋势）
 *   - opacity 由 KpiCard 容器层应用（0.4），Spark 自身**不**加默认 opacity（保持纯净渲染，消费方决定）
 *   - 颜色：通过 `color` prop 注入 CSS 变量字符串（如 `var(--accent-default)` / `var(--state-warning-fg)`），
 *     **不**接受硬编码颜色（CLAUDE.md 禁止；packages/design-tokens 三层强制约束）
 *
 * 数据形态：
 *   - `data: readonly number[]` — 任意非负 / 负数都允许（如趋势可上下波动）
 *   - 0 个数据点 → **不渲染任何 DOM 节点（return null）**；不提供 a11y 替代节点；
 *     消费方需要"无趋势数据"占位时应在外层（如 KpiCard 容器或自定义 placeholder）自行处理
 *   - 1 个数据点 → 渲染单个 dot（避免线段为 0 长度时浏览器静默丢弃）；svg 含 `role="img"` + `aria-label`
 *   - N 个数据点（N ≥ 2）→ 正常 polyline / area；svg 含 `role="img"` + `aria-label`
 *
 * 与 CHG-DESIGN-12 cell 归属边界：
 *   - 本卡（CHG-DESIGN-07 7B）落地：Spark
 *   - CHG-DESIGN-12 不接管 Spark
 *   - 消费方：KpiCard.spark slot（4 张 MetricKpiCard）+ SiteHealthCard 行级 spark（前 8 站）
 *
 * 不变约束：
 *   - 颜色只用 packages/design-tokens；color prop 默认值 `var(--accent-default)`
 *   - 不引入 d3 / chart.js 等图表库（CLAUDE.md 禁止）
 *   - 自包含 svg path 计算（极简，无外部依赖）
 *   - Edge Runtime 兼容：纯展示组件
 */

/**
 * Spark 渲染变体
 *
 * - `line`（默认）：单线条 stroke，无填充；适用于趋势线（reference §5.1.2 KPI 4 张全是 line）
 * - `area`：线条 + 半透明填充（line 颜色 + opacity 0.2 fill）；适用于累积量 / 强调面积语义
 */
export type SparkVariant = 'line' | 'area'

/**
 * Spark 主 Props
 *
 * 渲染契约：
 * ```
 * ┌────────────┐  ← width × height (默认 60×18)
 * │   ╱╲       │
 * │  ╱  ╲ ╱╲   │  ← polyline path（line variant）
 * │ ╱    ╲     │      或 polygon area（area variant，半透明 fill）
 * └────────────┘
 * ```
 *
 * a11y：
 * - 1 / N 数据点：svg 含 `role="img"` + `aria-label`（消费方按需传；省略时用泛文案"趋势"）
 * - 0 数据点：return null（无 DOM 节点 / 无 a11y 替代）；消费方负责外层占位
 */
export interface SparkProps {
  /**
   * 趋势数据点（任意 number 数组；归一化到 height 范围由 Spark 内部完成）
   *
   * 长度规则：
   * - 0 → 不渲染（return null）
   * - 1 → 渲染单点 dot
   * - N ≥ 2 → 正常 polyline / area path
   */
  readonly data: readonly number[]

  /**
   * 线条 / 填充颜色（CSS 变量字符串）
   *
   * 默认 `var(--accent-default)`。reference §5.1.2 4 张 KPI spark 颜色：
   * - 视频总量 → accent
   * - 待审/暂存 → warn (`var(--state-warning-fg)`)
   * - 源可达率 → ok (`var(--state-success-fg)`)
   * - 失效源 → danger (`var(--state-error-fg)`)
   *
   * **禁止硬编码颜色值**（CLAUDE.md / verify:token-references）
   */
  readonly color?: string

  /** 渲染宽度（默认 60，对齐 reference §4.3 / §5.1.2） */
  readonly width?: number

  /** 渲染高度（默认 18） */
  readonly height?: number

  /** 渲染变体（默认 'line'） */
  readonly variant?: SparkVariant

  /**
   * 线条粗细（默认 1.5）
   *
   * 提供 prop 是因为不同消费方场景视觉权重略有差别（KPI 主信号偏轻量；SiteHealth 行级偏紧凑）。
   */
  readonly strokeWidth?: number

  /**
   * a11y 标签（可选；仅 1 / N 数据点路径生效）
   *
   * 默认值"趋势"；消费方传如「7 天视频总量趋势」更具体语义。
   * 0 数据点路径 return null，本字段不被消费（消费方在外层 placeholder 自行做 a11y）
   */
  readonly ariaLabel?: string

  /** 测试钩子 */
  readonly testId?: string
}
