/**
 * tests/unit/api/system-config.test.ts
 * CHG-34: GET/POST /admin/system/settings, GET/POST /admin/system/config,
 *         GET/POST/PATCH/DELETE /admin/crawler/sites, batch, validate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock 依赖 ─────────────────────────────────────────────────────

const mockDbQuery = vi.fn()
vi.mock('@/api/lib/postgres', () => ({ db: { query: mockDbQuery, connect: vi.fn() } }))

vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() },
}))

vi.mock('@/api/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
  blacklistKey: (t: string) => `blacklist:${t}`,
}))

vi.mock('@/api/lib/queue', () => ({
  verifyQueue:  { add: vi.fn(), process: vi.fn(), on: vi.fn() },
  crawlerQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
}))

vi.mock('@/api/services/CrawlerService', () => ({
  CrawlerService: class {},
  parseCrawlerSources: vi.fn(() => []),
  getEnabledSources: vi.fn(async () => []),
}))

vi.mock('@/api/services/AnalyticsService', () => ({ AnalyticsService: class {} }))

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { setupAuthenticate } from '@/api/plugins/authenticate'
import * as authLib from '@/api/lib/auth'

const mockVerify = authLib.verifyAccessToken as ReturnType<typeof vi.fn>

async function buildApp() {
  const { adminSiteConfigRoutes } = await import('@/api/routes/admin/siteConfig')
  const { adminCrawlerSitesRoutes } = await import('@/api/routes/admin/crawlerSites')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(adminSiteConfigRoutes)
  await app.register(adminCrawlerSitesRoutes)
  await app.ready()
  return app
}

function authHeader(role: 'admin' | 'moderator' | 'user' = 'admin') {
  mockVerify.mockReturnValue({ userId: 'user-1', role })
  return { Authorization: 'Bearer test-token' }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDbQuery.mockResolvedValue({ rows: [], rowCount: 0 })
})

// ── 站点配置 ──────────────────────────────────────────────────────

describe('GET /admin/system/settings', () => {
  it('returns 401 without token', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/system/settings' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 403 for moderator', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/system/settings',
      headers: authHeader('moderator'),
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 200 with settings object for admin', async () => {
    mockDbQuery.mockResolvedValue({
      rows: [
        { key: 'site_name', value: 'Resovo' },
        { key: 'show_adult_content', value: 'false' },
      ],
      rowCount: 2,
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/system/settings',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { siteName: string } }>()
    expect(body.data.siteName).toBe('Resovo')
  })
})

describe('POST /admin/system/settings', () => {
  it('saves settings and returns ok', async () => {
    const mockConnect = { query: vi.fn().mockResolvedValue({}), release: vi.fn() }
    ;(mockDbQuery as ReturnType<typeof vi.fn>)
    const db = await import('@/api/lib/postgres')
    ;(db.db as unknown as { connect: ReturnType<typeof vi.fn> }).connect = vi.fn().mockResolvedValue(mockConnect)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/system/settings',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteName: 'TestSite', autoCrawlEnabled: true }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ data: { ok: boolean } }>().data.ok).toBe(true)
  })

  it('returns 400 for invalid autoCrawlMaxPerRun', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/system/settings',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoCrawlMaxPerRun: 9999 }),
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── 配置文件 ──────────────────────────────────────────────────────

describe('GET /admin/system/config', () => {
  it('returns empty config when not set', async () => {
    mockDbQuery.mockResolvedValue({ rows: [], rowCount: 0 })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/system/config',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { configFile: string } }>()
    expect(body.data.configFile).toBe('')
  })
})

describe('POST /admin/system/config', () => {
  it('returns 400 for invalid JSON', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/system/config',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ configFile: '{bad json' }),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json<{ error: { code: string } }>().error.code).toBe('INVALID_JSON')
  })

  it('saves valid JSON and syncs crawler_sites', async () => {
    const mockConnect = { query: vi.fn().mockResolvedValue({ rows: [{ key: 'jsm3u8', name: 'Test', api_url: 'https://api.test.com', detail: null, source_type: 'vod', format: 'json', weight: 50, is_adult: false, disabled: false, from_config: true, created_at: '', updated_at: '' }] }), release: vi.fn() }
    const db = await import('@/api/lib/postgres')
    ;(db.db as unknown as { connect: ReturnType<typeof vi.fn> }).connect = vi.fn().mockResolvedValue(mockConnect)
    mockDbQuery.mockResolvedValue({ rows: [{ key: 'jsm3u8', name: 'Test', api_url: 'https://api.test.com', detail: null, source_type: 'vod', format: 'json', weight: 50, is_adult: false, disabled: false, from_config: true, created_at: '', updated_at: '' }], rowCount: 1 })

    const validConfig = JSON.stringify({
      crawler_sites: {
        jsm3u8: { name: '晶石影视', api: 'https://jszyapi.com', type: 'vod', format: 'json', weight: 80 },
      },
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/system/config',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ configFile: validConfig }),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { synced: number } }>()
    expect(body.data.synced).toBe(1)
  })

  it('accepts api_site format from sources file and supports api_url alias', async () => {
    const mockRow = {
      key: 'jszyapi.com',
      name: '🎬极速资源',
      api_url: 'https://jszyapi.com/api.php/provide/vod',
      detail: 'https://jszyapi.com',
      source_type: 'vod',
      format: 'json',
      weight: 50,
      is_adult: false,
      disabled: false,
      from_config: true,
      created_at: '',
      updated_at: '',
    }
    const mockConnect = { query: vi.fn().mockResolvedValue({ rows: [mockRow], rowCount: 1 }), release: vi.fn() }
    const db = await import('@/api/lib/postgres')
    ;(db.db as unknown as { connect: ReturnType<typeof vi.fn> }).connect = vi.fn().mockResolvedValue(mockConnect)
    mockDbQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 })

    const config = JSON.stringify({
      api_site: {
        'jszyapi.com': {
          name: '🎬极速资源',
          api: 'https://jszyapi.com/api.php/provide/vod',
          detail: 'https://jszyapi.com',
        },
        'alt.example.com': {
          name: '别名字段站点',
          api_url: 'https://alt.example.com/api.php/provide/vod',
        },
      },
    })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/system/config',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ configFile: config }),
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: { synced: number; skipped: number } }>()
    expect(body.data.synced).toBe(2)
    expect(body.data.skipped).toBe(0)
  })

  it('returns 400 for invalid subscription url', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/system/config',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        configFile: JSON.stringify({ api_site: {} }),
        subscriptionUrl: 'not-a-url',
      }),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json<{ error: { code: string } }>().error.code).toBe('INVALID_SUBSCRIPTION_URL')
  })
})

// ── 爬虫源站 CRUD ─────────────────────────────────────────────────

describe('GET /admin/crawler/sites', () => {
  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/crawler/sites' })
    expect(res.statusCode).toBe(401)
  })

  it('returns site list for admin', async () => {
    mockDbQuery.mockResolvedValue({
      rows: [{
        key: 'jsm3u8', name: '晶石', api_url: 'https://api.test.com', detail: null,
        source_type: 'vod', format: 'json', weight: 50, is_adult: false,
        disabled: false, from_config: false, created_at: '', updated_at: '',
      }],
      rowCount: 1,
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET', url: '/admin/crawler/sites',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ data: Array<{ key: string }> }>()
    expect(body.data[0].key).toBe('jsm3u8')
  })
})

describe('POST /admin/crawler/sites', () => {
  it('returns 400 for missing required fields', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/crawler/sites',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No API URL' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid key characters', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/crawler/sites',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'invalid key!', name: 'Test', apiUrl: 'https://api.test.com' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 409 for duplicate key', async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [{
        key: 'jsm3u8', name: '晶石', api_url: 'https://api.test.com', detail: null,
        source_type: 'vod', format: 'json', weight: 50, is_adult: false,
        disabled: false, from_config: false, created_at: '', updated_at: '',
      }],
      rowCount: 1,
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/crawler/sites',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'jsm3u8', name: '晶石', apiUrl: 'https://api.test.com' }),
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 409 for duplicate apiUrl', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // find by key
      .mockResolvedValueOnce({
        rows: [{
          key: 'existing', name: '已有源', api_url: 'https://api.test.com', detail: null,
          source_type: 'vod', format: 'json', weight: 50, is_adult: false,
          disabled: false, from_config: false, created_at: '', updated_at: '',
        }],
        rowCount: 1,
      }) // find by api_url

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/crawler/sites',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'new-key', name: '新源', apiUrl: 'https://api.test.com' }),
    })
    expect(res.statusCode).toBe(409)
    expect(res.json<{ error: { code: string } }>().error.code).toBe('DUPLICATE_API_URL')
  })
})

describe('DELETE /admin/crawler/sites/:key', () => {
  it('returns 403 for from_config sites', async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [{
        key: 'jsm3u8', name: '晶石', api_url: 'https://api.test.com', detail: null,
        source_type: 'vod', format: 'json', weight: 50, is_adult: false,
        disabled: false, from_config: true, created_at: '', updated_at: '',
      }],
      rowCount: 1,
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE', url: '/admin/crawler/sites/jsm3u8',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 404 for non-existent site', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE', url: '/admin/crawler/sites/nonexistent',
      headers: authHeader('admin'),
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /admin/crawler/sites/batch', () => {
  it('returns 400 for empty keys array', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/crawler/sites/batch',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: [], action: 'enable' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('executes batch action and returns affected count', async () => {
    mockDbQuery.mockResolvedValue({ rows: [], rowCount: 2 })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/admin/crawler/sites/batch',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: ['jsm3u8', 'other'], action: 'disable' }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ data: { affected: number } }>().data.affected).toBe(2)
  })
})
