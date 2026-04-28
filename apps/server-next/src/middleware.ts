/**
 * server-next middleware — 品牌识别（cookie → header）
 *
 * 与 apps/web-next/src/middleware.ts 行为同构，差异：
 * - 不挂 next-intl（单语言 zh-CN，ADR-100）
 * - 仅做 cookie → header 转换 + `?_theme=` query 优先合并
 *
 * 鉴权拦截留待 CHG-SN-1-06（apiClient + 鉴权层）扩展本 middleware。
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  COOKIE_BRAND,
  COOKIE_THEME,
  HEADER_BRAND,
  HEADER_THEME,
  parseBrandSlug,
  parseTheme,
  parseThemeFromQuery,
} from '@/lib/brand-detection'

function resolveBrandContext(req: NextRequest) {
  const brand = parseBrandSlug(req.cookies.get(COOKIE_BRAND)?.value)
  const queryTheme = parseThemeFromQuery(req.nextUrl.searchParams)
  const theme = queryTheme ?? parseTheme(req.cookies.get(COOKIE_THEME)?.value)
  return { brand, theme }
}

export default function middleware(req: NextRequest) {
  const { brand, theme } = resolveBrandContext(req)

  const response = NextResponse.next()
  response.headers.set(HEADER_BRAND, brand)
  response.headers.set(HEADER_THEME, theme)

  return response
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
