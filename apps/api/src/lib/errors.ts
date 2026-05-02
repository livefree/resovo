/**
 * errors.ts — AppError class + 工具函数
 * ErrorCode 真源已迁移至 packages/types/src/api-errors.ts（ADR-110）。
 * 本文件通过 re-export 保持 apps/api 内调用方零改动。
 */

import { ERRORS, type ApiErrorBody, type ErrorCode } from '@resovo/types'

export { ERRORS, type ApiErrorBody, type ErrorCode }

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
