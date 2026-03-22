/**
 * UserActions.tsx — 用户管理操作列
 * CHG-26: 封号/解封 ConfirmDialog、角色切换、密码重置（一次性 Modal）
 */

'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { Modal } from '@/components/admin/Modal'

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
  const [banLoading, setBanLoading] = useState(false)
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
    setNewPassword(null)  // discard password after modal close
  }

  return (
    <>
      <div className="flex flex-wrap gap-1" data-testid={`user-actions-${user.id}`}>
        {user.banned_at ? (
          <button
            onClick={() => setUnbanDialogOpen(true)}
            className="rounded px-2 py-0.5 text-xs bg-green-900/30 text-green-400 hover:bg-green-900/60"
            data-testid={`user-unban-btn-${user.id}`}
          >
            解封
          </button>
        ) : (
          <button
            onClick={() => setBanDialogOpen(true)}
            className="rounded px-2 py-0.5 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60"
            data-testid={`user-ban-btn-${user.id}`}
          >
            封号
          </button>
        )}

        {user.role === 'user' && (
          <button
            onClick={() => handleRoleChange('moderator')}
            className="rounded px-2 py-0.5 text-xs bg-blue-900/30 text-blue-400 hover:bg-blue-900/60"
            data-testid={`user-promote-btn-${user.id}`}
          >
            升为版主
          </button>
        )}
        {user.role === 'moderator' && (
          <button
            onClick={() => handleRoleChange('user')}
            className="rounded px-2 py-0.5 text-xs bg-[var(--bg3)] text-[var(--muted)] hover:text-[var(--text)]"
            data-testid={`user-demote-btn-${user.id}`}
          >
            降为用户
          </button>
        )}

        <button
          onClick={handleResetPassword}
          disabled={resetLoading}
          className="rounded px-2 py-0.5 text-xs bg-[var(--bg3)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
          data-testid={`user-reset-pw-btn-${user.id}`}
        >
          {resetLoading ? '生成中…' : '重置密码'}
        </button>
      </div>

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
          <div className="rounded-md bg-[var(--bg3)] px-4 py-3 text-center font-mono text-lg tracking-widest text-[var(--accent)]" data-testid="reset-pw-value">
            {newPassword}
          </div>
        </div>
      </Modal>
    </>
  )
}
