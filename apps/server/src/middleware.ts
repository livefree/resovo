import { NextRequest, NextResponse } from 'next/server'

// CHG-E2E-GATE-AUDIT-B（维护期 bug 修复）：本文件自 DEC-13 拆分起误置于项目根级——
// src/app 布局下 Next 仅识别 src/middleware.ts，根级文件为死代码，服务端 /admin
// 访问控制（ADR-010）从未生效（未登录可渲染后台 shell）。迁入 src/ 恢复守卫，逻辑零变更。

const ADMIN_ONLY_PATHS = ['/admin/users', '/admin/crawler', '/admin/analytics']

export default function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin') && pathname !== '/admin/403' && pathname !== '/admin/login') {
    const refreshToken = request.cookies.get('refresh_token')?.value
    const userRole = request.cookies.get('user_role')?.value

    if (!refreshToken) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    if (!userRole || userRole === 'user') {
      return NextResponse.redirect(new URL('/admin/403', request.url))
    }

    if (
      userRole === 'moderator' &&
      ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
    ) {
      return NextResponse.redirect(new URL('/admin/403', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
