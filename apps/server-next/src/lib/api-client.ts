/**
 * apiClient — server-next（ADR-003 / 沿用 apps/server 实现简化版）
 *
 * 职责：
 *   1. 自动注入 Bearer access token（除 skipAuth：登录 / refresh）
 *   2. 401 自动 refresh + retry（仅 1 次防无限循环）
 *   3. 并发 refresh 复用同一 Promise 防多次刷新
 *   4. 401 刷新失败 → 强制 logout + 跳转 /login（保留当前路径作 from）
 *
 * 与 apps/web-next/src/lib/api-client.ts 的差异：
 *   - admin 内调 /admin/* 受保护端点，必须持有 access token；
 *     web-next 公开端点不依赖 token（refresh_token cookie 仅供 /auth/refresh）
 *
 * 与 apps/server/src/lib/api-client.ts 的差异：
 *   - locale-aware 跳转移除（server-next 单语言 zh-CN）
 *   - 跳转目标固定 /login（不含 /admin/login，因 server-next /login 在 admin 外层）
 */

import { useAuthStore } from '@/stores/authStore'
import { sanitizeAdminRedirect } from '@/lib/safe-redirect'
import type { ApiError } from '@resovo/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
  /** 是否跳过认证头（登录 / refresh 接口） */
  skipAuth?: boolean
  /** 是否为重试请求（内部使用，防无限循环） */
  _isRetry?: boolean
}

interface RefreshResponse {
  accessToken?: string
  data?: { accessToken?: string }
}

function getLoginRedirectPath(): string | null {
  if (typeof window === 'undefined') return null
  const { pathname, search } = window.location
  if (pathname === '/login' || pathname === '/403') return null
  if (!pathname.startsWith('/admin')) return null
  const callback = sanitizeAdminRedirect(`${pathname}${search}`)
  return `/login?from=${encodeURIComponent(callback)}`
}

function handleUnauthorized(): void {
  useAuthStore.getState().logout()
  const redirect = getLoginRedirectPath()
  if (redirect && typeof window !== 'undefined') {
    window.location.assign(redirect)
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false, _isRetry = false } = options

  const reqHeaders: Record<string, string> = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...headers,
  }

  if (!skipAuth) {
    const token = useAuthStore.getState().accessToken
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  // 401 自动 refresh + retry
  if (response.status === 401 && !_isRetry && !skipAuth) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      return request<T>(path, { ...options, _isRetry: true })
    }
    handleUnauthorized()
    throw new ApiClientError('UNAUTHORIZED', '登录已过期，请重新登录', 401)
  }

  if (response.status === 204) return undefined as T

  const data = await response.json()

  if (!response.ok) {
    const err = data as ApiError
    if (response.status === 401 && !skipAuth) handleUnauthorized()
    throw new ApiClientError(
      err.error?.code ?? 'INTERNAL_ERROR',
      err.error?.message ?? '请求失败，请稍后重试',
      response.status,
    )
  }

  return data as T
}

let refreshPromise: Promise<boolean> | null = null

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) return false
      const data = (await response.json()) as RefreshResponse
      const accessToken = data.accessToken ?? data.data?.accessToken
      if (!accessToken) return false
      useAuthStore.getState().setAccessToken(accessToken)
      return true
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export const apiClient = {
  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...options, method: 'GET' })
  },
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...options, method: 'POST', body })
  },
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...options, method: 'PUT', body })
  },
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...options, method: 'PATCH', body })
  },
  delete<T = void>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...options, method: 'DELETE' })
  },
}
