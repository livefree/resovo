/**
 * feedback/index.ts — admin-ui Feedback 共享组件层（CHG-SN-4-04 D-14 第 2/3/4 件）
 *
 * 落地节奏（按子方案 §4 实装步骤）：
 *   - Step 4：StaffNoteBar 实装 + 单测（本阶段）
 *   - Step 5：LineHealthDrawer 实装 + 单测
 *   - Step 6：RejectModal 实装 + 单测
 */

// ── StaffNoteBar ────────────────────────────────────────────────

export { StaffNoteBar } from './staff-note-bar'
export type { StaffNoteBarProps } from './staff-note-bar.types'

// ── LineHealthDrawer ────────────────────────────────────────────

export { LineHealthDrawer } from './line-health-drawer'
export type {
  LineHealthDrawerProps,
  LineHealthDrawerError,
  LineHealthDrawerPagination,
} from './line-health-drawer.types'

// ── RejectModal ─────────────────────────────────────────────────

export { RejectModal } from './reject-modal'
export type {
  RejectModalProps,
  RejectModalSubmitPayload,
} from './reject-modal.types'
