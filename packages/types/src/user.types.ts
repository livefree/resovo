/**
 * user.types.ts — 用户与认证类型
 */

import { z } from 'zod'

// ── 用户角色 ─────────────────────────────────────────────────────

export type UserRole = 'user' | 'moderator' | 'admin'

// 权限工具函数（在需要权限判断的地方直接 import 使用）
export const canAccessAdmin  = (role: UserRole) => role === 'moderator' || role === 'admin'
export const canManageSystem = (role: UserRole) => role === 'admin'
export const canModerate     = (role: UserRole) => role === 'moderator' || role === 'admin'

// ── 用户偏好（ADR-165 ROUTE-LABEL-D / Y-165-3 真源迁移）─────────

/**
 * 自定义主题字段约束（CHG-369-B / 设计稿 §Layer C）
 *
 * ADR-165 Y-165-3 修订：从 apps/web-next/src/lib/route-theme-storage.ts
 * 迁移到此共享层 / web-next 改 import 路径（防双真源）。
 */
export const CUSTOM_THEME_CONSTRAINTS = {
  displayNameMaxChars: 10,
  labelMaxChars: 10,
  labelsMinCount: 1,
  labelsMaxCount: 30,
  deadLabelMaxChars: 10,
} as const

const _C = CUSTOM_THEME_CONSTRAINTS

/** 自定义主题数据（CHG-369-B + ADR-165） */
export const CustomThemeDataSchema = z.object({
  displayName: z.string().trim().min(1).max(_C.displayNameMaxChars),
  labels: z.array(z.string().trim().min(1).max(_C.labelMaxChars))
    .min(_C.labelsMinCount).max(_C.labelsMaxCount),
  deadLabel: z.string().trim().min(1).max(_C.deadLabelMaxChars).optional(),
})

/** 路线主题偏好（ADR-165 D-165-2） */
export const RouteThemePreferenceSchema = z.object({
  // 'jie_qi' | 'nato' | 'numbers' | 'planets' | 'colors' | 'custom'
  themeId: z.string().min(1),
  customTheme: CustomThemeDataSchema.optional(),  // 仅 themeId='custom' 时携带
})

/**
 * 用户偏好（ADR-165 D-165-2 + R-165-4 双 schema 范式）
 *
 * **server 持久化用 passthrough**：未知字段保留（防 Phase 4 演进时旧客户端误删 server 已有数据）
 * **客户端类型层用 strict**：开发期约束（拒绝拼写错误 / 见 UserPreferencesStrictSchema）
 */
export const UserPreferencesSchema = z.object({
  routeTheme: RouteThemePreferenceSchema.optional(),
  // 未来扩字段：playerSettings? / homeLayout? / 等
}).passthrough()

/** 客户端类型层 strict 校验（开发期拒绝未知字段） */
export const UserPreferencesStrictSchema = UserPreferencesSchema.strict()

/**
 * 部分更新 schema（ADR-165 §6 R-165-3 顶层模块 PATCH 语义）：
 * - undefined = 不改该字段
 * - null = 清除该字段（从 server preferences 中删除该顶层 key）
 * - 值 = 设置该字段（完整覆盖该顶层 key 内容）
 */
export const UserPreferencesPatchSchema = z.object({
  routeTheme: RouteThemePreferenceSchema.nullable().optional(),
}).passthrough()

export type CustomThemeData = z.infer<typeof CustomThemeDataSchema>
export type RouteThemePreference = z.infer<typeof RouteThemePreferenceSchema>
export type UserPreferences = z.infer<typeof UserPreferencesSchema>
export type UserPreferencesPatch = z.infer<typeof UserPreferencesPatchSchema>

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
  // ADR-139：admin 变更该用户角色的最后时间戳（ISO 8601）；NULL = 从未被改过
  roleChangedAt?: string | null
  // ADR-140：admin 可编辑的用户展示名（1-50 字符）；NULL 时前端降级到 username
  displayName?: string | null
  // ADR-165：用户偏好（跨设备主题同步等）；登录态从 server 拉 / 未登录态走 localStorage
  preferences?: UserPreferences
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
