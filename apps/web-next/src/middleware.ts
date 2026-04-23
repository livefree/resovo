import createIntlMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import {
  COOKIE_BRAND,
  COOKIE_THEME,
  HEADER_BRAND,
  HEADER_THEME,
  parseBrandSlug,
  parseTheme,
  parseThemeFromQuery,
} from '@/lib/brand-detection'

const intlMiddleware = createIntlMiddleware(routing)

function resolveBrandContext(req: NextRequest) {
  const brand = parseBrandSlug(req.cookies.get(COOKIE_BRAND)?.value)
  // HANDOFF-03: `?_theme=` query 优先（UI 复核截图用途）；否则回退 cookie。
  const queryTheme = parseThemeFromQuery(req.nextUrl.searchParams)
  const theme = queryTheme ?? parseTheme(req.cookies.get(COOKIE_THEME)?.value)
  return { brand, theme }
}

export default function middleware(req: NextRequest) {
  const { brand, theme } = resolveBrandContext(req)

  // next-intl 先决定 response 形态（rewrite / redirect / next），再注入 header
  const response = intlMiddleware(req)

  response.headers.set(HEADER_BRAND, brand)
  response.headers.set(HEADER_THEME, theme)

  return response
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
