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

// ADR-139 D-139-2 + D-139-4：role_changed 强制 logout（不尝试 refresh，避免循环）+
// redirect /login?reason=role_changed；login 页面可选展示"您的权限已变更，请重新登录"提示
function handleRoleChanged(): void {
  useAuthStore.getState().logout()
  if (typeof window !== 'undefined') {
    const { pathname, search } = window.location
    const from = pathname.startsWith('/admin')
      ? `&from=${encodeURIComponent(sanitizeAdminRedirect(`${pathname}${search}`))}`
      : ''
    window.location.assign(`/login?reason=role_changed${from}`)
  }
}

// 401 时尝试从响应 body 提取 code，用于区分 UNAUTHORIZED vs ROLE_CHANGED
async function peekErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.clone().json()) as ApiError
    return body.error?.code
  } catch {
    return undefined
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
    // ADR-139 D-139-2：识别 ROLE_CHANGED 跳过 silent refresh + 直接 forced logout
    const code = await peekErrorCode(response)
    if (code === 'ROLE_CHANGED') {
      handleRoleChanged()
      throw new ApiClientError('ROLE_CHANGED', '您的权限已变更，请重新登录', 401)
    }
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

// ── multipart upload helper（CHG-SN-6-08）─────────────────────────
//
// 原因：JSON `request<T>` 路径强制 Content-Type: application/json + JSON.stringify body；
// 文件上传需 FormData + 浏览器自动设置 Content-Type 带 boundary。
// 复用 BASE_URL + 鉴权 + 401 refresh 流程，仅替换 body 形态。
async function requestMultipart<T>(
  path: string,
  formData: FormData,
  options: { _isRetry?: boolean } = {},
): Promise<T> {
  const { _isRetry = false } = options
  const reqHeaders: Record<string, string> = {}
  const token = useAuthStore.getState().accessToken
  if (token) reqHeaders['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: reqHeaders,
    body: formData,
    credentials: 'include',
  })

  if (response.status === 401 && !_isRetry) {
    // ADR-139 D-139-2：识别 ROLE_CHANGED 跳过 silent refresh + 直接 forced logout
    const code = await peekErrorCode(response)
    if (code === 'ROLE_CHANGED') {
      handleRoleChanged()
      throw new ApiClientError('ROLE_CHANGED', '您的权限已变更，请重新登录', 401)
    }
    const refreshed = await tryRefreshToken()
    if (refreshed) return requestMultipart<T>(path, formData, { _isRetry: true })
    handleUnauthorized()
    throw new ApiClientError('UNAUTHORIZED', '登录已过期，请重新登录', 401)
  }

  if (response.status === 204) return undefined as T

  const data = await response.json()
  if (!response.ok) {
    const err = data as ApiError
    if (response.status === 401) handleUnauthorized()
    throw new ApiClientError(
      err.error?.code ?? 'INTERNAL_ERROR',
      err.error?.message ?? '上传失败',
      response.status,
    )
  }
  return data as T
}

export const apiClient = {
  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...options, method: 'GET' })
  },
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(path, { ...options, method: 'POST', body })
  },
  postMultipart<T>(path: string, formData: FormData): Promise<T> {
    return requestMultipart<T>(path, formData)
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
