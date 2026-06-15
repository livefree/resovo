/**
 * tests/unit/api/integration-credential-testers.test.ts —
 * ADR-173 D-173-6 provider 连接测试适配器 + lib testConnection 单测（META-27 / Card B1）
 *
 * 覆盖：bangumi（/v0/me valid·invalid / 无 token /calendar not_required / 网络错误）
 *       tmdb（Bearer /authentication valid·invalid / api_key query 兼容 / Bearer 优先 / 429 warn / 皆缺 none）
 *       testers 注册表分派（bangumi/tmdb 路由 + douban/imdb unsupported）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { testConnection as bangumiTest } from '@/api/lib/bangumi'
import { testConnection as tmdbTest } from '@/api/lib/tmdb'
import { testProviderCredential } from '@/api/services/integration-credential-testers'
import type { ResolvedCredential } from '@/api/services/integration-credentials-config'

function res(opts: { ok: boolean; status?: number }) {
  return { ok: opts.ok, status: opts.status ?? (opts.ok ? 200 : 500) }
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('bangumi.testConnection（ADR-173 D-173-6）', () => {
  it('有 token + 200：valid，命中 /v0/me', async () => {
    fetchMock.mockResolvedValue(res({ ok: true }))
    const r = await bangumiTest({ token: 'tok' })
    expect(r.ok).toBe(true)
    expect(r.authStatus).toBe('valid')
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v0/me')
  })

  it('有 token + 401：invalid', async () => {
    fetchMock.mockResolvedValue(res({ ok: false, status: 401 }))
    const r = await bangumiTest({ token: 'bad' })
    expect(r.ok).toBe(false)
    expect(r.authStatus).toBe('invalid')
  })

  it('无 token + 200：not_required，命中 /calendar（不误读为凭证有效）', async () => {
    fetchMock.mockResolvedValue(res({ ok: true }))
    const r = await bangumiTest({})
    expect(r.ok).toBe(true)
    expect(r.authStatus).toBe('not_required')
    expect(String(fetchMock.mock.calls[0][0])).toContain('/calendar')
  })

  it('网络错误：ok=false + error', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    const r = await bangumiTest({ token: 'tok' })
    expect(r.ok).toBe(false)
    expect(r.error).toBeTruthy()
  })
})

describe('tmdb.testConnection（ADR-201 Bearer 首选 / API Key 兼容）', () => {
  it('有 read_access_token + 200：valid，发送 Authorization: Bearer', async () => {
    fetchMock.mockResolvedValue(res({ ok: true }))
    const r = await tmdbTest({ readAccessToken: 'rat' })
    expect(r.ok).toBe(true)
    expect(r.authStatus).toBe('valid')
    expect(r.authMethod).toBe('bearer')
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer rat')
    expect(String(fetchMock.mock.calls[0][0])).toContain('/authentication')
  })

  it('有 read_access_token + 401：invalid', async () => {
    fetchMock.mockResolvedValue(res({ ok: false, status: 401 }))
    const r = await tmdbTest({ readAccessToken: 'bad' })
    expect(r.ok).toBe(false)
    expect(r.authStatus).toBe('invalid')
  })

  it('仅 api_key + 200：valid，走 query ?api_key=（不发 Authorization）', async () => {
    fetchMock.mockResolvedValue(res({ ok: true }))
    const r = await tmdbTest({ apiKey: 'k3' })
    expect(r.ok).toBe(true)
    expect(r.authMethod).toBe('api_key')
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('api_key=k3')
    expect(url).toContain('/authentication')
    const headers = (fetchMock.mock.calls[0][1].headers ?? {}) as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('read_access_token 与 api_key 并存：Bearer 优先（不拼 api_key query）', async () => {
    fetchMock.mockResolvedValue(res({ ok: true }))
    const r = await tmdbTest({ readAccessToken: 'rat', apiKey: 'k3' })
    expect(r.authMethod).toBe('bearer')
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer rat')
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('api_key=')
  })

  it('429：warn 不标 invalid（provider 暂时不可用，ADR-201 §连接测试）', async () => {
    fetchMock.mockResolvedValue(res({ ok: false, status: 429 }))
    const r = await tmdbTest({ readAccessToken: 'rat' })
    expect(r.ok).toBe(false)
    expect(r.authStatus).toBeUndefined() // 不标记凭证无效
    expect(r.error).toContain('429')
  })

  it('read_access_token 与 api_key 皆缺：ok=false 且不发请求', async () => {
    const r = await tmdbTest({})
    expect(r.ok).toBe(false)
    expect(r.authMethod).toBe('none')
    expect(r.error).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('testProviderCredential 注册表分派', () => {
  const resolved = (fields: Record<string, string | number>): ResolvedCredential => ({ enabled: true, fields })

  it('bangumi → 分派到 bangumi 适配器', async () => {
    fetchMock.mockResolvedValue(res({ ok: true }))
    const r = await testProviderCredential('bangumi', resolved({ token: 'tok' }))
    expect(r.authStatus).toBe('valid')
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v0/me')
  })

  it('tmdb → 分派到 tmdb 适配器（read_access_token Bearer）', async () => {
    fetchMock.mockResolvedValue(res({ ok: true }))
    const r = await testProviderCredential('tmdb', resolved({ read_access_token: 'rat' }))
    expect(r.authStatus).toBe('valid')
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer rat')
    expect(String(fetchMock.mock.calls[0][0])).toContain('/authentication')
  })

  it('douban / imdb → unsupported（不发请求）', async () => {
    const rd = await testProviderCredential('douban', resolved({}))
    const ri = await testProviderCredential('imdb', resolved({}))
    expect(rd).toEqual({ ok: false, latencyMs: 0, error: 'unsupported' })
    expect(ri).toEqual({ ok: false, latencyMs: 0, error: 'unsupported' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
