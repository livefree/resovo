/**
 * middleware.ts — Next.js 全局中间件
 *
 * 职责：
 * 1. next-intl 国际化路由（所有路径）
 * 2. /admin/* 访问控制（ADR-010）
 *    - 未登录 → 跳转 /auth/login?callbackUrl=...
 *    - role=user → 跳转 /admin/403
 *    - /admin/users、/admin/crawler、/admin/analytics → admin only
 *
 * 依赖 Cookie：
 *   refresh_token  (HttpOnly) — 存在即视为"已登录"
 *   user_role      (非HttpOnly) — 值为 user / moderator / admin
 */

import createIntlMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from '@/i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

// /admin 下仅 admin 角色可访问的子路径
const ADMIN_ONLY_PATHS = ['/admin/users', '/admin/crawler', '/admin/analytics']

/**
 * 从 pathname 中剥离 locale 前缀，返回 { locale, path }
 * e.g. /zh-CN/admin/videos → { locale: 'zh-CN', path: '/admin/videos' }
 */
function stripLocale(pathname: string): { locale: string; path: string } {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) {
      return { locale, path: '/' }
    }
    if (pathname.startsWith(`/${locale}/`)) {
      return { locale, path: pathname.slice(locale.length + 1) }
    }
  }
  return { locale: routing.defaultLocale, path: pathname }
}

export default function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const { locale, path } = stripLocale(pathname)

  // ── /admin 路径守卫 ────────────────────────────────────────────
  if (path.startsWith('/admin') && path !== '/admin/403') {
    const refreshToken = request.cookies.get('refresh_token')?.value
    const userRole = request.cookies.get('user_role')?.value

    // 未登录 → 跳到登录页
    if (!refreshToken) {
      const loginUrl = new URL(`/${locale}/auth/login`, request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // role=user（或 cookie 缺失/异常）→ 403
    if (!userRole || userRole === 'user') {
      return NextResponse.redirect(new URL(`/${locale}/admin/403`, request.url))
    }

    // moderator 访问 admin-only 路径 → 403
    if (
      userRole === 'moderator' &&
      ADMIN_ONLY_PATHS.some((p) => path === p || path.startsWith(p + '/'))
    ) {
      return NextResponse.redirect(new URL(`/${locale}/admin/403`, request.url))
    }
  }

  // 其余路径交给 next-intl 处理
  return intlMiddleware(request) as NextResponse
}

export const config = {
  // 匹配所有路径，排除 API 路由、Next.js 内部路由、静态文件
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
