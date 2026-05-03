/**
 * decision-card.types.ts — DecisionCard 共享组件 Props 契约（CHG-SN-4-04 D-14 下沉清单第 5 件）
 *
 * 真源（按优先级）：
 *   1. M-SN-4 plan v1.4 §1 决策表 D-14 — DecisionCard 跨应用层下沉**例外**（ADR-106 登记）
 *   2. 子方案 `docs/designs/backend_design_v2.1/M-SN-4-04-admin-ui-shared-components-plan_20260502.md` §2.5
 *   3. 既有源 `apps/server-next/src/app/admin/moderation/_client/DecisionCard.tsx`（本卡上移真源）
 *
 * 跨层下沉例外说明（ADR-106 草案 → 正式）：
 *   CLAUDE.md "3 处规则" + admin 子项目 "首次跨 2 视图复用" 协议下，DecisionCard 当前消费方仅
 *   moderation + VideoEditDrawer = 2 处，仅满足 admin 子项目规则。本期作为**跨应用层下沉例外**
 *   登记，依据：(a) admin 子项目规则较严覆盖该场景；(b) 跨层下沉天然受 Opus 评审约束；(c) 例外
 *   协议在 ADR-106 中登记。
 *
 * 业务语义：
 *   moderation 右栏 / VideoEditDrawer 复用的"决策卡片"——承载视频核心字段 + 双信号 +
 *   staff_note 信息条 + 操作按钮组。**业务概念零泄漏**：操作按钮（approve / reject /
 *   staging_revert / publish）由消费方组合后通过 `actions` slot 注入，本契约只承载视觉与
 *   slot 编排能力。
 *
 * 不变约束（packages/admin-ui v1）：
 *   - 颜色仅消费 packages/design-tokens
 *   - 零图标库依赖（actions slot 中的图标由消费方注入 ReactNode）
 *   - Edge Runtime 兼容
 *
 * 类型边界（contract minimization 原则）：
 *   - `video` 字段仅 Pick `VideoQueueRow` 的展示子集，不接受全量行（避免下沉层因 schema
 *     扩展被动升级）
 *   - 不接受任何业务 handler（如 `onApprove` / `onReject`）；本卡只暴露通用交互回调
 *     （`onStaffNoteEdit`），其余通过 `actions` slot 由消费方实装
 *
 * v1.6 patch（CHG-SN-4-FIX-A · plan v1.6 §1 G2'）：
 *   删除 `onSignalClick` prop —— DecisionCard 不再渲染 BarSignal 信号行；视频整体信号
 *   通过 LinesPanel 头部 + VisChip 表达。probeState/renderState 仍保留，驱动决策建议
 *   banner 三态推算。
 */

import type { ReactNode } from 'react'
import type { DualSignalDisplayState, VideoQueueRow } from '@resovo/types'

/**
 * DecisionCard 接受的 video 字段子集。
 * 严格 Pick 自 VideoQueueRow 的**展示用字段**。
 *
 * 扩展协议（CHG-SN-4-04 arch-reviewer 观察项 → 硬约束）：
 * 实装期 `*.tsx` 内若需消费此 Pick 列表外的字段（如 `coverUrl` / `year` / `country` /
 * `episodeCount`），**必须先回到本契约扩展 Pick 列表**并经 arch-reviewer 复审；禁止在
 * `decision-card.tsx` 内 ad hoc 接收非 Pick 字段或拓宽为 `Partial<VideoQueueRow>`。
 */
export type DecisionCardVideo = Pick<
  VideoQueueRow,
  | 'id'
  | 'title'
  | 'reviewStatus'
  | 'visibilityStatus'
  | 'isPublished'
  | 'staffNote'
  | 'reviewLabelKey'
  | 'sourceCheckStatus'
  | 'doubanStatus'
>

/**
 * DecisionCard Props
 */
export interface DecisionCardProps {
  /** 视频展示字段子集（消费方裁剪传入） */
  readonly video: DecisionCardVideo

  /** 线路聚合双信号 — probe（Level 1） */
  readonly probeState: DualSignalDisplayState

  /** 线路聚合双信号 — render（Level 2） */
  readonly renderState: DualSignalDisplayState

  /**
   * 操作按钮 slot；ReactNode 由消费方组合（含图标注入 + 业务 handler 闭包）。
   * 本契约不暴露任何业务动作 prop（approve / reject / publish / revert 等），消费方通过
   * 此 slot 注入完整按钮组。
   */
  readonly actions?: ReactNode

  /**
   * 顶部 / 头部 slot；可选（消费方按需注入面包屑、关闭按钮、副标题等）。
   */
  readonly header?: ReactNode

  /**
   * staff_note 编辑回调；不传 → readonly 模式（仅显示，不展示编辑按钮）。
   * 本卡仅传递"进入编辑"信号，编辑态 UI 由内部嵌入的 StaffNoteBar 处理。
   */
  readonly onStaffNoteEdit?: () => void

  /** 测试钩子 */
  readonly testId?: string
}
