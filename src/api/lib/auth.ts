/**
 * auth.ts — JWT 工具函数
 * Access Token: 15 分钟，存前端内存
 * Refresh Token: 7 天，通过 HttpOnly Cookie 传递
 * 黑名单 key: blacklist:rt:<token_hash>（ADR-003）
 */

import jwt from 'jsonwebtoken'
import crypto from 'crypto'

import type { UserRole } from '@/types'

// ── Token TTL 常量 ───────────────────────────────────────────────

export const ACCESS_TOKEN_EXPIRES_IN = '15m'
export const REFRESH_TOKEN_EXPIRES_IN = '7d'
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60 // 604800 秒

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

export function signAccessToken(payload: { userId: string; role: UserRole }): string {
  return jwt.sign(
    { userId: payload.userId, role: payload.role, type: 'access' },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
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
