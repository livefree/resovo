/**
 * admin-preview-query.ts — admin preview query 跨页透传（BUGFIX-PREVIEW-LINK-B）
 *
 * ADR-160 D-160-1 双因素：`?preview=admin` query + user_role cookie。middleware 只在
 * query 存在时注入 `x-admin-preview` 请求头——详情页内跳 /watch 的链接若不带 query，
 * preview 上下文即丢失，未公开视频播放页 404（fetchVideoDetail 走 public 路径）。
 *
 * 本函数在「当前 URL 处于 preview 模式」时给目标 href 追加同款 query；否则原样返回
 * （public 普通访问零行为变化）。query 外泄无内容安全风险（D-160-1：被分享方无
 * cookie → 仍 404），透传不破坏协议。
 *
 * 纯函数 / client·server 双侧安全（协议常量来自 admin-access-token.ts，该模块顶层
 * 无 server-only 依赖）。searchParams 用结构类型，兼容 next/navigation
 * ReadonlyURLSearchParams 与原生 URLSearchParams（单测免 mock）。
 */

import { PREVIEW_QUERY_KEY, PREVIEW_QUERY_VALUE } from './admin-access-token'

export function carryAdminPreview(
  href: string,
  searchParams: { get(name: string): string | null },
): string {
  if (searchParams.get(PREVIEW_QUERY_KEY) !== PREVIEW_QUERY_VALUE) return href
  const sep = href.includes('?') ? '&' : '?'
  return `${href}${sep}${PREVIEW_QUERY_KEY}=${PREVIEW_QUERY_VALUE}`
}
