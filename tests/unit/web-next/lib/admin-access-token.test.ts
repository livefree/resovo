/**
 * admin-access-token.test.ts — CHG-361-B1 / ADR-160 D-160-4b
 *
 * 覆盖 admin-preview 协议层：
 * - isPreviewRole 纯函数边界（5+ case）
 * - getAdminAccessToken refresh 交换（4 case：happy / no cookie / 401 / 网络失败 / body 异常）
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  COOKIE_REFRESH_TOKEN,
  COOKIE_USER_ROLE,
  HEADER_ADMIN_PREVIEW,
  PREVIEW_QUERY_KEY,
  PREVIEW_QUERY_VALUE,
  getAdminAccessToken,
  isPreviewRole,
} from '../../../../apps/web-next/src/lib/admin-access-token'

describe('ADR-160 协议常量', () => {
  it('常量值与后端 cookie / header / query 对齐', () => {
    expect(HEADER_ADMIN_PREVIEW).toBe('x-admin-preview')
    expect(COOKIE_USER_ROLE).toBe('user_role')
    expect(COOKIE_REFRESH_TOKEN).toBe('refresh_token')
    expect(PREVIEW_QUERY_KEY).toBe('preview')
    expect(PREVIEW_QUERY_VALUE).toBe('admin')
  })
})

describe('isPreviewRole — D-160-1 双因素之 role 判定', () => {
  it('admin / moderator 通过', () => {
    expect(isPreviewRole('admin')).toBe(true)
    expect(isPreviewRole('moderator')).toBe(true)
  })

  it('user / guest / 其他角色拒绝', () => {
    expect(isPreviewRole('user')).toBe(false)
    expect(isPreviewRole('guest')).toBe(false)
    expect(isPreviewRole('owner')).toBe(false)
  })

  it('undefined / null / 空串拒绝', () => {
    expect(isPreviewRole(undefined)).toBe(false)
    expect(isPreviewRole(null)).toBe(false)
    expect(isPreviewRole('')).toBe(false)
  })

  it('大小写不敏感 + 前后空白裁剪', () => {
    expect(isPreviewRole('ADMIN')).toBe(true)
    expect(isPreviewRole(' Moderator ')).toBe(true)
    expect(isPreviewRole('Admin')).toBe(true)
  })
})

describe('getAdminAccessToken — D-160-4b refresh 交换', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refresh_token 缺失（undefined / null / 空）→ null 且不发起 fetch', async () => {
    expect(await getAdminAccessToken(undefined)).toBeNull()
    expect(await getAdminAccessToken(null)).toBeNull()
    expect(await getAdminAccessToken('')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refresh 成功 → 返回 accessToken（透传 cookie / cache: no-store）', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { accessToken: 'eyJ-fake-access-token' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    const token = await getAdminAccessToken('rt-abc-123')
    expect(token).toBe('eyJ-fake-access-token')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(/\/auth\/refresh$/)
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store' })
    expect((init as RequestInit).headers).toMatchObject({
      cookie: `${COOKIE_REFRESH_TOKEN}=rt-abc-123`,
    })
    // MODUX-P1-3 根因回归：无 body 不得发 content-type:json，否则 fastify
    // FST_ERR_CTP_EMPTY_JSON_BODY 400 → token 交换恒失败、preview 永久降级
    const sentHeaders = (init as RequestInit).headers as Record<string, string>
    expect(sentHeaders['content-type']).toBeUndefined()
    expect((init as RequestInit).body).toBeUndefined()
  })

  it('refresh 401 → null（不抛异常）', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 })
    )
    expect(await getAdminAccessToken('rt-expired')).toBeNull()
  })

  it('网络抛错 → null', async () => {
    fetchMock.mockRejectedValueOnce(new Error('econnreset'))
    expect(await getAdminAccessToken('rt-network-down')).toBeNull()
  })

  it('response.json() 异常或 accessToken 缺失 → null', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('not-json', { status: 200, headers: { 'content-type': 'text/plain' } })
    )
    expect(await getAdminAccessToken('rt-bad-body')).toBeNull()

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } })
    )
    expect(await getAdminAccessToken('rt-no-token-field')).toBeNull()
  })
})
