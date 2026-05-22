'use client'

/**
 * columns.tsx — `/admin/users` 列定义 + 行操作 cell（CHG-SN-5-03）
 *
 * 列结构：username（pinned）/ email / role / status / created_at / actions
 */

import type { CSSProperties } from 'react'
import { AdminButton, type TableColumn } from '@resovo/admin-ui'
import type { UserRow, UserRole } from '@/lib/users/types'
import { UserRolePopover } from './UserRolePopover'

const USERNAME_CELL_STYLE: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0,
}
const USERNAME_TEXT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--fg-default)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const EMAIL_TEXT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

const BADGE_BASE: CSSProperties = {
  display: 'inline-block',
  padding: '1px 7px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-2xs)',
  fontWeight: 500,
  border: '1px solid transparent',
  whiteSpace: 'nowrap',
}

const ROLE_BADGE: Record<UserRole, CSSProperties> = {
  admin: {
    ...BADGE_BASE,
    background: 'var(--state-info-bg)',
    color: 'var(--state-info-fg)',
    borderColor: 'var(--state-info-border)',
  },
  moderator: {
    ...BADGE_BASE,
    background: 'var(--state-warning-bg)',
    color: 'var(--state-warning-fg)',
    borderColor: 'var(--state-warning-border)',
  },
  user: {
    ...BADGE_BASE,
    background: 'var(--bg-surface)',
    color: 'var(--fg-muted)',
    borderColor: 'var(--border-default)',
  },
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: '管理员',
  moderator: '版主',
  user: '用户',
}

const BANNED_BADGE: CSSProperties = {
  ...BADGE_BASE,
  background: 'var(--state-error-bg)',
  color: 'var(--state-error-fg)',
  borderColor: 'var(--state-error-border)',
}

const ACTIVE_BADGE: CSSProperties = {
  ...BADGE_BASE,
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  borderColor: 'var(--state-success-border)',
}

const ACTIONS_CELL_STYLE: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap',
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('zh-CN', { year: '2-digit', month: '2-digit', day: '2-digit' })
}

export interface BuildColumnsOptions {
  readonly onBan: (id: string) => void
  readonly onUnban: (id: string) => void
  readonly onRoleChange: (id: string, role: 'user' | 'moderator') => void
  readonly onResetPassword: (row: UserRow) => void
  readonly pendingId: string | null
}

export function buildUserColumns({
  onBan,
  onUnban,
  onRoleChange,
  onResetPassword,
  pendingId,
}: BuildColumnsOptions): readonly TableColumn<UserRow>[] {
  return [
    {
      id: 'username',
      header: '用户名',
      accessor: (r) => r.username,
      minWidth: 180,
      enableResizing: true,
      enableSorting: true,
      defaultVisible: true,
      pinned: true,
      cell: ({ row }) => (
        <div style={USERNAME_CELL_STYLE}>
          <span style={USERNAME_TEXT_STYLE} title={row.username}>{row.username}</span>
          <span style={EMAIL_TEXT_STYLE} title={row.email}>{row.email}</span>
        </div>
      ),
    },
    {
      id: 'email',
      header: '邮箱',
      accessor: (r) => r.email,
      width: 220, minWidth: 160,
      enableResizing: true,
      enableSorting: true,
      defaultVisible: false,
      cell: ({ row }) => (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
          {row.email}
        </span>
      ),
    },
    {
      id: 'role',
      header: '角色',
      accessor: (r) => r.role,
      width: 100, minWidth: 90,
      enableResizing: true,
      enableSorting: true,
      defaultVisible: true,
      cell: ({ row }) => (
        <span style={ROLE_BADGE[row.role]}>{ROLE_LABEL[row.role]}</span>
      ),
    },
    {
      id: 'status',
      header: '状态',
      accessor: (r) => (r.banned_at ? 'banned' : 'active'),
      width: 90, minWidth: 80,
      enableResizing: true,
      enableSorting: true,
      defaultVisible: true,
      cell: ({ row }) => (
        row.banned_at
          ? <span style={BANNED_BADGE}>已封禁</span>
          : <span style={ACTIVE_BADGE}>正常</span>
      ),
    },
    {
      id: 'created_at',
      header: '注册时间',
      accessor: (r) => r.created_at,
      width: 100, minWidth: 90,
      enableResizing: true,
      enableSorting: true,
      defaultVisible: true,
      cell: ({ row }) => (
        <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)' }}>
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '操作',
      accessor: () => null,
      width: 240, minWidth: 210,
      enableResizing: false,
      enableSorting: false,
      defaultVisible: true,
      overflowVisible: true,
      cell: ({ row }) => {
        const isPending = pendingId === row.id
        const isAdmin = row.role === 'admin'
        return (
          <span style={ACTIONS_CELL_STYLE}>
            {row.banned_at ? (
              <AdminButton
                variant="default"
                size="sm"
                loading={isPending}
                disabled={isAdmin}
                onClick={() => onUnban(row.id)}
                data-testid={`user-unban-${row.id}`}
              >
                解封
              </AdminButton>
            ) : (
              <AdminButton
                variant="danger"
                size="sm"
                loading={isPending}
                disabled={isAdmin}
                onClick={() => onBan(row.id)}
                data-testid={`user-ban-${row.id}`}
              >
                封禁
              </AdminButton>
            )}
            {!isAdmin && (
              <UserRolePopover
                currentRole={row.role as 'user' | 'moderator'}
                pending={isPending}
                onConfirm={(role) => onRoleChange(row.id, role)}
                data-testid={`user-role-popover-${row.id}`}
                trigger={
                  <AdminButton
                    variant="default"
                    size="sm"
                    disabled={isPending || isAdmin}
                    data-testid={`user-role-btn-${row.id}`}
                  >
                    变更角色
                  </AdminButton>
                }
              />
            )}
            <AdminButton
              variant="ghost"
              size="sm"
              disabled={isPending || isAdmin}
              onClick={() => onResetPassword(row)}
              title={isAdmin ? 'admin 账号不可重置密码' : '为该用户生成新随机密码'}
              data-testid={`user-reset-pwd-${row.id}`}
            >
              重置密码
            </AdminButton>
          </span>
        )
      },
    },
  ]
}
