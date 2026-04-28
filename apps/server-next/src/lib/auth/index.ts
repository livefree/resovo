/**
 * auth — server-next 鉴权层（ADR-003 / ADR-010）
 *
 * UserRole 单一真源：从 @resovo/types 导入；本卡不再本地定义角色枚举
 * （CHG-SN-1-06 reviewer MUST：避免幽灵角色 'editor'，与 packages/types + ADR-010
 * 三级角色体系 user/moderator/admin 严格对齐）。
 *
 * Cookie 名约定（与 apps/api 一致）：
 *   - refresh_token  HttpOnly        rotated 长寿命 token，浏览器自动随请求带
 *   - user_role      非 HttpOnly     供 middleware 读取角色判定（ADR-010）
 *
 * server-next 鉴权策略（ADR-010）：
 *   - /admin/**：要求 refresh_token 存在 + user_role 为 moderator | admin
 *   - admin-only 子路径（/admin/users / /admin/crawler / /admin/analytics）：
 *     要求 user_role === 'admin'（M-SN-2+ 视图卡按需细化，本卡仅做整段拦截）
 *   - /login：未登录可访问；已登录可访问（允许切账户）
 */

import type { UserRole } from '@resovo/types'

export type { UserRole }

export const COOKIE_REFRESH_TOKEN = 'refresh_token'
export const COOKIE_USER_ROLE = 'user_role'

const VALID_ROLES = new Set<UserRole>(['user', 'moderator', 'admin'])

export function parseUserRole(raw: string | undefined): UserRole | null {
  if (raw && VALID_ROLES.has(raw as UserRole)) return raw as UserRole
  return null
}

/**
 * 是否可进入 /admin/**（任何 admin 子路径的最低门槛）
 *   - 必须有 user_role（已登录）
 *   - role === 'moderator' | 'admin'（ADR-010：普通用户拒绝进入后台）
 *
 * 与 @resovo/types `canAccessAdmin(role: UserRole)` 语义对齐，
 * 本函数额外处理 null 情形供 middleware 直接消费 cookie 解析结果。
 */
export function canAccessAdmin(role: UserRole | null): boolean {
  if (role === null) return false
  return role === 'moderator' || role === 'admin'
}
