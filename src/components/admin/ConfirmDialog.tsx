/**
 * ConfirmDialog.tsx — 二次确认对话框（Admin 基础组件库）
 * CHG-24: 基于 Modal，用于删除/封号等危险操作
 */

'use client'

import { Modal } from './Modal'

// ── 类型 ──────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  loading?: boolean
  /** 危险操作（红色确认按钮） */
  danger?: boolean
}

// ── Component ─────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  loading = false,
  danger = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p
        className="text-sm mb-6"
        style={{ color: 'var(--muted)' }}
        data-testid="confirm-dialog-description"
      >
        {description}
      </p>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: 'var(--bg3)', color: 'var(--text)' }}
          data-testid="confirm-dialog-cancel"
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={
            danger
              ? { background: '#ef4444', color: '#fff' }
              : { background: 'var(--accent, #e8b84b)', color: '#000' }
          }
          data-testid="confirm-dialog-confirm"
        >
          {loading ? '处理中…' : confirmText}
        </button>
      </div>
    </Modal>
  )
}
