/**
 * reject-modal.types.ts — RejectModal 共享组件 Props 契约（CHG-SN-4-04 D-14 下沉清单第 3 件）
 *
 * 真源（按优先级）：
 *   1. M-SN-4 plan v1.4 §5.1 / §5.3 拒绝操作流程 + VideoEditDrawer 拒绝入口（≥ 3 处复用）
 *   2. 子方案 `docs/designs/backend_design_v2.1/M-SN-4-04-admin-ui-shared-components-plan_20260502.md` §2.3
 *   3. plan v1.4 §3.1 POST `/admin/moderation/:id/reject-labeled` 端点契约 RejectLabeledBody
 *   4. `@resovo/types` `ReviewLabel`（CHG-SN-4-03 已就位）
 *
 * 业务语义：
 *   拒绝操作 Modal — 预设标签单选（来自 `review_labels` 表 is_active=true 行，按 displayOrder
 *   排序）+ 可选附言 textarea（≤ 500 字）。复用 admin-ui Modal 原语包壳。
 *
 * 与 Modal 关系：
 *   本组件**包壳**（compose）admin-ui Modal 原语（packages/admin-ui/src/components/overlay/modal.tsx），
 *   继承其 focus trap / Esc 关闭 / a11y 属性；本契约只提供拒绝业务表单内容。
 *
 * 提交语义（contract minimization）：
 *   `onSubmit` 返回 Promise；resolve 后由消费方调用 `onClose()` 关闭 Modal（消费方控制关闭
 *   时机以便处理 race / 错误重置）。本契约不内置 close-on-resolve 逻辑。
 *
 * 不变约束（packages/admin-ui v1）：
 *   - 颜色仅消费 packages/design-tokens
 *   - 零图标库依赖
 *   - Edge Runtime 兼容
 *   - 不下沉 i18n（文案 slot 由消费方注入）
 */

import type { ReviewLabel } from '@resovo/types'

/**
 * RejectModal 提交 payload。
 * 字段命名对齐 plan §3.1 RejectLabeledBody（`labelKey` / `reason`）。
 */
export interface RejectModalSubmitPayload {
  readonly labelKey: string
  readonly reason?: string
}

/**
 * RejectModal Props
 */
export interface RejectModalProps {
  /** Modal 开关（受控） */
  readonly open: boolean

  /** 关闭回调；用户点击取消 / Esc / 遮罩点击触发 */
  readonly onClose: () => void

  /**
   * 标签列表；调用方应已按 displayOrder 排序、按 isActive 过滤、按 appliesTo 筛选 'reject' / 'any'。
   * 本契约不在内部做过滤排序（避免下沉层承担业务规则）。
   */
  readonly labels: readonly ReviewLabel[]

  /**
   * 默认选中的 labelKey；不传则不预选（用户必须主动选择才能提交）。
   * 用于"上次拒绝标签"快捷恢复场景。
   */
  readonly defaultLabelKey?: string

  /**
   * 提交回调；resolve 后由**消费方**调用 onClose 关闭 Modal（保留消费方对 race / error toast 的控制）。
   * 本组件内部不自动关闭；reject 时**不**自动关闭（保留用户已填表单）。
   */
  readonly onSubmit: (payload: RejectModalSubmitPayload) => Promise<void>

  /** 提交中（受控；用于 disable 按钮 + 显示 spinner） */
  readonly submitting?: boolean

  /** Modal 标题（默认 '拒绝该视频'）；不下沉 i18n */
  readonly title?: string

  /** 附言 placeholder（默认 '附加说明（可选，最长 500 字）'）；不下沉 i18n */
  readonly reasonPlaceholder?: string

  /** 提交按钮文案（默认 '确认拒绝'）；不下沉 i18n */
  readonly submitLabel?: string

  /** 取消按钮文案（默认 '取消'）；不下沉 i18n */
  readonly cancelLabel?: string

  /**
   * 附言长度上限；默认 500（plan §3.1 规定）。
   * 暴露为 prop 仅用于测试 / 极端业务调整，生产应保持默认。
   */
  readonly reasonMaxLength?: number

  /** 测试钩子 */
  readonly testId?: string
}
