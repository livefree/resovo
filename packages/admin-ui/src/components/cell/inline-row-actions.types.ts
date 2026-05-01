/**
 * inline-row-actions.types.ts — InlineRowActions 共享组件 Props 契约（CHG-DESIGN-12 12A）
 *
 * 真源（按优先级）：
 *   1. `docs/designs/backend_design_v2.1/reference.md` §6.1 actions 列「xs btn ×5：编辑 / 前台 / 播放 / 补源 / **上架(primary)**；
 *      hover 时浮现」
 *   2. `docs/designs/backend_design_v2.1/app/screens-3.jsx` 视频库 actions 列实装（行 ~50-58）
 *   3. `docs/designs/backend_design_v2.1/reference.md` §6.0「行内 actions 默认 opacity 0，hover 行后出现」
 *   4. CHG-DESIGN-12 任务卡（SEQ-20260429-02 第 12 卡 · 12A 阶段）
 *
 * 业务语义：
 *   表格行操作按钮组（5 个 xs btn 组）；与 AdminDropdown（"more 菜单"风格）形成对比 —
 *   InlineRowActions 是"全部按钮直接展开"，AdminDropdown 是"汇总菜单"。
 *
 * 设计稿语义（reference §6.0 + screens-3.jsx）：
 *   - 行内 actions 默认 `opacity: 0`；hover 行（`tr:hover`）后 `opacity: 1`（hover 浮现）
 *   - primary action 强调（如视频库"上架"按钮 `btn--primary` accent 配色）
 *   - 每个按钮 xs 尺寸（24px high / radius-sm / 11px font）
 *   - 横排 flex `gap: 3px`（设计稿硬编码）
 *
 * 与 AdminDropdown 关系：
 *   InlineRowActions 与 AdminDropdown 互斥 — 同一表格的同一行 actions 列要么全部 inline 展开（视频库标杆），
 *   要么用 AdminDropdown（如 sources / staging 等次要表格）。reference §10 第 2 条明确「行操作是 inline xs
 *   buttons 还是 dropdown。**设计稿已指定时按设计稿。**」
 *
 * 不变约束：
 *   - 颜色仅消费 packages/design-tokens
 *   - 零图标库依赖（icon 通过 ReactNode slot 注入）
 *   - Edge Runtime 兼容
 */

import type { ReactNode } from 'react'

/**
 * InlineRowAction 单按钮配置
 *
 * 类型 readonly + ReactNode 兼容图标 / 文本 / 复合内容。
 */
export interface InlineRowAction {
  /** 唯一 key（React list 渲染 + e2e 测试钩子 `[data-action-key={key}]`） */
  readonly key: string

  /** 按钮显示内容（ReactNode 兼容图标 + 文本组合，如 `<span><Edit /> 编辑</span>`） */
  readonly children: ReactNode

  /**
   * 是否 primary 强调（默认 false）
   *
   * primary=true → btn--primary 视觉（accent 背景 + accent-on-accent 文字 + fontWeight 500）；
   * 用于行级"主操作"如视频库"上架"
   */
  readonly primary?: boolean

  /**
   * 是否 danger 强调（默认 false）
   *
   * danger=true → 文字 danger 色 + hover 时 danger-soft 背景 + danger border；
   * 用于"删除 / 拒绝 / 拦截"类破坏性操作
   *
   * 与 primary 互斥：同时传时 primary 优先（dev warn 提示）。
   */
  readonly danger?: boolean

  /** 是否禁用（loading / 权限不足等） */
  readonly disabled?: boolean

  /** 点击回调；e.stopPropagation 由内部处理（防止冒泡触发行点击） */
  readonly onClick: () => void

  /**
   * a11y title / tooltip 文本（hover 后显示）
   *
   * 仅有 icon 无文字按钮时**必填**（屏幕阅读器需要语义；如 `<Edit />` button 必须 title="编辑"）。
   */
  readonly title?: string
}

/**
 * InlineRowActions Props
 *
 * 渲染：横排 flex `gap: 3px`；hover 行浮现（消费方在父表格 `tr:hover` 设置 opacity 切换）。
 *
 * 设计稿硬约束：
 * - actions 顺序由 actions 数组决定（reference §6.1 视频库典型顺序：编辑 / 前台 / 播放 / 补源 / 上架）
 * - primary action 通常是数组**最后一项**（视觉上靠右强调）；本组件不强制顺序，由消费方决定
 *
 * a11y：
 * - 整体 `role="group"` + 可选 ariaLabel（如 "行操作"）
 * - 每个按钮 `type="button"`（防 form submit 误触发）+ 独立 a11y（title / disabled）
 *
 * 与 AdminDropdown 选择规则：
 * - 视频库标杆 / 行操作 ≤ 5 个 → 用 InlineRowActions
 * - 行操作 > 5 个 / 次要表格 → 用 AdminDropdown
 */
export interface InlineRowActionsProps {
  /** 操作按钮列表（顺序即渲染顺序） */
  readonly actions: readonly InlineRowAction[]

  /**
   * 是否始终显示（默认 false → hover 行浮现）
   *
   * `alwaysVisible: true` → 不依赖父表格 hover 切换 opacity，永远 `opacity: 1`；
   * 用于非表格场景（如 Drawer header actions）或用户偏好「不要 hover」。
   */
  readonly alwaysVisible?: boolean

  /** a11y aria-label（默认 "行操作"） */
  readonly ariaLabel?: string

  /** 测试钩子（默认渲染 `data-row-actions`） */
  readonly testId?: string
}
