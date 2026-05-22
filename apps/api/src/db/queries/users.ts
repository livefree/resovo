/**
 * users.ts — 用户表 DB 查询（认证相关）
 * 不直接拼 SQL，全部参数化查询（db-rules.md）
 */

import type { Pool } from 'pg'
import type { User, UserRole } from '@/types'

// ── 内部 DB 行类型（snake_case → camelCase 映射在 mapUser 中完成）

interface DbUserRow {
  id: string
  username: string
  email: string
  password_hash: string
  role: UserRole
  locale: string
  avatar_url: string | null
  banned_at: string | null
  deleted_at: string | null
  created_at: string
  role_changed_at: string | null  // ADR-139
  display_name: string | null  // ADR-140
}

/** 带 passwordHash 的内部用户类型，仅用于认证模块 */
export interface UserWithHash extends User {
  passwordHash: string
}

function mapUser(row: DbUserRow): UserWithHash {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    locale: row.locale,
    avatarUrl: row.avatar_url,
    bannedAt: row.banned_at,
    createdAt: row.created_at,
    roleChangedAt: row.role_changed_at,  // ADR-139
    displayName: row.display_name,  // ADR-140
  }
}

// ── 查询函数 ─────────────────────────────────────────────────────

export async function findUserByEmail(
  db: Pool,
  email: string
): Promise<UserWithHash | null> {
  const result = await db.query<DbUserRow>(
    `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email]
  )
  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function findUserByUsername(
  db: Pool,
  username: string
): Promise<UserWithHash | null> {
  const result = await db.query<DbUserRow>(
    `SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL`,
    [username]
  )
  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function findUserById(db: Pool, id: string): Promise<UserWithHash | null> {
  const result = await db.query<DbUserRow>(
    `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export interface CreateUserInput {
  username: string
  email: string
  passwordHash: string
  locale?: string
}

export async function createUser(db: Pool, input: CreateUserInput): Promise<UserWithHash> {
  const result = await db.query<DbUserRow>(
    `INSERT INTO users (username, email, password_hash, locale)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.username, input.email, input.passwordHash, input.locale ?? 'en']
  )
  return mapUser(result.rows[0])
}

// ── Admin 查询 ────────────────────────────────────────────────────

const USER_SORT_COLUMNS: Record<string, string> = {
  username: 'username',
  email: 'email',
  role: 'role',
  created_at: 'created_at',
  status: 'banned_at',
}

export interface AdminUserListFilters {
  q?: string
  role?: UserRole
  banned?: 'true' | 'false'
  page: number
  limit: number
  sortField?: string
  sortDir?: 'asc' | 'desc'
}

export async function listAdminUsers(
  db: Pool,
  filters: AdminUserListFilters
): Promise<{ rows: unknown[]; total: number }> {
  const conditions = ['deleted_at IS NULL']
  const params: unknown[] = []
  let idx = 1

  if (filters.q) {
    conditions.push(`(username ILIKE $${idx} OR email ILIKE $${idx})`)
    params.push(`%${filters.q}%`)
    idx++
  }
  if (filters.role) {
    conditions.push(`role = $${idx++}`)
    params.push(filters.role)
  }
  if (filters.banned === 'true') {
    conditions.push('banned_at IS NOT NULL')
  } else if (filters.banned === 'false') {
    conditions.push('banned_at IS NULL')
  }

  const where = conditions.join(' AND ')
  const offset = (filters.page - 1) * filters.limit
  const validCol = filters.sortField ? USER_SORT_COLUMNS[filters.sortField] : undefined
  const orderCol = validCol ?? 'created_at'
  const orderDir = (validCol && filters.sortDir === 'asc') ? 'ASC' : 'DESC'

  const [rows, countResult] = await Promise.all([
    db.query(
      `SELECT id, username, email, role, avatar_url, banned_at, created_at, display_name
       FROM users
       WHERE ${where}
       ORDER BY ${orderCol} ${orderDir}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit, offset]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) FROM users WHERE ${where}`,
      params
    ),
  ])

  return {
    rows: rows.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}

export async function findAdminUserById(
  db: Pool,
  id: string
): Promise<{ id: string; username: string; email: string; role: UserRole; avatar_url: string | null; locale: string; banned_at: string | null; created_at: string; display_name: string | null } | null> {
  // ADR-140：返回 display_name 字段供前端展示
  const result = await db.query<{ id: string; username: string; email: string; role: UserRole; avatar_url: string | null; locale: string; banned_at: string | null; created_at: string; display_name: string | null }>(
    `SELECT id, username, email, role, avatar_url, locale, banned_at, created_at, display_name
     FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  return result.rows[0] ?? null
}

export async function banUser(
  db: Pool,
  id: string
): Promise<{ id: string; banned_at: string } | null> {
  const result = await db.query<{ id: string; banned_at: string }>(
    `UPDATE users SET banned_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id, banned_at`,
    [id]
  )
  return result.rows[0] ?? null
}

export async function unbanUser(
  db: Pool,
  id: string
): Promise<{ id: string; banned_at: null } | null> {
  const result = await db.query<{ id: string; banned_at: null }>(
    `UPDATE users SET banned_at = NULL WHERE id = $1 AND deleted_at IS NULL RETURNING id, banned_at`,
    [id]
  )
  return result.rows[0] ?? null
}

export async function updateUserRole(
  db: Pool,
  id: string,
  role: 'user' | 'moderator'
): Promise<{ id: string; role: UserRole; role_changed_at: string } | null> {
  // ADR-139 D-139-5：同步更新 role_changed_at 以触发 middleware 校验
  const result = await db.query<{ id: string; role: UserRole; role_changed_at: string }>(
    `UPDATE users SET role = $1, role_changed_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING id, role, role_changed_at`,
    [role, id]
  )
  return result.rows[0] ?? null
}

export async function resetUserPassword(
  db: Pool,
  id: string,
  newPasswordHash: string
): Promise<{ id: string } | null> {
  const result = await db.query<{ id: string }>(
    `UPDATE users SET password_hash = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id`,
    [newPasswordHash, id]
  )
  return result.rows[0] ?? null
}

// ── ADR-140: admin 改邮箱 + 编辑资料 ─────────────────────────────────────

// 检查邮箱是否已被其他用户使用（updateUserEmail Service 层先验，DB UNIQUE 保底）
export async function findUserByEmailExcludingId(
  db: Pool,
  email: string,
  excludeId: string,
): Promise<{ id: string } | null> {
  const result = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 AND id != $2 AND deleted_at IS NULL LIMIT 1`,
    [email, excludeId],
  )
  return result.rows[0] ?? null
}

export async function updateUserEmail(
  db: Pool,
  id: string,
  email: string,
): Promise<{ id: string; email: string } | null> {
  const result = await db.query<{ id: string; email: string }>(
    `UPDATE users SET email = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id, email`,
    [email, id],
  )
  return result.rows[0] ?? null
}

export interface UpdateUserProfileInput {
  displayName?: string | null  // undefined = 不修改；null = 清除；string = 设置
  locale?: string
  avatarUrl?: string | null
}

export async function updateUserProfile(
  db: Pool,
  id: string,
  input: UpdateUserProfileInput,
): Promise<{ id: string; display_name: string | null; locale: string; avatar_url: string | null } | null> {
  // ADR-140 D-140-3 + §5：动态构造 SET 列表，仅更新显式传入的字段（undefined 跳过；null 显式设为 NULL）
  const sets: string[] = []
  const params: unknown[] = []
  let idx = 1
  if (input.displayName !== undefined) {
    sets.push(`display_name = $${idx++}`)
    params.push(input.displayName)
  }
  if (input.locale !== undefined) {
    sets.push(`locale = $${idx++}`)
    params.push(input.locale)
  }
  if (input.avatarUrl !== undefined) {
    sets.push(`avatar_url = $${idx++}`)
    params.push(input.avatarUrl)
  }
  if (sets.length === 0) return null  // 调用方应已校验，防御性返回
  params.push(id)
  const result = await db.query<{ id: string; display_name: string | null; locale: string; avatar_url: string | null }>(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING id, display_name, locale, avatar_url`,
    params,
  )
  return result.rows[0] ?? null
}

// ── Stats（ADR-136）────────────────────────────────────────────────

export interface UserStatsRow {
  total_count: string
  new_today_count: string
  banned_count: string
  moderator_count: string
}

export async function statsAdminUsers(db: Pool): Promise<UserStatsRow> {
  const result = await db.query<UserStatsRow>(
    `SELECT
       COUNT(*) FILTER (WHERE deleted_at IS NULL)                                              AS total_count,
       COUNT(*) FILTER (WHERE deleted_at IS NULL AND created_at >= date_trunc('day', NOW()))  AS new_today_count,
       COUNT(*) FILTER (WHERE deleted_at IS NULL AND banned_at IS NOT NULL)                   AS banned_count,
       COUNT(*) FILTER (WHERE deleted_at IS NULL AND role = 'moderator')                      AS moderator_count
     FROM users`
  )
  return result.rows[0]!
}

// UX-07: 软删除用户（设置 deleted_at，数据保留）
export async function softDeleteUser(
  db: Pool,
  id: string
): Promise<boolean> {
  const result = await db.query(
    `UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL AND role != 'admin' RETURNING id`,
    [id]
  )
  return (result.rowCount ?? 0) > 0
}
