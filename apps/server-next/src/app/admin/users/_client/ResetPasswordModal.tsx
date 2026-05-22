'use client'

/**
 * ResetPasswordModal.tsx — admin 重置用户密码 2 态 Modal（CHG-SN-8-FUP-USERS-RESET-PWD）
 *
 * 后端：POST /admin/users/:id/reset-password 返新随机 12 位密码（明文一次性）；admin 目标 403
 * 范式：confirm → API → success（显示新密码 + 复制 + 一次性警示）；关闭后不可复看
 */
import { useState, type CSSProperties } from 'react'
import { Modal, AdminButton, useToast } from '@resovo/admin-ui'
import { resetUserPassword } from '@/lib/users/api'

const BODY_STYLE: CSSProperties = {
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
}

const NOTE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  lineHeight: 1.5,
}

const TARGET_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
}

const PWD_BOX_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 12px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--state-warning-bg)',
  border: '1px solid var(--state-warning-border)',
}

const PWD_TEXT_STYLE: CSSProperties = {
  flex: 1,
  fontFamily: 'var(--font-family-mono)',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  letterSpacing: '0.05em',
  userSelect: 'all',
}

const WARN_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--state-warning-fg)',
  lineHeight: 1.5,
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

export interface ResetPasswordModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly user: { readonly id: string; readonly username: string; readonly email: string } | null
}

export function ResetPasswordModal({ open, onClose, user }: ResetPasswordModalProps) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [newPassword, setNewPassword] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function handleClose() {
    setNewPassword(null)
    setErrorMessage(null)
    setSubmitting(false)
    onClose()
  }

  async function handleConfirm() {
    if (!user) return
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const { newPassword: pwd } = await resetUserPassword(user.id)
      setNewPassword(pwd)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '重置失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    if (!newPassword) return
    try {
      await navigator.clipboard.writeText(newPassword)
      toast.push({ title: '新密码已复制', level: 'success' })
    } catch {
      toast.push({ title: '复制失败', description: '请手动选中后复制', level: 'warn' })
    }
  }

  const inSuccessState = newPassword != null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={inSuccessState ? '新密码已生成' : '重置用户密码'}
      size="sm"
      data-testid="reset-pwd-modal"
    >
      <div style={BODY_STYLE}>
        {user ? (
          <div style={TARGET_STYLE} data-testid="reset-pwd-target">
            <div><strong>{user.username}</strong></div>
            <div>{user.email}</div>
          </div>
        ) : null}

        {inSuccessState ? (
          <>
            <div style={PWD_BOX_STYLE} data-testid="reset-pwd-result">
              <span style={PWD_TEXT_STYLE} data-testid="reset-pwd-value">{newPassword}</span>
              <AdminButton
                variant="default"
                size="sm"
                onClick={() => void handleCopy()}
                data-testid="reset-pwd-copy-btn"
              >
                复制
              </AdminButton>
            </div>
            <p style={WARN_STYLE}>
              请立即通过安全渠道告知用户。关闭窗口后此密码不可再次查看；如果遗失，需再次重置。
            </p>
          </>
        ) : (
          <>
            <p style={NOTE_STYLE}>
              将为该用户生成一个 12 位随机密码并立即生效。原密码将失效，用户下次登录需使用新密码。
            </p>
            {errorMessage ? (
              <span style={ERROR_STYLE} data-testid="reset-pwd-error">{errorMessage}</span>
            ) : null}
          </>
        )}
      </div>

      <div style={FOOTER_STYLE}>
        {inSuccessState ? (
          <AdminButton
            variant="primary"
            size="sm"
            onClick={handleClose}
            data-testid="reset-pwd-close-btn"
          >
            完成
          </AdminButton>
        ) : (
          <>
            <AdminButton
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={submitting}
              data-testid="reset-pwd-cancel-btn"
            >
              取消
            </AdminButton>
            <AdminButton
              variant="danger"
              size="sm"
              loading={submitting}
              disabled={!user}
              onClick={() => void handleConfirm()}
              data-testid="reset-pwd-confirm-btn"
            >
              确认重置
            </AdminButton>
          </>
        )}
      </div>
    </Modal>
  )
}
