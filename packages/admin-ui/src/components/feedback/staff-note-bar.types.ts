/**
 * staff-note-bar.types.ts — StaffNoteBar 共享组件 Props 契约（CHG-SN-4-04 D-14 下沉清单第 4 件）
 *
 * 真源（按优先级）：
 *   1. M-SN-4 plan v1.4 §5.0 / §5.1 staff_note 信息条 — DecisionCard + LinesPanel 复用 ≥ 2 处
 *   2. 子方案 `docs/designs/backend_design_v2.1/M-SN-4-04-admin-ui-shared-components-plan_20260502.md` §2.4
 *   3. plan v1.4 §3.1 PATCH `/admin/moderation/:id/staff-note` 端点契约 StaffNoteBody
 *   4. Migration 055 `videos.staff_note` TEXT NULL（CHG-SN-4-03 已落地）
 *
 * 业务语义：
 *   amber 色信息条；展示 / 编辑视频 staff_note。两态：
 *   - display：纯展示 + 编辑入口（点击 onEdit 进入编辑态）
 *   - edit：textarea + 保存 / 取消（onSubmit 提交，传 null 清空）
 *
 * 颜色约束：
 *   amber 系颜色优先复用 design-tokens 既有 `--admin-status-warning-*` 系；如缺则在
 *   `packages/design-tokens/src/admin-layout/surfaces.ts` 追加 `--admin-staff-note-{bg,fg,border}`
 *   （不在本卡范围；优先复用以避免引入新 token follow-up）。
 *
 * 不变约束（packages/admin-ui v1）：
 *   - 颜色仅消费 packages/design-tokens（CSS 变量；零硬编码 hex）
 *   - 零图标库依赖（如需"编辑"/"保存"图标由消费方注入 ReactNode；本契约不暴露图标 prop）
 *   - Edge Runtime 兼容
 *   - 不下沉 i18n（文案 slot 由消费方注入）
 *
 * 渲染语义：
 *   - `note` 为 null / undefined / 空串 → 不渲染（return null；消费方不需自行 wrap if）
 *   - `editing=true` 必须由消费方驱动（受控编辑态；onEdit 信号由消费方接收后翻转 editing）
 *
 * 提交语义（contract minimization）：
 *   `onSubmit` 返回 Promise；resolve 后由消费方决定是否退出编辑态（典型实装：成功后翻转
 *   editing=false；失败后保留编辑态 + toast）。本契约不内置 exit-on-resolve 逻辑。
 */

/**
 * StaffNoteBar Props
 */
export interface StaffNoteBarProps {
  /**
   * 当前 note 文本；null / undefined / 空串 → 不渲染（return null）。
   * 消费方不需要在外层条件挂载。
   */
  readonly note: string | null | undefined

  /**
   * 进入编辑态回调；不传 → readonly 模式（仅展示，不渲染编辑入口）。
   * 消费方接收后翻转 editing prop 为 true。
   */
  readonly onEdit?: () => void

  /**
   * 编辑态开关（受控）；为 true 时渲染 textarea + 保存/取消按钮。
   * 仅当 `onEdit` 已传时此 prop 生效。
   */
  readonly editing?: boolean

  /**
   * 编辑提交回调；编辑态生效时必须提供。
   * 传 null 表示清空 note（PATCH body `{ note: null }`，对齐 StaffNoteBody）。
   * resolve 后由消费方决定是否退出编辑态。
   */
  readonly onSubmit?: (note: string | null) => Promise<void>

  /**
   * 退出编辑态（取消）回调；编辑态生效时建议提供。
   * 不传则取消按钮 disable。
   */
  readonly onCancelEdit?: () => void

  /** 提交中（受控；用于 disable 按钮 + spinner） */
  readonly submitting?: boolean

  /** 编辑态空值占位（默认 '输入备注…'）；不下沉 i18n */
  readonly emptyHint?: string

  /** 编辑入口按钮文案（默认 '编辑'）；不下沉 i18n */
  readonly editLabel?: string

  /** 保存按钮文案（默认 '保存'）；不下沉 i18n */
  readonly saveLabel?: string

  /** 取消按钮文案（默认 '取消'）；不下沉 i18n */
  readonly cancelLabel?: string

  /**
   * note 长度上限；默认无上限（DB 列为 TEXT NULL 无 CHECK）；前端建议 ≤ 500 字以匹配 reason 经验值。
   */
  readonly noteMaxLength?: number

  /** 测试钩子 */
  readonly testId?: string
}
