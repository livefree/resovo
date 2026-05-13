/**
 * users/api.ts — `/admin/users` 视图 API 客户端封装
 *
 * 复用现有 admin 端点（apps/api/src/routes/admin/users.ts），零新端点需求。
 */

import { apiClient } from '@/lib/api-client'
import type { UserListFilter, UserListResult, UserRole } from './types'

export async function listUsers(filter: UserListFilter = {}): Promise<UserListResult> {
  const params = new URLSearchParams()
  if (filter.q)         params.set('q', filter.q)
  if (filter.role)      params.set('role', filter.role)
  if (filter.banned)    params.set('banned', filter.banned)
  if (filter.sortField) params.set('sortField', filter.sortField)
  if (filter.sortDir)   params.set('sortDir', filter.sortDir)
  if (filter.page != null)  params.set('page', String(filter.page))
  if (filter.limit != null) params.set('limit', String(filter.limit))
  return apiClient.get<UserListResult>(`/admin/users?${params}`)
}

export async function banUser(id: string): Promise<void> {
  await apiClient.patch(`/admin/users/${id}/ban`)
}

export async function unbanUser(id: string): Promise<void> {
  await apiClient.patch(`/admin/users/${id}/unban`)
}

export async function updateUserRole(id: string, role: Exclude<UserRole, 'admin'>): Promise<void> {
  await apiClient.patch(`/admin/users/${id}/role`, { role })
}
