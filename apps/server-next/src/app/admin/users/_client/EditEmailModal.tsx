'use client'

/**
 * EditEmailModal.tsx — admin 改用户邮箱 Modal（CHG-SN-8-FUP-USERS-EDIT-EP / ADR-140）
 *
 * 后端：PATCH /admin/users/:id/email
 *   - 409 CONFLICT 邮箱已被其他用户注册
 *   - 403 不能修改 admin 账号邮箱
 *   - 422 邮箱格式无效
 */
import { useState, useEffect, type FormEvent, type CSSProperties } from 'react'
import { Modal, AdminButton, AdminInput, useToast } from '@resovo/admin-ui'
import { updateUserEmail } from '@/lib/users/api'
import { ApiClientError } from '@/lib/api-client'

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

export interface EditEmailModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly user: { readonly id: string; readonly username: string; readonly email: string } | null
  readonly onSuccess?: () => void
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function EditEmailModal({ open, onClose, user, onSuccess }: EditEmailModalProps) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 打开时初始化为当前邮箱；关闭时清空
  useEffect(() => {
    if (open && user) {
      setEmail(user.email)
      setError(null)
    } else if (!open) {
      setEmail('')
      setError(null)
    }
  }, [open, user])

  function handleClose() {
    if (submitting) return
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const trimmed = email.trim()
    if (!isValidEmail(trimmed)) {
      setError('请输入有效的邮箱地址')
      return
    }
    if (trimmed === user.email) {
      // 同邮箱幂等 — 后端也支持，但前端短路避免无意义请求
      onClose()
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await updateUserEmail(user.id, trimmed)
      toast.push({ title: '邮箱已更新', description: `${user.username}: ${trimmed}`, level: 'success' })
      onSuccess?.()
      onClose()
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'CONFLICT') {
        setError('该邮箱已被其他用户注册')
      } else if (err instanceof ApiClientError && err.code === 'FORBIDDEN') {
        setError('不能修改 admin 账号的邮箱')
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('更新失败，请稍后重试')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="修改用户邮箱"
      size="sm"
      data-testid="edit-email-modal"
    >
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div style={BODY_STYLE}>
          {user ? (
            <div style={HINT_STYLE} data-testid="edit-email-target">
              <strong>{user.username}</strong>（当前：{user.email}）
            </div>
          ) : null}

          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE} htmlFor="edit-email-input">新邮箱地址</label>
            <AdminInput
              id="edit-email-input"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError(null)
              }}
              placeholder="user@example.com"
              size="sm"
              data-testid="edit-email-input"
              aria-describedby={error ? 'edit-email-error' : undefined}
            />
            {error ? (
              <span id="edit-email-error" style={ERROR_STYLE} data-testid="edit-email-error">
                {error}
              </span>
            ) : null}
          </div>
        </div>

        <div style={FOOTER_STYLE}>
          <AdminButton
            variant="ghost"
            size="sm"
            type="button"
            onClick={handleClose}
            disabled={submitting}
            data-testid="edit-email-cancel-btn"
          >
            取消
          </AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            type="submit"
            loading={submitting}
            data-testid="edit-email-submit-btn"
          >
            保存
          </AdminButton>
        </div>
      </form>
    </Modal>
  )
}
