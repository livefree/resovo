'use client'

/**
 * UserRolePopover.tsx — 角色变更弹层（CHG-SN-5-03）
 *
 * 消费 admin-ui 通用原语：Popover + AdminSelect + AdminButton。
 * 触发：行操作"变更角色"按钮；内容：目标角色下拉 + 确认/取消。
 */

import { useState, type CSSProperties, type ReactElement } from 'react'
import { Popover, AdminSelect, AdminButton, type AdminSelectOption } from '@resovo/admin-ui'

const ROLE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'user', label: '用户' },
  { value: 'moderator', label: '版主' },
]

const PANEL_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  width: '220px',
  padding: '12px',
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '6px',
  marginTop: '2px',
}

interface UserRolePopoverProps {
  readonly trigger: ReactElement
  readonly currentRole: 'user' | 'moderator'
  readonly pending?: boolean
  readonly onConfirm: (role: 'user' | 'moderator') => void
  readonly 'data-testid'?: string
}

export function UserRolePopover({
  trigger,
  currentRole,
  pending,
  onConfirm,
  'data-testid': testId,
}: UserRolePopoverProps) {
  const [open, setOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)

  function close() {
    setOpen(false)
    setSelectedRole(null)
  }

  function handleConfirm() {
    if (pending) return
    const role = (selectedRole ?? currentRole) as 'user' | 'moderator'
    onConfirm(role)
    close()
  }

  const effectiveRole = (selectedRole ?? currentRole) as 'user' | 'moderator'
  const unchanged = effectiveRole === currentRole

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSelectedRole(null)
      }}
      placement="bottom-end"
      trigger={trigger}
      content={
        <div style={PANEL_STYLE} data-testid={testId ?? 'user-role-popover'}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>变更角色</div>
          <AdminSelect
            options={ROLE_OPTIONS}
            value={selectedRole ?? currentRole}
            onChange={(v) => setSelectedRole(v)}
            size="sm"
            data-testid="user-role-select"
          />
          <div style={FOOTER_STYLE}>
            <AdminButton
              variant="default"
              size="sm"
              onClick={close}
              data-testid="user-role-cancel"
            >
              取消
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              loading={pending}
              disabled={unchanged}
              onClick={handleConfirm}
              data-testid="user-role-confirm"
            >
              确认
            </AdminButton>
          </div>
        </div>
      }
    />
  )
}
