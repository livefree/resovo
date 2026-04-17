import { NextRequest, NextResponse } from 'next/server'

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
