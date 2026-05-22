'use client'

/**
 * EditProfileModal.tsx — admin 编辑用户资料 Modal（CHG-SN-8-FUP-USERS-EDIT-EP / ADR-140）
 *
 * 后端：PATCH /admin/users/:id/profile
 *   - displayName VARCHAR(50)，null = 清除
 *   - locale BCP 47（en / zh-CN）
 *   - avatarUrl URL，null = 清除
 *   - 至少一个字段必填；至少一项变化才提交
 */
import { useState, useEffect, type FormEvent, type CSSProperties } from 'react'
import { Modal, AdminButton, AdminInput, useToast } from '@resovo/admin-ui'
import { updateUserProfile } from '@/lib/users/api'
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

export interface EditProfileUser {
  readonly id: string
  readonly username: string
  readonly displayName?: string | null
  readonly locale?: string
  readonly avatarUrl?: string | null
}

export interface EditProfileModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly user: EditProfileUser | null
  readonly onSuccess?: () => void
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function EditProfileModal({ open, onClose, user, onSuccess }: EditProfileModalProps) {
  const toast = useToast()
  const [displayName, setDisplayName] = useState('')
  const [locale, setLocale] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && user) {
      setDisplayName(user.displayName ?? '')
      setLocale(user.locale ?? '')
      setAvatarUrl(user.avatarUrl ?? '')
      setError(null)
    } else if (!open) {
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

    // 计算 partial input — 仅含相对初始态有变化的字段；string '' 视为 null（清除）
    const trimmedDisplay = displayName.trim()
    const initialDisplay = user.displayName ?? ''
    const trimmedLocale = locale.trim()
    const initialLocale = user.locale ?? ''
    const trimmedAvatar = avatarUrl.trim()
    const initialAvatar = user.avatarUrl ?? ''

    const input: { displayName?: string | null; locale?: string; avatarUrl?: string | null } = {}
    if (trimmedDisplay !== initialDisplay) {
      input.displayName = trimmedDisplay === '' ? null : trimmedDisplay
    }
    if (trimmedLocale !== initialLocale) {
      if (trimmedLocale !== '') {
        if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(trimmedLocale)) {
          setError('Locale 格式无效，应为 en 或 zh-CN 等 BCP 47')
          return
        }
        input.locale = trimmedLocale
      }
    }
    if (trimmedAvatar !== initialAvatar) {
      if (trimmedAvatar === '') {
        input.avatarUrl = null
      } else if (!isValidUrl(trimmedAvatar)) {
        setError('Avatar URL 无效')
        return
      } else {
        input.avatarUrl = trimmedAvatar
      }
    }

    if (Object.keys(input).length === 0) {
      onClose()
      return
    }

    if (trimmedDisplay !== '' && trimmedDisplay.length > 50) {
      setError('显示名最多 50 字符')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await updateUserProfile(user.id, input)
      toast.push({ title: '资料已更新', description: user.username, level: 'success' })
      onSuccess?.()
      onClose()
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'FORBIDDEN') {
        setError('不能修改 admin 账号的资料')
      } else if (err instanceof ApiClientError && err.code === 'VALIDATION_ERROR') {
        setError(err.message || '参数校验失败')
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
      title="编辑用户资料"
      size="sm"
      data-testid="edit-profile-modal"
    >
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div style={BODY_STYLE}>
          {user ? (
            <div style={HINT_STYLE} data-testid="edit-profile-target">
              <strong>{user.username}</strong>
            </div>
          ) : null}

          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE} htmlFor="edit-profile-display-name">显示名（可清空以恢复用户名）</label>
            <AdminInput
              id="edit-profile-display-name"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); if (error) setError(null) }}
              placeholder="留空 = 清除"
              size="sm"
              data-testid="edit-profile-display-name"
            />
          </div>

          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE} htmlFor="edit-profile-locale">语言（BCP 47）</label>
            <AdminInput
              id="edit-profile-locale"
              value={locale}
              onChange={(e) => { setLocale(e.target.value); if (error) setError(null) }}
              placeholder="en / zh-CN"
              size="sm"
              data-testid="edit-profile-locale"
            />
          </div>

          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE} htmlFor="edit-profile-avatar">头像 URL（留空 = 清除）</label>
            <AdminInput
              id="edit-profile-avatar"
              type="url"
              value={avatarUrl}
              onChange={(e) => { setAvatarUrl(e.target.value); if (error) setError(null) }}
              placeholder="https://example.com/avatar.jpg"
              size="sm"
              data-testid="edit-profile-avatar"
            />
          </div>

          {error ? (
            <span style={ERROR_STYLE} data-testid="edit-profile-error">{error}</span>
          ) : null}
        </div>

        <div style={FOOTER_STYLE}>
          <AdminButton
            variant="ghost"
            size="sm"
            type="button"
            onClick={handleClose}
            disabled={submitting}
            data-testid="edit-profile-cancel-btn"
          >
            取消
          </AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            type="submit"
            loading={submitting}
            data-testid="edit-profile-submit-btn"
          >
            保存
          </AdminButton>
        </div>
      </form>
    </Modal>
  )
}
