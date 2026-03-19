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

export interface AdminUserListFilters {
  q?: string
  role?: UserRole
  banned?: 'true' | 'false'
  page: number
  limit: number
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

  const [rows, countResult] = await Promise.all([
    db.query(
      `SELECT id, username, email, role, avatar_url, banned_at, created_at
       FROM users
       WHERE ${where}
       ORDER BY created_at DESC
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
): Promise<{ id: string; username: string; email: string; role: UserRole; avatar_url: string | null; locale: string; banned_at: string | null; created_at: string } | null> {
  const result = await db.query<{ id: string; username: string; email: string; role: UserRole; avatar_url: string | null; locale: string; banned_at: string | null; created_at: string }>(
    `SELECT id, username, email, role, avatar_url, locale, banned_at, created_at
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
): Promise<{ id: string; role: UserRole } | null> {
  const result = await db.query<{ id: string; role: UserRole }>(
    `UPDATE users SET role = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id, role`,
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
