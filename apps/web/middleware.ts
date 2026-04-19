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

const intlMiddleware = createIntlMiddleware(routing)

export function middleware(request: NextRequest): NextResponse {
  const brandSlug = parseBrandSlug(request.cookies.get(COOKIE_BRAND)?.value)
  const theme = parseTheme(request.cookies.get(COOKIE_THEME)?.value)

  // 将品牌/主题写入 request header，供 Server Components 读取
  const headers = new Headers(request.headers)
  headers.set(HEADER_BRAND, brandSlug)
  headers.set(HEADER_THEME, theme)

  const nextRequest = new NextRequest(request, { headers })
  return intlMiddleware(nextRequest) as NextResponse
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
