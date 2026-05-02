/**
 * errors.ts — 统一错误码字典
 * 本文件为 apps/api 错误码的唯一真源；禁止在路由层重复定义。
 *
 * 本期新增 6 码（CHG-SN-4-05）：
 *   STATE_INVALID / LABEL_UNKNOWN / STAGING_NOT_READY / REVIEW_RACE / RATE_LIMITED / SOURCE_PROBE_FAILED
 */

export interface ApiErrorBody {
  code: string
  message: string
  status: number
}

export function makeError(code: string, message: string, status: number): { error: ApiErrorBody } {
  return { error: { code, message, status } }
}

/** 带 code + httpStatus 的域异常，替代 `new Error('STATE_CONFLICT')` 等字符串约定。 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/** 类型安全的 AppError 判断，替代 `err.message === 'STATE_CONFLICT'` 字符串匹配。 */
export function isAppError(err: unknown, code: string): err is AppError {
  return err instanceof AppError && err.code === code
}

// ── 既有通用码 ──────────────────────────────────────────────────────────────

export const ERRORS = {
  NOT_FOUND:          { code: 'NOT_FOUND',          message: '资源不存在',           status: 404 },
  VALIDATION_ERROR:   { code: 'VALIDATION_ERROR',   message: '参数错误',             status: 422 },
  UNAUTHORIZED:       { code: 'UNAUTHORIZED',        message: '未登录',               status: 401 },
  FORBIDDEN:          { code: 'FORBIDDEN',           message: '无权操作',             status: 403 },
  INTERNAL_ERROR:     { code: 'INTERNAL_ERROR',      message: '服务器内部错误',       status: 500 },
  STATE_CONFLICT:     { code: 'STATE_CONFLICT',      message: '状态已被其他操作更新，请刷新后重试', status: 409 },
  INVALID_TRANSITION: { code: 'INVALID_TRANSITION',  message: '非法状态跃迁，请按审核流程操作', status: 422 },

  // ── CHG-SN-4-05 新增 6 码 ────────────────────────────────────────────────
  STATE_INVALID:      { code: 'STATE_INVALID',       message: '当前状态不允许此操作', status: 409 },
  LABEL_UNKNOWN:      { code: 'LABEL_UNKNOWN',       message: '拒绝标签不存在',       status: 400 },
  STAGING_NOT_READY:  { code: 'STAGING_NOT_READY',   message: '该视频未通过发布预检', status: 422 },
  REVIEW_RACE:        { code: 'REVIEW_RACE',         message: '已被其他审核员处理，请刷新', status: 409 },
  RATE_LIMITED:       { code: 'RATE_LIMITED',        message: '操作过于频繁，请稍候', status: 429 },
  SOURCE_PROBE_FAILED: { code: 'SOURCE_PROBE_FAILED', message: '探测服务暂不可用',    status: 502 },
} as const satisfies Record<string, ApiErrorBody>

export type ErrorCode = keyof typeof ERRORS
