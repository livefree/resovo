/**
 * episode-url.ts — 播放页选集 ↔ URL `?ep=` 同步纯函数（BUGFIX-WATCH-EP-URL）
 *
 * 播放页切换选集需把当前集号写回 URL：① 地址栏即时反映当前集 ② 刷新后按 URL 恢复集号。
 * 写入用 history.replaceState（不入历史栈、不触发 Next 软导航/服务端重取），
 * URL 构造逻辑抽纯函数便于单测；副作用调用在 PlayerShell 内（portalMode/SSR 守卫）。
 */

/** 解析 URL `?ep=` → 合法集号（≥1 的整数，非法/缺省回退第 1 集） */
export function parseEpisodeParam(value: string | null | undefined): number {
  const ep = Number(value)
  return Number.isFinite(ep) && ep >= 1 ? Math.floor(ep) : 1
}

/**
 * 在既有 query 基础上覆盖 `ep`，返回 `${pathname}?${query}`。
 * pathname 由调用方传入（已含 locale 前缀），search 为既有 query 串（保留 preview 等参数）。
 */
export function buildEpisodeUrl(pathname: string, search: string, episode: number): string {
  const params = new URLSearchParams(search)
  params.set('ep', String(episode))
  return `${pathname}?${params.toString()}`
}
