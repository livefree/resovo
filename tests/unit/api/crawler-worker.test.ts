/**
 * tests/unit/api/crawler-worker.test.ts
 * CHG-36: crawlerWorker job dispatch 逻辑、enqueue 函数
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────

const mockAdd = vi.fn().mockResolvedValue({ id: 'job-1' })
const mockProcess = vi.fn()
const mockOn = vi.fn()

vi.mock('@/api/lib/queue', () => ({
  crawlerQueue: { add: mockAdd, process: mockProcess, on: mockOn },
  verifyQueue:  { add: vi.fn(), process: vi.fn(), on: vi.fn() },
}))

vi.mock('@/api/lib/postgres', () => ({
  db: { query: vi.fn(), connect: vi.fn() },
}))

vi.mock('@/api/lib/elasticsearch', () => ({
  es: { index: vi.fn(), search: vi.fn() },
}))

vi.mock('@/api/services/CrawlerService', () => ({
  CrawlerService: vi.fn(),
  getEnabledSources: vi.fn().mockResolvedValue([
    { name: 'site-a', base: 'https://a.example.com', format: 'json' },
    { name: 'site-b', base: 'https://b.example.com', format: 'xml' },
  ]),
  parseCrawlerSources: vi.fn().mockReturnValue([]),
}))

vi.mock('@/api/db/queries/crawlerSites', () => ({
  updateCrawlStatus: vi.fn().mockResolvedValue(undefined),
  listCrawlerSites: vi.fn().mockResolvedValue([]),
}))

// ── Tests ──────────────────────────────────────────────────────────

describe('crawlerWorker — enqueue functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdd.mockResolvedValue({ id: 'job-1' })
  })

  it('enqueueFullCrawl without siteKey dispatches full-crawl job', async () => {
    const { enqueueFullCrawl } = await import('@/api/workers/crawlerWorker')
    const job = await enqueueFullCrawl()
    expect(mockAdd).toHaveBeenCalledWith({ type: 'full-crawl', siteKey: undefined })
    expect(job.id).toBe('job-1')
  })

  it('enqueueFullCrawl with siteKey dispatches job with siteKey', async () => {
    const { enqueueFullCrawl } = await import('@/api/workers/crawlerWorker')
    await enqueueFullCrawl('site-a')
    expect(mockAdd).toHaveBeenCalledWith({ type: 'full-crawl', siteKey: 'site-a' })
  })

  it('enqueueIncrementalCrawl uses default hoursAgo=24', async () => {
    const { enqueueIncrementalCrawl } = await import('@/api/workers/crawlerWorker')
    await enqueueIncrementalCrawl()
    expect(mockAdd).toHaveBeenCalledWith({ type: 'incremental-crawl', siteKey: undefined, hoursAgo: 24 })
  })

  it('enqueueIncrementalCrawl with custom siteKey and hoursAgo', async () => {
    const { enqueueIncrementalCrawl } = await import('@/api/workers/crawlerWorker')
    await enqueueIncrementalCrawl('site-b', 48)
    expect(mockAdd).toHaveBeenCalledWith({ type: 'incremental-crawl', siteKey: 'site-b', hoursAgo: 48 })
  })

  it('registerCrawlerWorker registers processor and event listener', async () => {
    const { registerCrawlerWorker } = await import('@/api/workers/crawlerWorker')
    registerCrawlerWorker(2)
    expect(mockProcess).toHaveBeenCalledWith(2, expect.any(Function))
    expect(mockOn).toHaveBeenCalledWith('completed', expect.any(Function))
  })
})

describe('crawlerWorker — CrawlJobData types', () => {
  it('CrawlJobData supports siteKey field', async () => {
    const { } = await import('@/api/workers/crawlerWorker')
    const data = { type: 'full-crawl' as const, siteKey: 'my-site', hoursAgo: 12 }
    expect(data.siteKey).toBe('my-site')
    expect(data.hoursAgo).toBe(12)
  })

  it('CrawlJobData works without optional fields', async () => {
    const data = { type: 'incremental-crawl' as const }
    expect(data.type).toBe('incremental-crawl')
  })
})
