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
import {
  COOKIE_USER_ROLE,
  HEADER_ADMIN_PREVIEW,
  PREVIEW_QUERY_KEY,
  PREVIEW_QUERY_VALUE,
  isPreviewRole,
} from '@/lib/admin-access-token'

const intlMiddleware = createIntlMiddleware(routing)

function resolveBrandContext(req: NextRequest) {
  const brand = parseBrandSlug(req.cookies.get(COOKIE_BRAND)?.value)
  // HANDOFF-03: `?_theme=` query 优先（UI 复核截图用途）；否则回退 cookie。
  const queryTheme = parseThemeFromQuery(req.nextUrl.searchParams)
  const theme = queryTheme ?? parseTheme(req.cookies.get(COOKIE_THEME)?.value)
  return { brand, theme }
}

// ADR-160 D-160-1 / D-160-3：admin preview 双因素（query=admin + cookie role∈{admin,moderator}）
function resolveAdminPreview(req: NextRequest): boolean {
  if (req.nextUrl.searchParams.get(PREVIEW_QUERY_KEY) !== PREVIEW_QUERY_VALUE) {
    return false
  }
  return isPreviewRole(req.cookies.get(COOKIE_USER_ROLE)?.value)
}

export default function middleware(req: NextRequest) {
  const { brand, theme } = resolveBrandContext(req)
  const adminPreview = resolveAdminPreview(req)

  // MODUX-P1-3 根因修复：RSC `headers()` 读的是「请求头」；原实现仅
  // `response.headers.set`（响应头）→ `shouldUsePreview()` 恒 false，
  // preview 派发链路从未生效（未发布视频 preview 一律 404）。
  // next-intl rewrite 内部 `new Headers(request.headers)` 转发请求头，
  // 因此必须在 intlMiddleware(req) 之前写入 req.headers。
  if (adminPreview) {
    req.headers.set(HEADER_ADMIN_PREVIEW, '1')
  }

  // next-intl 先决定 response 形态（rewrite / redirect / next），再注入 header
  const response = intlMiddleware(req)

  response.headers.set(HEADER_BRAND, brand)
  response.headers.set(HEADER_THEME, theme)
  if (adminPreview) {
    // 响应头同步保留：跨层排障可观测（curl -D 即可取证 preview 判定结果）
    response.headers.set(HEADER_ADMIN_PREVIEW, '1')
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
