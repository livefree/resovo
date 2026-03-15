/**
 * AdminUserList.tsx — 用户管理列表
 * ADMIN-04: 搜索、封号/解封/角色切换（admin only）
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'

interface UserRow {
  id: string
  username: string
  email: string
  role: 'user' | 'moderator' | 'admin'
  banned_at: string | null
  created_at: string
}

export function AdminUserList() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const limit = 20

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search) params.set('q', search)
      if (roleFilter) params.set('role', roleFilter)
      const res = await apiClient.get<{ data: UserRow[]; total: number }>(
        `/admin/users?${params}`
      )
      setUsers(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function handleBan(id: string) {
    if (!confirm('确认封禁该用户？')) return
    try {
      await apiClient.patch(`/admin/users/${id}/ban`)
      fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  async function handleUnban(id: string) {
    try {
      await apiClient.patch(`/admin/users/${id}/unban`)
      fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  async function handleRoleChange(id: string, newRole: 'user' | 'moderator') {
    if (!confirm(`确认将该用户角色修改为 ${newRole}？`)) return
    try {
      await apiClient.patch(`/admin/users/${id}/role`, { role: newRole })
      fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div data-testid="admin-user-list">
      {/* ── 搜索栏 ─────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="搜索用户名或邮箱…"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value) }}
          className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          data-testid="admin-users-search"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setPage(1); setRoleFilter(e.target.value) }}
          className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          data-testid="admin-users-role-filter"
        >
          <option value="">全部角色</option>
          <option value="user">普通用户</option>
          <option value="moderator">版主</option>
          <option value="admin">管理员</option>
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg2)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">用户名</th>
              <th className="px-4 py-3 text-left">邮箱</th>
              <th className="px-4 py-3 text-left">角色</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">注册时间</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--subtle)]">
            {loading && (
              <tr><td colSpan={6} className="py-8 text-center text-[var(--muted)]">加载中…</td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-[var(--muted)]">暂无数据</td></tr>
            )}
            {!loading && users.map((user) => (
              <tr key={user.id} className="bg-[var(--bg)] hover:bg-[var(--bg2)]" data-testid={`admin-user-row-${user.id}`}>
                <td className="px-4 py-3 font-medium text-[var(--text)]">{user.username}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    user.role === 'admin'
                      ? 'bg-purple-900/30 text-purple-400'
                      : user.role === 'moderator'
                        ? 'bg-blue-900/30 text-blue-400'
                        : 'bg-[var(--bg3)] text-[var(--muted)]'
                  }`}>
                    {user.role === 'admin' ? '管理员' : user.role === 'moderator' ? '版主' : '用户'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {user.banned_at ? (
                    <span className="text-xs text-red-400">已封禁</span>
                  ) : (
                    <span className="text-xs text-green-400">正常</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--muted)] text-xs">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {user.role !== 'admin' && (
                    <div className="flex flex-wrap gap-1">
                      {user.banned_at ? (
                        <button
                          onClick={() => handleUnban(user.id)}
                          className="rounded px-2 py-0.5 text-xs bg-green-900/30 text-green-400 hover:bg-green-900/60"
                          data-testid={`admin-user-unban-${user.id}`}
                        >
                          解封
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBan(user.id)}
                          className="rounded px-2 py-0.5 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60"
                          data-testid={`admin-user-ban-${user.id}`}
                        >
                          封号
                        </button>
                      )}
                      {user.role === 'user' && (
                        <button
                          onClick={() => handleRoleChange(user.id, 'moderator')}
                          className="rounded px-2 py-0.5 text-xs bg-blue-900/30 text-blue-400 hover:bg-blue-900/60"
                          data-testid={`admin-user-promote-${user.id}`}
                        >
                          升为版主
                        </button>
                      )}
                      {user.role === 'moderator' && (
                        <button
                          onClick={() => handleRoleChange(user.id, 'user')}
                          className="rounded px-2 py-0.5 text-xs bg-[var(--bg3)] text-[var(--muted)] hover:text-[var(--text)]"
                          data-testid={`admin-user-demote-${user.id}`}
                        >
                          降为用户
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
          <span>共 {total} 条</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded px-3 py-1 hover:bg-[var(--bg2)] disabled:opacity-40">上一页</button>
            <span className="px-2 py-1">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded px-3 py-1 hover:bg-[var(--bg2)] disabled:opacity-40">下一页</button>
          </div>
        </div>
      )}
    </div>
  )
}
