/**
 * api-errors.ts — ErrorCode 唯一真源（ADR-110）
 *
 * ERRORS 字典：20 码
 *   通用 7 码：NOT_FOUND / VALIDATION_ERROR / UNAUTHORIZED / FORBIDDEN /
 *             INTERNAL_ERROR / STATE_CONFLICT / INVALID_TRANSITION
 *   业务 6 码（CHG-SN-4-05）：STATE_INVALID / LABEL_UNKNOWN / STAGING_NOT_READY /
 *                             REVIEW_RACE / RATE_LIMITED / SOURCE_PROBE_FAILED
 *   注册冲突 1 码：CONFLICT（用户名/邮箱唯一约束违反，auth 路由）
 *   会话失效 1 码（ADR-139 / CHG-SN-8-FUP-USERS-ROLE-INV-EP）：ROLE_CHANGED（admin 改角色后已发 token 失效）
 *   审计回滚 3 码（ADR-138 / CHG-SN-8-FUP-AUDIT-ROLLBACK-EP）：
 *     AUDIT_ROLLBACK_UNSUPPORTED 422 / AUDIT_ROLLBACK_STALE 409 / AUDIT_ROLLBACK_SCHEMA_DRIFT 422
 *   DataTable 自动过滤 1 码（ADR-150）：COLUMN_NOT_WHITELISTED 403
 *   抽屉 dismiss 1 码（ADR-197 / NTLG-NTF-DISMISS-B1）：ITEM_NOT_DISMISSABLE 422
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

  // ── 审计回滚 3 码（ADR-138 / CHG-SN-8-FUP-AUDIT-ROLLBACK-EP）─────────────
  // actionType 不可回滚 / target_id NULL / before_jsonb NULL / system.audit_rollback 二次回滚
  AUDIT_ROLLBACK_UNSUPPORTED:  { code: 'AUDIT_ROLLBACK_UNSUPPORTED',  message: '此操作类型不支持回滚',                       status: 422 },
  // 当前 DB 值与 audit_log after_jsonb 不一致（已被后续操作覆盖）/ UNIQUE 违反 23505
  AUDIT_ROLLBACK_STALE:        { code: 'AUDIT_ROLLBACK_STALE',        message: '目标数据已被后续操作修改，无法安全回滚',     status: 409 },
  // before_jsonb 字段与当前 schema 白名单交集为空 / 字段已被 migration 删除
  AUDIT_ROLLBACK_SCHEMA_DRIFT: { code: 'AUDIT_ROLLBACK_SCHEMA_DRIFT', message: '审计记录字段与当前 schema 不兼容，无法自动回滚', status: 422 },

  // ── DataTable 列固有自动过滤 1 码（ADR-150 D-150-3 / CHG-SN-9-DT-AUTOFILTER-EP-2）─────
  // 通用 distinct 端点 /admin/_dt/distinct 表名 + 列名联合白名单 lookup miss 触发；
  // 三重 SQL 注入防御之一（zod table enum + col 后置 lookup + drizzle column reference）
  COLUMN_NOT_WHITELISTED: { code: 'COLUMN_NOT_WHITELISTED', message: '表或列名不在自动过滤白名单内', status: 403 },

  // ── 抽屉 dismiss 软移除 1 码（ADR-197 D-197-2/3 / NTLG-NTF-DISMISS-B1）────────
  // POST /admin/notifications/dismiss item_key 命中 upcoming/active 不可移除白名单（瞬时/进行中项）；
  // dismiss-batch 模式逐条 skip 不报错（计入 skipped），仅单条 dismiss 触发本码。
  ITEM_NOT_DISMISSABLE: { code: 'ITEM_NOT_DISMISSABLE', message: '该项不支持移除', status: 422 },
} as const satisfies Record<string, ApiErrorBody>

export type ErrorCode = keyof typeof ERRORS
