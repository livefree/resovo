/**
 * UserActions.tsx — 用户管理操作列
 * CHG-26: 封号/解封 ConfirmDialog、角色切换、密码重置（一次性 Modal）
 * CHG-261: 改为 AdminDropdown 触发（2~3 个操作，符合多选项下拉菜单设计规则）
 */

'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { Modal } from '@/components/admin/Modal'
import { AdminDropdown } from '@/components/admin/shared/dropdown/AdminDropdown'

export interface UserRow {
  id: string
  username: string
  email: string
  role: 'user' | 'moderator' | 'admin'
  avatar_url: string | null
  banned_at: string | null
  created_at: string
}

interface UserActionsProps {
  user: UserRow
  onRefresh: () => void
}

export function UserActions({ user, onRefresh }: UserActionsProps) {
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [unbanDialogOpen, setUnbanDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [banLoading, setBanLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [newPassword, setNewPassword] = useState<string | null>(null)
  const [pwModalOpen, setPwModalOpen] = useState(false)

  if (user.role === 'admin') {
    return null
  }

  async function handleBan() {
    setBanLoading(true)
    try {
      await apiClient.patch(`/admin/users/${user.id}/ban`)
      setBanDialogOpen(false)
      onRefresh()
    } catch {
      // error is visible via dialog UI
    } finally {
      setBanLoading(false)
    }
  }

  async function handleUnban() {
    setBanLoading(true)
    try {
      await apiClient.patch(`/admin/users/${user.id}/unban`)
      setUnbanDialogOpen(false)
      onRefresh()
    } catch {
      // error is visible via dialog UI
    } finally {
      setBanLoading(false)
    }
  }

  async function handleDelete() {
    setDeleteLoading(true)
    try {
      await apiClient.delete(`/admin/users/${user.id}`)
      setDeleteDialogOpen(false)
      onRefresh()
    } catch {
      // error is visible via dialog UI
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleRoleChange(newRole: 'user' | 'moderator') {
    try {
      await apiClient.patch(`/admin/users/${user.id}/role`, { role: newRole })
      onRefresh()
    } catch {
      // silent — user stays on same page
    }
  }

  async function handleResetPassword() {
    setResetLoading(true)
    try {
      const res = await apiClient.post<{ data: { newPassword: string } }>(
        `/admin/users/${user.id}/reset-password`
      )
      setNewPassword(res.data.newPassword)
      setPwModalOpen(true)
    } catch {
      // silent — user stays on same page
    } finally {
      setResetLoading(false)
    }
  }

  function handlePwModalClose() {
    setPwModalOpen(false)
    setNewPassword(null)
  }

  const dropdownItems = [
    user.banned_at
      ? { key: 'unban', label: '解封', onClick: () => setUnbanDialogOpen(true) }
      : { key: 'ban', label: '封号', onClick: () => setBanDialogOpen(true) },
    ...(user.role === 'user'
      ? [{ key: 'promote', label: '升为版主', onClick: () => { void handleRoleChange('moderator') } }]
      : []),
    ...(user.role === 'moderator'
      ? [{ key: 'demote', label: '降为用户', onClick: () => { void handleRoleChange('user') } }]
      : []),
    {
      key: 'reset-pw',
      label: resetLoading ? '生成中…' : '重置密码',
      onClick: () => { void handleResetPassword() },
    },
    {
      key: 'delete',
      label: '删除用户',
      onClick: () => setDeleteDialogOpen(true),
      danger: true,
    },
  ]

  return (
    <>
      <AdminDropdown
        data-testid={`user-actions-${user.id}`}
        align="right"
        trigger={
          <button
            type="button"
            className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg2)]"
          >
            操作 ▾
          </button>
        }
        items={dropdownItems}
      />

      <ConfirmDialog
        open={banDialogOpen}
        onClose={() => setBanDialogOpen(false)}
        title="确认封号"
        description={`确定要封禁用户「${user.username}」吗？该用户将无法登录。`}
        confirmText="封号"
        onConfirm={handleBan}
        loading={banLoading}
        danger
      />

      <ConfirmDialog
        open={unbanDialogOpen}
        onClose={() => setUnbanDialogOpen(false)}
        title="确认解封"
        description={`确定要解封用户「${user.username}」吗？`}
        confirmText="解封"
        onConfirm={handleUnban}
        loading={banLoading}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="删除用户"
        description={`确定要删除用户「${user.username}」吗？该用户将无法登录，但数据仍保留在系统中。`}
        confirmText="删除"
        onConfirm={handleDelete}
        loading={deleteLoading}
        danger
      />

      <Modal
        open={pwModalOpen}
        onClose={handlePwModalClose}
        title="密码已重置"
        size="sm"
      >
        <div data-testid="reset-pw-modal-body">
          <p className="mb-3 text-sm text-[var(--muted)]">
            以下为一次性临时密码，关闭后不可再查看。请将密码告知用户，并提醒其登录后立即修改。
          </p>
          <div
            className="rounded-md bg-[var(--bg3)] px-4 py-3 text-center font-mono text-lg tracking-widest text-[var(--accent)]"
            data-testid="reset-pw-value"
          >
            {newPassword}
          </div>
        </div>
      </Modal>
    </>
  )
}
