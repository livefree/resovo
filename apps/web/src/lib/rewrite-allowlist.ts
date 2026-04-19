/**
 * Resovo 重写期路由切分 ALLOWLIST — ADR-035，单一真源
 *
 * 命中条目的请求将由 apps/web middleware 透明 rewrite 到 apps/web-next。
 * 未命中条目继续由 apps/web 处理。
 *
 * 修改本文件必须：
 *   1) 绑定里程碑任务（M2/M3/M4/M5/M6）
 *   2) 对应路由在 apps/web-next 中已实现并通过完整 CI
 *   3) PR 中同步更新 changelog.md 与 docs/decisions.md ADR-035 patches
 */

export type RewriteMatchMode = 'exact' | 'prefix'

export interface RewriteRule {
  /** 里程碑来源，用于审计 */
  milestone: 'RW-SETUP' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6'
  /** 业务域标签 */
  domain: 'scaffold' | 'home' | 'player' | 'auth' | 'search' | 'admin' | 'misc'
  /** 规范化路径（以 `/` 开头，不含 locale 前缀） */
  path: string
  mode: RewriteMatchMode
  /** 是否兼容 locale 前缀变体（默认 true） */
  localeAware?: boolean
  /** false 时该规则对 middleware 不可见（灰度/回滚兜底） */
  enabled: boolean
  /** 人类可读备注，透传到 x-rewrite-reason 响应头 */
  note?: string
}

export const REWRITE_LOCALES = ['en', 'zh-CN'] as const
export type RewriteLocale = (typeof REWRITE_LOCALES)[number]

/**
 * ALLOWLIST 正式条目。
 *
 * 初始仅含 RW-SETUP-02 验收用的 next-placeholder，供验证路由切分功能。
 * M2 开始将追加业务路由条目。
 */
export const REWRITE_ALLOWLIST: ReadonlyArray<RewriteRule> = [
  {
    milestone: 'RW-SETUP',
    domain: 'scaffold',
    path: '/next-placeholder',
    mode: 'prefix',
    localeAware: true,
    enabled: true,
    note: 'RW-SETUP-02 验收：确认 middleware 路由切分工作正常',
  },
  // M2 — homepage
  { milestone: 'M2', domain: 'home', path: '/', mode: 'exact', localeAware: true, enabled: true, note: 'M2 homepage' },
  // M3 示例
  // { milestone: 'M3', domain: 'player', path: '/watch',   mode: 'prefix', localeAware: true, enabled: false },
  // { milestone: 'M3', domain: 'player', path: '/movie',   mode: 'prefix', localeAware: true, enabled: false },
  // { milestone: 'M3', domain: 'player', path: '/anime',   mode: 'prefix', localeAware: true, enabled: false },
  // M4 示例
  // { milestone: 'M4', domain: 'auth',   path: '/auth',    mode: 'prefix', localeAware: true, enabled: false },
  // M5 示例
  // { milestone: 'M5', domain: 'search', path: '/search',  mode: 'prefix', localeAware: true, enabled: false },
]

/** kill-switch 环境变量名：设置为任意非空值时禁用所有 rewrite */
export const REWRITE_KILL_SWITCH_ENV = 'REWRITE_ALLOWLIST_DISABLED'

/** 上游地址（apps/web-next），本地开发默认 127.0.0.1:3002 */
export const REWRITE_UPSTREAM_DEFAULT = 'http://127.0.0.1:3002'
export const REWRITE_UPSTREAM_ENV = 'REWRITE_UPSTREAM_URL'
