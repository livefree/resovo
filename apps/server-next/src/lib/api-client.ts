/**
 * apiClient — server-next 物理副本（plan §4.5 主通道）
 *
 * 与 apps/web-next/src/lib/api-client.ts 同构（plan §4.6 ESLint 边界禁止跨 apps import）。
 * 凭 credentials: 'include' 让浏览器自动携带 refresh_token / user_role cookie；
 * access token 短寿命由 API 端续签流程自动处理（cookie 自动刷新机制）。
 *
 * 后续若 server-next 需要主动持有 accessToken（admin 业务调用要求），可在 M-SN-3
 * 起步引入 zustand authStore 副本（沿用 apps/server 模式；ADR-100 zustand 已预批）。
 */

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
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options

  const reqHeaders: Record<string, string> = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...headers,
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  if (response.status === 204) {
    return undefined as T
  }

  const data = await response.json()

  if (!response.ok) {
    const err = data as ApiError
    throw new ApiClientError(
      err.error?.code ?? 'INTERNAL_ERROR',
      err.error?.message ?? '请求失败，请稍后重试',
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
