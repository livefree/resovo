/**
 * auth.ts — JWT 工具函数
 * Access Token: 默认 15 分钟（ACCESS_TOKEN_EXPIRES_IN），运行时可由 caller 通过
 *   signAccessToken(payload, expiresIn) 注入 KV 驱动 TTL（ADR-148 D-148-1）。
 *   实际生产由 UserService.getSessionTimeoutMinutes() 读 system_settings
 *   `session_timeout_minutes` KV（默认 60min / clamp [5, 1440]）。
 * Refresh Token: 30 天，通过 HttpOnly Cookie 传递（CHG-37）
 * 黑名单 key: blacklist:rt:<token_hash>（ADR-003）
 */

import jwt from 'jsonwebtoken'
import crypto from 'crypto'

import type { UserRole } from '@/types'

// ── Token TTL 常量 ───────────────────────────────────────────────

export const ACCESS_TOKEN_EXPIRES_IN = '15m'
export const REFRESH_TOKEN_EXPIRES_IN = '30d' // CHG-37: 7d → 30d
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60 // 2592000 秒

// ── Token Payload 类型 ───────────────────────────────────────────

export interface AccessTokenPayload {
  userId: string
  role: UserRole
  type: 'access'
  iat: number
  exp: number
}

export interface RefreshTokenPayload {
  userId: string
  type: 'refresh'
  iat: number
  exp: number
}

// ── 工具函数 ─────────────────────────────────────────────────────

function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? 'dev-jwt-secret-replace-in-production'
}

/**
 * ADR-148 D-148-1：可选 expiresIn 参数（向后兼容）。
 * caller（UserService 4 处）传 KV 驱动 TTL 字符串（如 '60m'）；不传走默认 '15m'。
 */
export function signAccessToken(
  payload: { userId: string; role: UserRole },
  expiresIn: string = ACCESS_TOKEN_EXPIRES_IN,
): string {
  // jsonwebtoken expiresIn 类型为 `number | StringValue`（ms 字符串模板）；
  // KV 驱动 TTL 模板 `${n}m` 符合 StringValue 子集，运行时安全；显式断言绕过严格类型。
  const signOptions = { expiresIn } as jwt.SignOptions
  return jwt.sign(
    { userId: payload.userId, role: payload.role, type: 'access' },
    getJwtSecret(),
    signOptions,
  )
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, getJwtSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, getJwtSecret())
  if (
    typeof payload !== 'object' ||
    payload === null ||
    (payload as AccessTokenPayload).type !== 'access'
  ) {
    throw new Error('Invalid access token')
  }
  return payload as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, getJwtSecret())
  if (
    typeof payload !== 'object' ||
    payload === null ||
    (payload as RefreshTokenPayload).type !== 'refresh'
  ) {
    throw new Error('Invalid refresh token')
  }
  return payload as RefreshTokenPayload
}

/** SHA-256 哈希 token，用于 Redis 黑名单 key */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** 生成 Redis 黑名单 key（ADR-003: blacklist:rt:<token_hash>） */
export function blacklistKey(token: string): string {
  return `blacklist:rt:${hashToken(token)}`
}
