/**
 * tests/unit/api/search.test.ts
 * SEARCH-01: GET /search, GET /search/suggest 测试
 * ADR-004: director/actor/writer 精确匹配、空 q 场景、highlight 字段
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'

import { setupAuthenticate } from '@/api/plugins/authenticate'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('@/api/lib/redis', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}))

vi.mock('@/api/lib/postgres', () => ({ db: {} }))

vi.mock('@/api/lib/elasticsearch', () => ({
  es: { search: vi.fn() },
  ES_INDEX: 'resovo_videos',
  ensureIndex: vi.fn(),
}))

import { es } from '@/api/lib/elasticsearch'
const mockEs = es as { search: ReturnType<typeof vi.fn> }

// ── 辅助：构造 ES 响应 ────────────────────────────────────────────

function makeEsResponse(
  hits: Array<{
    source: Record<string, unknown>
    highlight?: Record<string, string[]>
  }>,
  total = hits.length
) {
  return {
    hits: {
      total: { value: total },
      hits: hits.map((h, i) => ({
        _index: 'resovo_videos',
        _id: `id-${i}`,
        _source: h.source,
        highlight: h.highlight,
      })),
    },
    aggregations: undefined,
  }
}

function makePeopleEsResponse(
  directors: string[],
  cast: string[],
  writers: string[]
) {
  return {
    hits: { total: { value: 0 }, hits: [] },
    aggregations: {
      directors: { buckets: directors.map((k) => ({ key: k })) },
      cast: { buckets: cast.map((k) => ({ key: k })) },
      writers: { buckets: writers.map((k) => ({ key: k })) },
    },
  }
}

const MOCK_SOURCE = {
  id: 'uuid-1',
  short_id: 'abCD1234',
  slug: 'test-anime-abCD1234',
  title: '进击的巨人',
  title_en: 'Attack on Titan',
  cover_url: 'https://cdn.example.com/cover.jpg',
  type: 'anime',
  rating: 9.0,
  year: 2013,
  status: 'completed',
  episode_count: 75,
}

// ── 辅助：测试 app ────────────────────────────────────────────────

async function buildApp() {
  const { searchRoutes } = await import('@/api/routes/search')
  const app = Fastify({ logger: false })
  await app.register(cookie, { secret: 'test-secret' })
  setupAuthenticate(app)
  await app.register(searchRoutes, { prefix: '/v1' })
  await app.ready()
  return app
}

// ═══════════════════════════════════════════════════════════════
// GET /v1/search
// ═══════════════════════════════════════════════════════════════

describe('GET /v1/search', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockEs.search.mockResolvedValue(makeEsResponse([{ source: MOCK_SOURCE }]))
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('基础搜索：返回 data + pagination', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/search?q=巨人' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.pagination).toMatchObject({ total: 1, page: 1, limit: 20 })
  })

  it('highlight 字段包含 <em> 标记（当 ES 返回 highlight 时）', async () => {
    mockEs.search.mockResolvedValue(
      makeEsResponse([
        {
          source: MOCK_SOURCE,
          highlight: { title: ['<em>进击</em>的巨人'], description: [] },
        },
      ])
    )
    const res = await app.inject({ method: 'GET', url: '/v1/search?q=进击' })
    expect(res.json().data[0].highlight.title).toContain('<em>')
  })

  it('director 精确匹配：ES 查询使用 director.keyword（ADR-004）', async () => {
    await app.inject({ method: 'GET', url: '/v1/search?director=荒木哲郎' })
    const esBody = mockEs.search.mock.calls[0][0] as Record<string, unknown>
    const bodyStr = JSON.stringify(esBody)
    expect(bodyStr).toContain('"director.keyword"')
    expect(bodyStr).toContain('荒木哲郎')
  })

  it('actor 精确匹配：ES 查询使用 cast.keyword（ADR-004）', async () => {
    await app.inject({ method: 'GET', url: '/v1/search?actor=梶裕贵' })
    const esBody = mockEs.search.mock.calls[0][0] as Record<string, unknown>
    expect(JSON.stringify(esBody)).toContain('"cast.keyword"')
  })

  it('writer 精确匹配：ES 查询使用 writers.keyword（ADR-004）', async () => {
    await app.inject({ method: 'GET', url: '/v1/search?writer=諫山創' })
    const esBody = mockEs.search.mock.calls[0][0] as Record<string, unknown>
    expect(JSON.stringify(esBody)).toContain('"writers.keyword"')
  })

  it('空 q 但有 director 参数：正常返回结果（不因 q 为空而报错）', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/search?director=宫崎骏' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toBeDefined()
  })

  it('空 q 完全不传任何参数：match_all 查询', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/search' })
    expect(res.statusCode).toBe(200)
    // 没有 must 时应该只有 filter（bool.filter only）
    const esBody = mockEs.search.mock.calls[0][0] as Record<string, unknown>
    const bodyStr = JSON.stringify(esBody)
    expect(bodyStr).not.toContain('"must"')
    expect(bodyStr).toContain('"filter"')
  })

  it('pagination.hasNext 计算正确', async () => {
    mockEs.search.mockResolvedValue(
      makeEsResponse([{ source: MOCK_SOURCE }], 50) // total=50
    )
    const res = await app.inject({ method: 'GET', url: '/v1/search?page=1&limit=20' })
    expect(res.json().pagination.hasNext).toBe(true)
  })

  it('lang 过滤：ES 查询包含 subtitle_langs 条件', async () => {
    await app.inject({ method: 'GET', url: '/v1/search?lang=zh-CN' })
    const esBody = mockEs.search.mock.calls[0][0] as Record<string, unknown>
    expect(JSON.stringify(esBody)).toContain('subtitle_langs')
  })
})

// ═══════════════════════════════════════════════════════════════
// GET /v1/search/suggest
// ═══════════════════════════════════════════════════════════════

describe('GET /v1/search/suggest', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })
  afterEach(() => app.close())

  it('返回视频标题联想，type 为 video', async () => {
    mockEs.search
      .mockResolvedValueOnce(
        makeEsResponse([{ source: { title: '进击的巨人', title_en: 'Attack on Titan' } }])
      )
      .mockResolvedValueOnce(makePeopleEsResponse([], [], []))

    const res = await app.inject({ method: 'GET', url: '/v1/search/suggest?q=进击' })
    expect(res.statusCode).toBe(200)
    const suggestions = res.json().data
    const videoSuggestions = suggestions.filter(
      (s: { type: string }) => s.type === 'video'
    )
    expect(videoSuggestions.length).toBeGreaterThan(0)
    expect(videoSuggestions[0].type).toBe('video')
  })

  it('返回人名联想，type 为 director/actor/writer', async () => {
    mockEs.search
      .mockResolvedValueOnce(makeEsResponse([]))
      .mockResolvedValueOnce(makePeopleEsResponse(['宫崎骏'], ['声优甲'], ['编剧乙']))

    const res = await app.inject({ method: 'GET', url: '/v1/search/suggest?q=宫' })
    expect(res.statusCode).toBe(200)
    const suggestions = res.json().data as Array<{ type: string; text: string }>
    const types = suggestions.map((s) => s.type)
    expect(types).toContain('director')
    expect(types).toContain('actor')
    expect(types).toContain('writer')
  })

  it('联想结果数量不超过 limit 参数', async () => {
    mockEs.search
      .mockResolvedValueOnce(makeEsResponse([{ source: { title: '动漫1' } }]))
      .mockResolvedValueOnce(
        makePeopleEsResponse(['导演A', '导演B'], ['演员C', '演员D'], ['编剧E', '编剧F'])
      )

    const res = await app.inject({ method: 'GET', url: '/v1/search/suggest?q=动&limit=3' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.length).toBeLessThanOrEqual(3)
  })

  it('q 参数缺失 → 422', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/search/suggest' })
    expect(res.statusCode).toBe(422)
  })
})
