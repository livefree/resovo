/**
 * dual-signal.types.ts — DualSignal 共享组件 Props 契约（CHG-DESIGN-12 12A）
 *
 * 真源（按优先级）：
 *   1. `docs/designs/backend_design_v2.1/app/icons-data.jsx` `DualSignal` 实装（行 103-126）
 *   2. `docs/designs/backend_design_v2.1/reference.md` §6.1 probe 列「`<DualSignal probe={} render={} />`」
 *   3. `docs/designs/backend_design_v2.1/reference.md` §6.2 探测列 + §6.3 signal 列复用
 *   4. CHG-DESIGN-12 任务卡（SEQ-20260429-02 第 12 卡 · 12A 阶段）
 *
 * 业务语义：
 *   视频"链接探测 (probe)"+ "实际播放 (render)" 两路独立状态信号；垂直堆叠两个 pill
 *   显示「探 + 状态」「播 + 状态」，方便审核同时看清两个独立信号的健康度。
 *
 * 设计稿渲染：
 * ```
 * ┌────────────┐
 * │ ● 探 可用  │  ← probe 行（探测信号）
 * └────────────┘
 * ┌────────────┐
 * │ ● 播 失效  │  ← render 行（播放信号）
 * └────────────┘
 * ```
 *
 * 状态映射（设计稿 icons-data.jsx 行 105-110）：
 *   - `ok`     → 绿点 / "可用"
 *   - `partial`→ 黄点 / "部分"
 *   - `dead`   → 红点 / "失效"（设计稿 jsx 用 `all_dead`，本契约简化为 `dead`）
 *   - `unknown`→ 灰点 / "未测"
 *
 * 与 Pill 关系：
 *   DualSignal **复用** Pill 渲染（每行是一个 Pill 实例 + variant=`probe`/`render`）；
 *   DualSignal 只负责"双信号布局 + 状态映射"，不重新实现 pill 视觉。
 *   PillVariant 中的 `probe` / `render` 变体即为 DualSignal 专属（packages/design-tokens
 *   `--dual-signal-probe` + `--dual-signal-probe-soft` / `--dual-signal-render` + `--dual-signal-render-soft` 已就位）。
 *
 * 不变约束：
 *   - 颜色仅消费 packages/design-tokens
 *   - Edge Runtime 兼容
 */

/**
 * DualSignal 单路状态值
 *
 * 后端真实契约可能用 `'all_dead'`（与设计稿 jsx 一致），本契约简化为 `'dead'`；
 * 消费方按需在派生层映射（如 `apiState === 'all_dead' ? 'dead' : apiState`）。
 *
 * `unknown` 用于尚未探测的视频源（避免渲染空白）。
 */
export type DualSignalState = 'ok' | 'partial' | 'dead' | 'unknown'

/**
 * DualSignal Props
 *
 * 渲染：垂直 column flex（gap 3px / align-items: flex-start），上 probe pill + 下 render pill。
 *
 * a11y：
 * - 整体 `role="group"` + aria-label "探测/播放双信号"
 * - 每个内部 pill 含独立 aria-label（如「链接探测：可用」「实际播放：失效」）；与设计稿 jsx 的 `title` 对齐
 *
 * 设计稿语义（icons-data.jsx 行 113-124）：
 * - 每个 pill `min-width: 62px`（视觉对齐）
 * - "探" / "播" 标签字符 fontWeight 600 + `var(--dual-signal-probe)` / `var(--dual-signal-render)` 染色
 *   （design-tokens 真源；设计稿 components.css 用短别名 `--probe` / `--render`，packages/design-tokens
 *   实际定义为 `--dual-signal-probe` / `--dual-signal-render`，12B 实装直接消费长名）
 * - 状态文案 fontSize / color: `var(--fg-muted)`
 */
export interface DualSignalProps {
  /** 链接探测状态（`pendingReview` 视频未探测时传 `'unknown'`） */
  readonly probe: DualSignalState

  /** 实际播放状态 */
  readonly render: DualSignalState

  /**
   * 每个 pill 的最小宽度（px；默认 62）
   *
   * 设计稿硬编码 62px 用于多行视觉对齐；消费方一般不需调整，仅作扩展点保留。
   */
  readonly minPillWidth?: number

  /** 测试钩子 */
  readonly testId?: string
}
