/**
 * middleware-admin-preview.test.ts — CHG-361-B1 / ADR-160 D-160-3
 *
 * 覆盖 web-next middleware admin preview header 注入（双因素 D-160-1）：
 * - query=admin + cookie role=admin → 注入 x-admin-preview=1
 * - query=admin + cookie role=moderator → 注入
 * - query=admin + cookie role=user → 不注入
 * - 无 query → 不注入
 * - 既有 brand / theme header 注入零破坏
 *
 * MODUX-P1-3 根因回归：preview 必须注入「请求头」（req.headers，RSC `headers()`
 * 的读取面；next-intl rewrite 经 `new Headers(request.headers)` 转发）——
 * 原实现仅注入响应头导致 shouldUsePreview() 恒 false、未发布视频 preview 404。
 * 本文件 buildRequest 补真实 Headers，正向 case 双面断言（请求头 + 响应头）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 必须先 mock next-intl/middleware，再 import middleware
const intlResponse = (): Response => new Response(null, { headers: new Headers() })
vi.mock('next-intl/middleware', () => ({
  default: () => () => intlResponse(),
}))

vi.mock('@/i18n/routing', () => ({
  routing: { locales: ['en'], defaultLocale: 'en' },
}))

import middleware from '../../../apps/web-next/src/middleware'

type CookieMap = Record<string, string>

function buildRequest({
  url,
  cookies = {},
}: {
  url: string
  cookies?: CookieMap
}) {
  const nextUrl = new URL(url)
  const cookieJar = new Map(Object.entries(cookies))
  return {
    nextUrl,
    headers: new Headers(),
    cookies: {
      get(name: string) {
        const value = cookieJar.get(name)
        return value === undefined ? undefined : { name, value }
      },
    },
  } as unknown as Parameters<typeof middleware>[0]
}

describe('middleware — admin preview header 注入（ADR-160 D-160-3）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('query=admin + cookie role=admin → 注入 x-admin-preview=1（请求头 + 响应头双面）', () => {
    const req = buildRequest({
      url: 'http://example.com/movie/foo-aB3kR9x1?preview=admin',
      cookies: { user_role: 'admin' },
    })
    const res = middleware(req)
    // MODUX-P1-3 根因回归：请求头是 RSC shouldUsePreview() 的唯一读取面
    expect(req.headers.get('x-admin-preview')).toBe('1')
    expect(res.headers.get('x-admin-preview')).toBe('1')
  })

  it('query=admin + cookie role=moderator → 注入（请求头 + 响应头双面）', () => {
    const req = buildRequest({
      url: 'http://example.com/series/bar-aBcd1234?preview=admin',
      cookies: { user_role: 'moderator' },
    })
    const res = middleware(req)
    expect(req.headers.get('x-admin-preview')).toBe('1')
    expect(res.headers.get('x-admin-preview')).toBe('1')
  })

  it('query=admin + cookie role=user → 不注入（D-160-1 双因素之 role 拦截）', () => {
    const req = buildRequest({
      url: 'http://example.com/movie/foo-aB3kR9x1?preview=admin',
      cookies: { user_role: 'user' },
    })
    const res = middleware(req)
    expect(req.headers.get('x-admin-preview')).toBeNull()
    expect(res.headers.get('x-admin-preview')).toBeNull()
  })

  it('query=admin + 无 user_role cookie → 不注入', () => {
    const req = buildRequest({
      url: 'http://example.com/movie/foo-aB3kR9x1?preview=admin',
      cookies: {},
    })
    const res = middleware(req)
    expect(req.headers.get('x-admin-preview')).toBeNull()
    expect(res.headers.get('x-admin-preview')).toBeNull()
  })

  it('无 preview query + admin cookie → 不注入（避免管理员浏览公开页污染 cache）', () => {
    const req = buildRequest({
      url: 'http://example.com/movie/foo-aB3kR9x1',
      cookies: { user_role: 'admin' },
    })
    const res = middleware(req)
    expect(res.headers.get('x-admin-preview')).toBeNull()
  })

  it('既有 brand / theme header 注入不被破坏', () => {
    const req = buildRequest({
      url: 'http://example.com/movie/foo-aB3kR9x1?preview=admin',
      cookies: { user_role: 'admin', 'resovo-brand': 'resovo', 'resovo-theme': 'dark' },
    })
    const res = middleware(req)
    expect(res.headers.get('x-resovo-brand')).toBe('resovo')
    expect(res.headers.get('x-resovo-theme')).toBe('dark')
    expect(res.headers.get('x-admin-preview')).toBe('1')
  })

  it('preview=other 非约定值 → 不注入', () => {
    const req = buildRequest({
      url: 'http://example.com/movie/foo-aB3kR9x1?preview=draft',
      cookies: { user_role: 'admin' },
    })
    const res = middleware(req)
    expect(res.headers.get('x-admin-preview')).toBeNull()
  })
})
