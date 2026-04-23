/**
 * rewrite-match.ts
 *
 * 路由匹配工具 — 将入站 URL 路径与已知 domain 规则对照，
 * 用于 middleware 代理转发判断。
 *
 * API:
 *   stripLocale(path)    — 剥离 /en / /zh-CN 等 locale 前缀
 *   matchRewrite(path)   — 路径与规则集匹配，返回匹配 domain 或 matched: false
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RewriteRule {
  domain: string
  milestone?: string
}

export type MatchResult =
  | { matched: true; rule: RewriteRule }
  | { matched: false }

// ── stripLocale ───────────────────────────────────────────────────────────────

/**
 * 从 URL 路径中剥离 locale 前缀（如 /en、/zh-CN）。
 * 仅精确匹配 2 字母或 5 字符（xx-YY）格式，不匹配 /english 等非 locale 前缀。
 *
 * @returns { locale, rest }
 *   locale — 匹配到的 locale 字符串，无匹配时为 null
 *   rest   — 剥离 locale 前缀后的路径，最短为 "/"
 */
export function stripLocale(path: string): { locale: string | null; rest: string } {
  // 匹配 /xx 或 /xx-YY 后接 "/" 或字符串结尾
  const m = /^\/([a-z]{2}(?:-[A-Z]{2})?)(\/.*|$)/.exec(path)
  if (!m) return { locale: null, rest: path }
  const locale = m[1]
  const rest = m[2] || '/'
  return { locale, rest }
}

// ── Rule table ────────────────────────────────────────────────────────────────

interface InternalRule {
  domain: string
  milestone?: string
  /** match against the locale-stripped rest path */
  test: (rest: string) => boolean
}

/** 前缀匹配：rest === prefix 或 rest 以 prefix + "/" 开头 */
function prefixOf(prefix: string): (rest: string) => boolean {
  return (rest) => rest === prefix || rest.startsWith(prefix + '/')
}

const RULES: InternalRule[] = [
  // next-placeholder scaffold（M1 过渡期）
  {
    domain: 'scaffold',
    test: prefixOf('/next-placeholder'),
  },

  // 首页精确匹配
  {
    domain: 'home',
    test: (rest) => rest === '/',
  },

  // 详情页路径（M3）
  {
    domain: 'player',
    test: (rest) => {
      const DETAIL_PREFIXES = ['/movie', '/series', '/anime', '/tvshow', '/others']
      return DETAIL_PREFIXES.some((p) => prefixOf(p)(rest))
    },
  },

  // /watch 播放页（M3）
  {
    domain: 'player',
    test: prefixOf('/watch'),
  },

  // /search 搜索页（M5）
  {
    domain: 'search',
    milestone: 'M5',
    test: prefixOf('/search'),
  },
]

// ── matchRewrite ──────────────────────────────────────────────────────────────

/**
 * 将路径（含或不含 locale 前缀）与 RULES 对照。
 * 返回第一个匹配规则，或 { matched: false }。
 */
export function matchRewrite(path: string): MatchResult {
  const { rest } = stripLocale(path)
  for (const rule of RULES) {
    if (rule.test(rest)) {
      return { matched: true, rule: { domain: rule.domain, milestone: rule.milestone } }
    }
  }
  return { matched: false }
}
