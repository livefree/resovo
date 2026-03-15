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
