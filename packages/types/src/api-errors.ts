/**
 * api-errors.ts — ErrorCode 唯一真源（ADR-110）
 *
 * ERRORS 字典：15 码
 *   通用 7 码：NOT_FOUND / VALIDATION_ERROR / UNAUTHORIZED / FORBIDDEN /
 *             INTERNAL_ERROR / STATE_CONFLICT / INVALID_TRANSITION
 *   业务 6 码（CHG-SN-4-05）：STATE_INVALID / LABEL_UNKNOWN / STAGING_NOT_READY /
 *                             REVIEW_RACE / RATE_LIMITED / SOURCE_PROBE_FAILED
 *   注册冲突 1 码：CONFLICT（用户名/邮箱唯一约束违反，auth 路由）
 *   会话失效 1 码（ADR-139 / CHG-SN-8-FUP-USERS-ROLE-INV-EP）：ROLE_CHANGED（admin 改角色后已发 token 失效）
 *
 * AppError class 留在 apps/api（class 不可跨 workspace 共享 instanceof）。
 */

export interface ApiErrorBody {
  code: string
  message: string
  status: number
}

export const ERRORS = {
  // ── 通用 7 码 ────────────────────────────────────────────────────────────
  NOT_FOUND:          { code: 'NOT_FOUND',          message: '资源不存在',                         status: 404 },
  VALIDATION_ERROR:   { code: 'VALIDATION_ERROR',   message: '参数错误',                           status: 422 },
  UNAUTHORIZED:       { code: 'UNAUTHORIZED',        message: '未登录',                             status: 401 },
  FORBIDDEN:          { code: 'FORBIDDEN',           message: '无权操作',                           status: 403 },
  INTERNAL_ERROR:     { code: 'INTERNAL_ERROR',      message: '服务器内部错误',                     status: 500 },
  STATE_CONFLICT:     { code: 'STATE_CONFLICT',      message: '状态已被其他操作更新，请刷新后重试', status: 409 },
  INVALID_TRANSITION: { code: 'INVALID_TRANSITION',  message: '非法状态跃迁，请按审核流程操作',     status: 422 },

  // ── 业务 6 码（CHG-SN-4-05）────────────────────────────────────────────
  STATE_INVALID:      { code: 'STATE_INVALID',       message: '当前状态不允许此操作',               status: 409 },
  LABEL_UNKNOWN:      { code: 'LABEL_UNKNOWN',       message: '拒绝标签不存在',                     status: 400 },
  STAGING_NOT_READY:  { code: 'STAGING_NOT_READY',   message: '该视频未通过发布预检',               status: 422 },
  REVIEW_RACE:        { code: 'REVIEW_RACE',         message: '已被其他审核员处理，请刷新',         status: 409 },
  RATE_LIMITED:       { code: 'RATE_LIMITED',        message: '操作过于频繁，请稍候',               status: 429 },
  SOURCE_PROBE_FAILED: { code: 'SOURCE_PROBE_FAILED', message: '探测服务暂不可用',                  status: 502 },

  // ── 注册冲突 1 码（ADR-110 BLOCKER 补入，auth 路由唯一约束违反）──────────
  CONFLICT:           { code: 'CONFLICT',            message: '用户名或邮箱已被注册',               status: 409 },

  // ── 会话失效 1 码（ADR-139 / CHG-SN-8-FUP-USERS-ROLE-INV-EP）─────────────
  // middleware / refresh 检测到 access/refresh token iat < user.role_changed_at 时返回；
  // 前端 interceptor 识别此码后跳过 silent refresh，直接 forced logout + redirect /login?reason=role_changed
  ROLE_CHANGED:       { code: 'ROLE_CHANGED',        message: '您的权限已变更，请重新登录',         status: 401 },
} as const satisfies Record<string, ApiErrorBody>

export type ErrorCode = keyof typeof ERRORS
