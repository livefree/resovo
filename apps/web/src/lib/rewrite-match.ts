import {
  REWRITE_ALLOWLIST,
  REWRITE_LOCALES,
  type RewriteRule,
} from './rewrite-allowlist'

export interface MatchResult {
  matched: true
  rule: RewriteRule
  normalizedPath: string
}
export type MatchOutcome = MatchResult | { matched: false }

export function matchRewrite(pathname: string): MatchOutcome {
  const { locale, rest } = stripLocale(pathname)

  for (const rule of REWRITE_ALLOWLIST) {
    if (!rule.enabled) continue
    if (locale !== null && rule.localeAware === false) continue

    if (rule.mode === 'exact' && rest === rule.path) {
      return { matched: true, rule, normalizedPath: rest }
    }
    if (
      rule.mode === 'prefix' &&
      (rest === rule.path || rest.startsWith(rule.path + '/'))
    ) {
      return { matched: true, rule, normalizedPath: rest }
    }
  }
  return { matched: false }
}

export function stripLocale(pathname: string): { locale: string | null; rest: string } {
  for (const l of REWRITE_LOCALES) {
    if (pathname === `/${l}`) return { locale: l, rest: '/' }
    if (pathname.startsWith(`/${l}/`)) return { locale: l, rest: pathname.slice(l.length + 1) }
  }
  return { locale: null, rest: pathname }
}
