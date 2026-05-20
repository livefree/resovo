/**
 * users/types.ts — `/admin/users` 视图数据类型契约（M-SN-5 / CHG-SN-5-03）
 *
 * 真源端点：apps/api/src/routes/admin/users.ts
 *   - GET    /admin/users              — 用户列表
 *   - PATCH  /admin/users/:id/ban      — 封号
 *   - PATCH  /admin/users/:id/unban    — 解封
 *   - PATCH  /admin/users/:id/role     — 角色变更（user↔moderator）
 */

export type UserRole = 'user' | 'moderator' | 'admin'

export interface UserRow {
  readonly id: string
  readonly username: string
  readonly email: string
  readonly role: UserRole
  readonly avatar_url: string | null
  readonly banned_at: string | null
  readonly created_at: string
}

export interface UserListResult {
  readonly data: readonly UserRow[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

export interface UserListFilter {
  readonly q?: string
  readonly role?: UserRole
  readonly banned?: 'true' | 'false'
  readonly page?: number
  readonly limit?: number
  readonly sortField?: string
  readonly sortDir?: 'asc' | 'desc'
}

export interface UserStats {
  readonly totalCount: number
  readonly newTodayCount: number
  readonly bannedCount: number
  readonly moderatorCount: number
  readonly generatedAt: string
}
