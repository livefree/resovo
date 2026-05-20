'use client'

/**
 * InviteUserModal.tsx — 邀请用户表单 Modal（CHG-SN-7-MISC-USERS-1）
 *
 * 设计：reference.md §5.10「page head + actions：角色矩阵、邀请用户」
 * 后端邀请端点待 ADR 起草后接入；当前提交调用 onInvite 回调由消费方处理。
 */
import { useState, type FormEvent, type CSSProperties } from 'react'
import {
  Modal,
  AdminButton,
  AdminInput,
  AdminSelect,
  type AdminSelectOption,
} from '@resovo/admin-ui'

// ── 常量 ──────────────────────────────────────────────────────────

const ROLE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'user',      label: '用户' },
  { value: 'moderator', label: '版主' },
]

// ── 样式 ──────────────────────────────────────────────────────────

const BODY_STYLE: CSSProperties = {
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
}

const FIELD_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const HINT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const ERROR_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--state-danger-fg)',
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  padding: '12px 20px',
  borderTop: '1px solid var(--border-subtle)',
  flexShrink: 0,
}

// ── Props ─────────────────────────────────────────────────────────

export interface InviteUserModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onInvite: (email: string, role: 'user' | 'moderator') => Promise<void>
}

// ── 组件 ─────────────────────────────────────────────────────────

export function InviteUserModal({ open, onClose, onInvite }: InviteUserModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string | null>('user')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function validateEmail(value: string): string | null {
    if (!value.trim()) return '邮箱不能为空'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '请输入有效的邮箱地址'
    return null
  }

  function resetForm() {
    setEmail('')
    setRole('user')
    setEmailError(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const err = validateEmail(email)
    if (err) { setEmailError(err); return }

    setSubmitting(true)
    try {
      await onInvite(email.trim(), (role ?? 'user') as 'user' | 'moderator')
      resetForm()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="邀请用户"
      size="sm"
      data-testid="invite-user-modal"
    >
      <form onSubmit={(e) => void handleSubmit(e)} noValidate data-invite-form>
        <div style={BODY_STYLE}>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE} htmlFor="invite-email">邮箱地址</label>
            <AdminInput
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (emailError) setEmailError(validateEmail(e.target.value))
              }}
              placeholder="user@example.com"
              size="sm"
              data-testid="invite-email-input"
              aria-describedby={emailError ? 'invite-email-error' : undefined}
            />
            {emailError ? (
              <span id="invite-email-error" style={ERROR_STYLE} data-testid="invite-email-error">
                {emailError}
              </span>
            ) : null}
          </div>

          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE} htmlFor="invite-role">角色</label>
            <AdminSelect
              options={ROLE_OPTIONS}
              value={role}
              onChange={(v) => setRole(v)}
              placeholder="选择角色"
              size="sm"
              data-testid="invite-role-select"
              aria-label="邀请角色"
            />
            <span style={HINT_STYLE}>管理员角色需通过系统控制台直接分配</span>
          </div>
        </div>

        <div style={FOOTER_STYLE}>
          <AdminButton
            variant="ghost"
            size="sm"
            type="button"
            onClick={handleClose}
            data-testid="invite-cancel-btn"
          >
            取消
          </AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            type="submit"
            loading={submitting}
            data-testid="invite-submit-btn"
          >
            发送邀请
          </AdminButton>
        </div>
      </form>
    </Modal>
  )
}
