/**
 * user.types.ts — 用户与认证类型
 */

// ── 用户角色 ─────────────────────────────────────────────────────

export type UserRole = 'user' | 'moderator' | 'admin'

// 权限工具函数（在需要权限判断的地方直接 import 使用）
export const canAccessAdmin  = (role: UserRole) => role === 'moderator' || role === 'admin'
export const canManageSystem = (role: UserRole) => role === 'admin'
export const canModerate     = (role: UserRole) => role === 'moderator' || role === 'admin'

// ── 用户实体 ─────────────────────────────────────────────────────

export interface User {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  role: UserRole
  locale: string           // BCP 47，如 zh-CN、en、ja
  createdAt: string        // ISO 8601
  bannedAt: string | null  // 封号时间，null 表示正常
}

// ── 认证 ─────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string      // 存内存，15 分钟有效
  // refreshToken 通过 HttpOnly Cookie 传递，不出现在此类型
}

export interface AuthUser extends User {
  // 登录后的当前用户，含 accessToken
  accessToken: string
}

// ── 请求体 ───────────────────────────────────────────────────────

export interface RegisterInput {
  username: string         // 3-20 字符
  email: string
  password: string         // 最少 8 位
  locale?: string          // 默认 en
}

export interface LoginInput {
  email: string
  password: string
}

export interface UpdateUserInput {
  username?: string
  locale?: string
  avatarUrl?: string
}

// ── 观看历史 ─────────────────────────────────────────────────────

export interface WatchHistoryEntry {
  videoId: string
  video: Pick<import('./video.types').Video, 'id' | 'shortId' | 'title' | 'coverUrl' | 'type'>
  episodeNumber: number | null
  progressSeconds: number
  watchedAt: string
}

export interface UpdateProgressInput {
  videoId: string
  episode?: number
  progressSeconds: number
}
