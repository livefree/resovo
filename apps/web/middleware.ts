import { NextRequest, NextResponse } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import {
  COOKIE_BRAND,
  COOKIE_THEME,
  HEADER_BRAND,
  HEADER_THEME,
  parseBrandSlug,
  parseTheme,
} from '@/lib/brand-detection'
import {
  REWRITE_KILL_SWITCH_ENV,
  REWRITE_UPSTREAM_DEFAULT,
  REWRITE_UPSTREAM_ENV,
} from '@/lib/rewrite-allowlist'
import { matchRewrite } from '@/lib/rewrite-match'

const intlMiddleware = createIntlMiddleware(routing)

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl

  // ── ADR-035: 重写期路由切分 ──────────────────────────────────────────
  // kill-switch 优先，设置后跳过所有 rewrite
  const killSwitch = process.env[REWRITE_KILL_SWITCH_ENV]
  if (!killSwitch) {
    const outcome = matchRewrite(pathname)
    if (outcome.matched) {
      const upstream = process.env[REWRITE_UPSTREAM_ENV] ?? REWRITE_UPSTREAM_DEFAULT
      const target = new URL(pathname + search, upstream)
      const rewriteResp = NextResponse.rewrite(target)
      rewriteResp.headers.set('x-rewrite-source', 'web-next')
      rewriteResp.headers.set(
        'x-rewrite-rule',
        `${outcome.rule.milestone}:${outcome.rule.domain}`
      )
      return rewriteResp
    }
  }

  // ── 品牌 / 主题 headers + next-intl ─────────────────────────────────
  const brandSlug = parseBrandSlug(request.cookies.get(COOKIE_BRAND)?.value)
  const theme = parseTheme(request.cookies.get(COOKIE_THEME)?.value)

  const headers = new Headers(request.headers)
  headers.set(HEADER_BRAND, brandSlug)
  headers.set(HEADER_THEME, theme)

  const nextRequest = new NextRequest(request, { headers })
  return intlMiddleware(nextRequest) as NextResponse
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
