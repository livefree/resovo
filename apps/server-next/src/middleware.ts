/**
 * server-next middleware — 品牌识别 + admin 鉴权拦截
 *
 * 双职责：
 *   1. 品牌识别：cookie → header（ADR-039；与 apps/web-next 同构，无 next-intl）
 *   2. admin 鉴权：/admin/** 路径要求 refresh_token + user_role 非 'user'（ADR-010）
 *      - 未登录 → redirect /login?from=<原路径>
 *      - user_role === 'user' → redirect /403
 *
 * 注：admin-only 细分路径（/admin/users / /admin/crawler / /admin/analytics）的
 * 角色限制留 M-SN-2+ 视图卡按需细化，本卡仅做整段 user 拦截。
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
import { COOKIE_REFRESH_TOKEN, COOKIE_USER_ROLE, canAccessAdmin, parseUserRole } from '@/lib/auth'

function resolveBrandContext(req: NextRequest) {
  const brand = parseBrandSlug(req.cookies.get(COOKIE_BRAND)?.value)
  const queryTheme = parseThemeFromQuery(req.nextUrl.searchParams)
  const theme = queryTheme ?? parseTheme(req.cookies.get(COOKIE_THEME)?.value)
  return { brand, theme }
}

export default function middleware(req: NextRequest) {
  const { brand, theme } = resolveBrandContext(req)
  const pathname = req.nextUrl.pathname

  // admin 鉴权拦截（ADR-010）
  // dev/visual 路由豁免（ADR-116 §2.3）：dev-only 视觉测试 harness，不暴露业务数据；
  // 生产模式由 layout + 单页双层 notFound() 守卫直接 404（middleware 之后），所以本路径
  // 在生产永远不可达；dev 模式下 Playwright visual baseline 自动化跑无需登录态。
  // 双重防御不变：layout notFound + page notFound 是生产防泄露主防线，middleware 鉴权
  // 是业务路由（非 dev-only）的真正鉴权层。
  const isDevVisual =
    process.env.NODE_ENV !== 'production' && pathname.startsWith('/admin/dev/visual')

  if (pathname.startsWith('/admin') && !isDevVisual) {
    const refreshToken = req.cookies.get(COOKIE_REFRESH_TOKEN)?.value
    const role = parseUserRole(req.cookies.get(COOKIE_USER_ROLE)?.value)

    if (!refreshToken || role === null) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = ''
      // 保留原 query string，确保登录后 router.push(from) 还原完整 URL
      const original = pathname + (req.nextUrl.search ?? '')
      loginUrl.searchParams.set('from', original)
      return NextResponse.redirect(loginUrl)
    }

    if (!canAccessAdmin(role)) {
      const forbiddenUrl = req.nextUrl.clone()
      forbiddenUrl.pathname = '/403'
      forbiddenUrl.search = ''
      return NextResponse.redirect(forbiddenUrl)
    }
  }

  const response = NextResponse.next()
  response.headers.set(HEADER_BRAND, brand)
  response.headers.set(HEADER_THEME, theme)

  return response
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
