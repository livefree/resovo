/**
 * safe-redirect.ts — 净化用户可控 redirect 参数
 *
 * 用途：admin 登录成功后 router.push(callbackUrl) 必须用净化后的内部路径，
 * 避免 open-redirect 漏洞（codex P1 审计）。
 *
 * 规则：
 *   1. 必须是非空字符串
 *   2. 拒绝 ASCII 控制字符（NUL/TAB/CR/LF/DEL 等 \x00–\x1f, \x7f）与反斜杠
 *      （防 \\host 在某些客户端被解释为协议）
 *   3. 必须以单个 `/` 开头（拒绝 `//host` protocol-relative URL）
 *   4. 必须 `/admin` 或以 `/admin/` `/admin?` 前缀（admin 后台路径白名单；
 *      `/login` `/403` 等不在 redirect 白名单内）
 *   5. 协议 URL（`http:` `javascript:` `data:` 等）不可能通过规则 3+4
 *      （它们不以 `/` 开头）
 *
 * 不在白名单的输入一律 fallback `/admin`。
 */

const FALLBACK = '/admin'
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARS = /[\x00-\x1f\x7f\\]/

export function sanitizeAdminRedirect(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0) return FALLBACK
  if (FORBIDDEN_CHARS.test(raw)) return FALLBACK
  if (!raw.startsWith('/') || raw.startsWith('//')) return FALLBACK
  if (raw !== '/admin' && !raw.startsWith('/admin/') && !raw.startsWith('/admin?')) return FALLBACK
  return raw
}
