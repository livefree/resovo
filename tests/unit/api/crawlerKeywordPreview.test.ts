/**
 * tests/unit/api/crawlerKeywordPreview.test.ts
 * CRAWLER-03: 关键词搜索预览模式测试
 * 覆盖：previewKeywordSearch 各站点结果聚合、类型过滤、sourceStatus 探测、站点错误处理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CrawlerSource } from '@/api/services/CrawlerService'

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))
vi.mock('@/api/lib/config', () => ({
  config: { DATABASE_URL: 'postgres://test', AUTO_PUBLISH_CRAWLED: 'false' },
}))

// ── 测试数据 ────────────────────────────────────────────────────────

const MOCK_SOURCE: CrawlerSource = {
  name: 'site-a',
  base: 'https://a.example.com',
  format: 'json',
}

const MOCK_PARSED_VIDEO = {
  video: {
    title: '星际穿越',
    year: 2014,
    type: 'movie',
    titleEn: 'Interstellar',
  },
  sources: [
    { episodeNumber: 1, sourceUrl: 'https://cdn.a.com/ep1.mp4', sourceName: 'site-a', type: 'mp4' },
  ],
}

// ── Tests ──────────────────────────────────────────────────────────

describe('CrawlerPreviewService.previewKeywordSearch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('返回各站点匹配视频列表（含 siteKey 和 sourceStatus）', async () => {
    const { CrawlerPreviewService } = await import('@/api/services/CrawlerPreviewService')

    const svc = new CrawlerPreviewService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    // Mock fetchPage to return parsed items
    vi.spyOn(svc as unknown as { fetchPage: (s: CrawlerSource, opts?: unknown) => Promise<typeof MOCK_PARSED_VIDEO[]> }, 'fetchPage')
      .mockResolvedValue([MOCK_PARSED_VIDEO])

    // Mock fetch for HEAD probe
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })

    const results = await svc.previewKeywordSearch('星际穿越', [MOCK_SOURCE])

    expect(results).toHaveLength(1)
    expect(results[0].siteKey).toBe('site-a')
    expect(results[0].error).toBeNull()
    expect(results[0].items).toHaveLength(1)
    expect(results[0].items[0].title).toBe('星际穿越')
    expect(results[0].items[0].sourceStatus).toBe('ok')
    expect(results[0].items[0].siteKey).toBe('site-a')
  })

  it('type 过滤：只返回匹配类型的视频', async () => {
    const { CrawlerPreviewService } = await import('@/api/services/CrawlerPreviewService')
    const svc = new CrawlerPreviewService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    const seriesVideo = { ...MOCK_PARSED_VIDEO, video: { ...MOCK_PARSED_VIDEO.video, type: 'series' } }

    vi.spyOn(svc as unknown as { fetchPage: (s: CrawlerSource, opts?: unknown) => Promise<unknown[]> }, 'fetchPage')
      .mockResolvedValue([MOCK_PARSED_VIDEO, seriesVideo])

    global.fetch = vi.fn().mockResolvedValue({ ok: true })

    const results = await svc.previewKeywordSearch('搜索词', [MOCK_SOURCE], 'movie')

    expect(results[0].items).toHaveLength(1)
    expect(results[0].items[0].type).toBe('movie')
  })

  it('source HEAD 探测超时时 sourceStatus=timeout', async () => {
    const { CrawlerPreviewService } = await import('@/api/services/CrawlerPreviewService')
    const svc = new CrawlerPreviewService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    vi.spyOn(svc as unknown as { fetchPage: (s: CrawlerSource, opts?: unknown) => Promise<unknown[]> }, 'fetchPage')
      .mockResolvedValue([MOCK_PARSED_VIDEO])

    // Simulate timeout
    global.fetch = vi.fn().mockRejectedValue(new DOMException('signal timed out', 'TimeoutError'))

    const results = await svc.previewKeywordSearch('keyword', [MOCK_SOURCE])

    expect(results[0].items[0].sourceStatus).toBe('timeout')
  })

  it('source HEAD 请求返回 4xx 时 sourceStatus=error', async () => {
    const { CrawlerPreviewService } = await import('@/api/services/CrawlerPreviewService')
    const svc = new CrawlerPreviewService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    vi.spyOn(svc as unknown as { fetchPage: (s: CrawlerSource, opts?: unknown) => Promise<unknown[]> }, 'fetchPage')
      .mockResolvedValue([MOCK_PARSED_VIDEO])

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })

    const results = await svc.previewKeywordSearch('keyword', [MOCK_SOURCE])

    expect(results[0].items[0].sourceStatus).toBe('error')
  })

  it('站点请求失败时返回 error 字段而非抛出异常', async () => {
    const { CrawlerPreviewService } = await import('@/api/services/CrawlerPreviewService')
    const svc = new CrawlerPreviewService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    vi.spyOn(svc as unknown as { fetchPage: (s: CrawlerSource, opts?: unknown) => Promise<unknown[]> }, 'fetchPage')
      .mockRejectedValue(new Error('HTTP 503'))

    const results = await svc.previewKeywordSearch('keyword', [MOCK_SOURCE])

    expect(results[0].items).toHaveLength(0)
    expect(results[0].error).toBe('HTTP 503')
  })

  it('sourceUrl 为空时 sourceStatus=unknown', async () => {
    const { CrawlerPreviewService } = await import('@/api/services/CrawlerPreviewService')
    const svc = new CrawlerPreviewService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    const noSourceVideo = { ...MOCK_PARSED_VIDEO, sources: [] }
    vi.spyOn(svc as unknown as { fetchPage: (s: CrawlerSource, opts?: unknown) => Promise<unknown[]> }, 'fetchPage')
      .mockResolvedValue([noSourceVideo])

    global.fetch = vi.fn()

    const results = await svc.previewKeywordSearch('keyword', [MOCK_SOURCE])

    expect(results[0].items[0].sourceStatus).toBe('unknown')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('多站点搜索：每个站点独立返回结果', async () => {
    const { CrawlerPreviewService } = await import('@/api/services/CrawlerPreviewService')
    const svc = new CrawlerPreviewService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)

    const sourceB: CrawlerSource = { name: 'site-b', base: 'https://b.example.com', format: 'xml' }

    vi.spyOn(svc as unknown as { fetchPage: (s: CrawlerSource, opts?: unknown) => Promise<unknown[]> }, 'fetchPage')
      .mockResolvedValueOnce([MOCK_PARSED_VIDEO])  // site-a
      .mockResolvedValueOnce([])                    // site-b empty

    global.fetch = vi.fn().mockResolvedValue({ ok: true })

    const results = await svc.previewKeywordSearch('keyword', [MOCK_SOURCE, sourceB])

    expect(results).toHaveLength(2)
    expect(results[0].siteKey).toBe('site-a')
    expect(results[0].items).toHaveLength(1)
    expect(results[1].siteKey).toBe('site-b')
    expect(results[1].items).toHaveLength(0)
  })
})
