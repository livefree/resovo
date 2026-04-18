/**
 * api.types.ts — API 响应通用类型
 * 所有 API 响应都基于这里的泛型包装
 */

// ── 通用响应结构 ─────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
}

export interface ApiListResponse<T> {
  data: T[]
  pagination: Pagination
}

export interface Pagination {
  total: number
  page: number
  limit: number
  hasNext: boolean
}

// ── 错误结构 ─────────────────────────────────────────────────────

export interface ApiError {
  error: {
    code: ErrorCode
    message: string
    status: number
  }
}

export type ErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

// ── 请求通用参数 ─────────────────────────────────────────────────

export interface PaginationParams {
  page?: number
  limit?: number
}

export type SortOrder = 'asc' | 'desc'
