/**
 * admin-access-token.ts — ADR-160 Admin Preview 协议层（D-160-4b 方案 ②）
 *
 * 职责（双重）：
 * 1) admin-preview 协议常量：header / cookie / query 命名集中点
 *    （middleware ↔ video-detail 共享，避免散点 magic string）
 * 2) server-side `getAdminAccessToken(refreshToken)`：透传 refresh_token cookie
 *    调 `${API_BASE}/auth/refresh` 拿短 TTL access_token，in-memory 不持久化，
 *    失败返回 null（fetchVideoMeta 自动降级 public 路径 / Y1 防 ISR cache 污染）
 *
 * 注意：本模块顶层无 server-only 依赖（`next/headers` 等），常量可被 middleware
 *       （Edge Runtime）安全 import；`getAdminAccessToken` 是无状态纯函数 wrapper
 *       （cookie 串作入参），不直接调 `cookies()` API，由调用方在 Server Component
 *       中读 cookie 后传入。
 */

import type { ApiResponse } from '@resovo/types'

// ── ADR-160 协议常量 ──────────────────────────────────────────────
export const HEADER_ADMIN_PREVIEW = 'x-admin-preview'
export const COOKIE_USER_ROLE = 'user_role'
export const COOKIE_REFRESH_TOKEN = 'refresh_token'
export const PREVIEW_QUERY_KEY = 'preview'
export const PREVIEW_QUERY_VALUE = 'admin'

// D-160-1 双因素鉴权：query=admin + cookie role ∈ {admin, moderator}
const PREVIEW_ROLES = new Set(['admin', 'moderator'])

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

/**
 * 判定 user_role cookie 值是否具备 preview 权限。
 * 大小写不敏感 + 空白裁剪；undefined / 非法值 → false。
 */
export function isPreviewRole(role: string | undefined | null): boolean {
  if (!role) return false
  return PREVIEW_ROLES.has(role.trim().toLowerCase())
}

/**
 * server-side 凭据交换：refresh_token cookie → access_token。
 *
 * - 入参为 cookie 原值（由调用方从 `next/headers` cookies() 读取后传入）
 * - 网络失败 / 非 2xx / response body 异常 → 返回 null
 * - `cache: 'no-store'` 避免 Next.js fetch wrapper 缓存凭据响应
 *
 * 调用方典型用法：
 * ```ts
 * const refreshToken = (await cookies()).get(COOKIE_REFRESH_TOKEN)?.value
 * const accessToken = await getAdminAccessToken(refreshToken)
 * if (accessToken) { ... preview 派发 ... }
 * ```
 */
export async function getAdminAccessToken(
  refreshToken: string | undefined | null
): Promise<string | null> {
  if (!refreshToken) return null

  let res: Response | null = null
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: `${COOKIE_REFRESH_TOKEN}=${refreshToken}`,
        'content-type': 'application/json',
      },
      cache: 'no-store',
    })
  } catch {
    return null
  }

  if (!res.ok) return null

  try {
    const body = (await res.json()) as ApiResponse<{ accessToken: string }>
    const token = body.data?.accessToken
    return typeof token === 'string' && token.length > 0 ? token : null
  } catch {
    return null
  }
}
