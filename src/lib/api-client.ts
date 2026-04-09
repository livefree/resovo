/**
 * api-client.ts — 前端统一 API 请求入口
 *
 * 职责：
 * 1. 自动在请求头附加 Bearer access token
 * 2. access token 过期（401）时自动刷新，刷新后重试原请求（只重试一次）
 * 3. 统一解析错误响应格式
 * 4. 提供类型安全的泛型请求函数
 *
 * 使用方式：
 *   import { apiClient } from '@/lib/api-client'
 *   const video = await apiClient.get<ApiResponse<Video>>('/videos/aB3kR9x')
 *   const result = await apiClient.post<ApiResponse<List>>('/lists', { title: '...' })
 */

import { useAuthStore } from '@/stores/authStore'
import type { ApiError } from '@/types'

// ── 配置 ─────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

// ── 自定义错误类 ─────────────────────────────────────────────────

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

// ── 核心请求函数 ─────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
  /** 是否跳过认证头（如登录/注册接口） */
  skipAuth?: boolean
  /** 是否为重试请求（内部使用，防止无限循环） */
  _isRetry?: boolean
}

interface RefreshResponse {
  accessToken?: string
  data?: {
    accessToken?: string
  }
}

function getLoginRedirectPath(): string | null {
  if (typeof window === 'undefined') return null

  const { pathname, search } = window.location
  if (pathname.includes('/admin/login')) return null

  const segments = pathname.split('/').filter(Boolean)
  const locale = segments[0] === 'en' || segments[0] === 'zh-CN' ? segments[0] : 'zh-CN'
  const adminPrefix = `/${locale}/admin`
  const isAdminPath = pathname === adminPrefix || pathname.startsWith(`${adminPrefix}/`)
  if (!isAdminPath) return null

  const callbackUrl = `${pathname}${search}`
  return `/${locale}/admin/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
}

function handleUnauthorized(): void {
  useAuthStore.getState().logout()

  const redirectPath = getLoginRedirectPath()
  if (redirectPath && typeof window !== 'undefined') {
    window.location.assign(redirectPath)
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false, _isRetry = false } = options

  // 构建请求头
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  // 附加 access token（从 Zustand store 读取，存内存不存 localStorage）
  if (!skipAuth) {
    const token = useAuthStore.getState().accessToken
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',   // 携带 HttpOnly Cookie（refresh token 用）
  })

  // ── 401 自动刷新逻辑 ─────────────────────────────────────────
  if (response.status === 401 && !_isRetry && !skipAuth) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      // 刷新成功，用新 token 重试原请求一次
      return request<T>(path, { ...options, _isRetry: true })
    } else {
      // 刷新失败，强制登出
      handleUnauthorized()
      throw new ApiClientError('UNAUTHORIZED', '登录已过期，请重新登录', 401)
    }
  }

  // ── 204 No Content ───────────────────────────────────────────
  if (response.status === 204) {
    return undefined as T
  }

  // ── 解析响应 ─────────────────────────────────────────────────
  const data = await response.json()

  if (!response.ok) {
    // 统一错误格式：{ error: { code, message, status } }
    const err = data as ApiError
    if (response.status === 401 && !skipAuth) {
      handleUnauthorized()
    }
    throw new ApiClientError(
      err.error?.code ?? 'INTERNAL_ERROR',
      err.error?.message ?? '请求失败，请稍后重试',
      response.status,
    )
  }

  return data as T
}

// ── Token 刷新 ───────────────────────────────────────────────────

let refreshPromise: Promise<boolean> | null = null

async function tryRefreshToken(): Promise<boolean> {
  // 防止并发请求同时触发多次刷新
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',  // refresh token 在 HttpOnly Cookie 里
      })
      if (!response.ok) return false
      const data = await response.json() as RefreshResponse
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

// ── 公开 API 方法 ────────────────────────────────────────────────

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

  /** 获取弹幕列表（公开，带 sessionStorage 缓存见 useDanmaku） */
  getDanmaku(shortId: string, ep = 1): Promise<{ data: Array<{ time: number; type: 0 | 1 | 2; color: string; text: string }> }> {
    return request(`/videos/${shortId}/danmaku?ep=${ep}`, { method: 'GET', skipAuth: true })
  },

  /** 发送一条弹幕（需登录） */
  postDanmaku(
    shortId: string,
    body: { ep: number; time: number; type: 0 | 1 | 2; color: string; text: string }
  ): Promise<{ data: { time: number; type: 0 | 1 | 2; color: string; text: string } }> {
    return request(`/videos/${shortId}/danmaku`, { method: 'POST', body })
  },

  /** 获取数据看板统计数据（admin only） */
  getAnalytics(): Promise<{ data: import('@/types/contracts/v1/admin').AnalyticsData }> {
    return request('/admin/analytics', { method: 'GET' })
  },

  /** 获取缓存统计（admin only） */
  getCacheStats(): Promise<{ data: import('@/types/contracts/v1/admin').CacheStat[] }> {
    return request('/admin/cache/stats', { method: 'GET' })
  },

  /** 清除指定类型缓存（admin only） */
  clearCache(type: import('@/types/contracts/v1/admin').CacheType): Promise<{ data: { deleted: number } }> {
    return request(`/admin/cache/${type}`, { method: 'DELETE' })
  },

  /** 上传文件（multipart/form-data，不设 Content-Type 让浏览器自动处理 boundary） */
  upload<T>(path: string, formData: FormData, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    const { headers = {}, ...rest } = options ?? {}
    // 不设 Content-Type，fetch 会自动带上正确的 multipart boundary
    const { 'Content-Type': _, ...headersWithoutContentType } = headers
    return request<T>(path, {
      ...rest,
      method: 'POST',
      headers: headersWithoutContentType,
      body: formData as unknown,  // fetch 原生支持 FormData，绕过 JSON.stringify
    })
  },
}

// ── 使用示例（供 AI 参考，生产代码中删除）───────────────────────
//
// 获取视频详情：
//   const { data } = await apiClient.get<ApiResponse<Video>>(`/videos/${shortId}`)
//
// 搜索：
//   const result = await apiClient.get<ApiListResponse<SearchResult>>(
//     `/search?q=${q}&director=${director}`
//   )
//
// 创建播放列表：
//   const { data } = await apiClient.post<ApiResponse<VideoList>>('/lists', { title, type: 'playlist' })
//
// 上传字幕：
//   const form = new FormData()
//   form.append('file', file)
//   form.append('language', 'zh-CN')
//   await apiClient.upload(`/videos/${id}/subtitles`, form)
//
// 无需认证的请求（如登录）：
//   const { data } = await apiClient.post<AuthTokens>('/auth/login', { email, password }, { skipAuth: true })
