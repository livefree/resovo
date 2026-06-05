'use client'

/**
 * DeleteModuleModal.tsx — 运营位模块删除确认 Modal（CHG-HOME-UX-04-B）
 *
 * 取代 window.confirm（一致性收编：server-next 既有 Modal 确认范式，
 * 先例 SwitchDomainModal / ResetPasswordModal）。
 * DELETE 为硬删除不可恢复（ADR-104），danger 语义明示。
 */

import { useState, type CSSProperties } from 'react'
import { Modal, AdminButton } from '@resovo/admin-ui'
import type { HomeModule } from '@/lib/home-modules/types'

const BODY_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
  lineHeight: 1.6,
}

const TARGET_STYLE: CSSProperties = {
  margin: '10px 0',
  padding: '8px 12px',
  background: 'var(--bg-surface-sunken)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const WARN_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--state-error-fg)',
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  marginTop: '16px',
}

export interface DeleteModuleModalProps {
  readonly module: HomeModule | null
  readonly onClose: () => void
  /** 确认删除；resolve 后由父级关闭 Modal 并移除列表行 */
  readonly onConfirm: (id: string) => Promise<void>
}

export function DeleteModuleModal({ module, onClose, onConfirm }: DeleteModuleModalProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    if (!module) return
    setDeleting(true)
    try {
      await onConfirm(module.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      open={module !== null}
      onClose={onClose}
      title="删除运营位模块"
      size="sm"
      data-testid="home-module-delete-modal"
    >
      <div style={BODY_STYLE}>
        确认删除该运营位模块？
        {module && (
          <div style={TARGET_STYLE} data-testid="home-module-delete-target">
            {module.title['zh-CN'] || module.title['en'] || module.contentRefId}
          </div>
        )}
        <span style={WARN_STYLE}>硬删除不可恢复；运营下线请改用「隐藏」。</span>
      </div>
      <div style={FOOTER_STYLE}>
        <AdminButton variant="ghost" size="md" onClick={onClose} disabled={deleting}>
          取消
        </AdminButton>
        <AdminButton
          variant="danger"
          size="md"
          loading={deleting}
          onClick={() => void handleConfirm()}
          data-testid="home-module-delete-confirm"
        >
          删除
        </AdminButton>
      </div>
    </Modal>
  )
}
