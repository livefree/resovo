/**
 * tests/unit/api/crawlerKeyword.test.ts
 * CRAWLER-01: 关键词搜索采集基础设施测试
 * 覆盖：buildApiUrl keyword 参数、crawl() keyword 传递、
 *       CrawlerRunService crawlMode 参数传递、路由 schema 校验
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('@/api/lib/postgres', () => ({ db: {} }))
vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))
vi.mock('@/api/lib/config', () => ({
  config: {
    DATABASE_URL: 'postgres://test',
    AUTO_PUBLISH_CRAWLED: 'false',
  },
}))

vi.mock('@/api/db/queries/crawlerTasks', () => ({
  createTask: vi.fn().mockResolvedValue({ id: 'task-1' }),
  updateTaskStatus: vi.fn().mockResolvedValue(undefined),
  updateTaskProgress: vi.fn().mockResolvedValue(undefined),
  findActiveTaskBySite: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/api/db/queries/crawlerRuns', () => ({
  createRun: vi.fn().mockResolvedValue({
    id: 'run-1',
    crawlMode: 'keyword',
    keyword: 'test',
    targetVideoId: null,
  }),
  setRunEnqueueStats: vi.fn().mockResolvedValue(undefined),
  syncRunStatusFromTasks: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/db/queries/crawlerSites', () => ({
  listEnabledCrawlerSites: vi.fn().mockResolvedValue([
    { key: 'site-a', apiUrl: 'https://a.example.com', format: 'json', ingestPolicy: { allow_auto_publish: false } },
  ]),
  findCrawlerSite: vi.fn().mockResolvedValue({
    key: 'site-a',
    apiUrl: 'https://a.example.com',
    format: 'json',
    disabled: false,
    ingestPolicy: { allow_auto_publish: false },
  }),
  listCrawlerSites: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/api/lib/queue', () => ({
  crawlerQueue: { add: vi.fn().mockResolvedValue({ id: 'job-1' }), process: vi.fn(), on: vi.fn() },
  ensureCrawlerQueueReady: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/db/queries/systemSettings', () => ({
  getAutoCrawlConfig: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/api/workers/crawlerWorker', () => ({
  enqueueFullCrawl: vi.fn().mockResolvedValue({ id: 'job-1' }),
  enqueueIncrementalCrawl: vi.fn().mockResolvedValue({ id: 'job-2' }),
}))

// ── Tests: CrawlerService.buildApiUrl ─────────────────────────────

describe('CrawlerService.buildApiUrl — keyword 参数', () => {
  it('传入 keyword 时 URL 包含 wd=<encoded>', async () => {
    const { CrawlerService } = await import('@/api/services/CrawlerService')
    const svc = new CrawlerService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)
    const url = svc.buildApiUrl('https://example.com', 'json', { keyword: '星际穿越' })
    expect(url).toContain('wd=')
    expect(url).toContain(encodeURIComponent('星际穿越'))
  })

  it('keyword + page 同时存在时均包含在 URL 中', async () => {
    const { CrawlerService } = await import('@/api/services/CrawlerService')
    const svc = new CrawlerService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)
    const url = svc.buildApiUrl('https://example.com', 'json', { keyword: 'avatar', page: 2 })
    expect(url).toContain('wd=avatar')
    expect(url).toContain('pg=2')
  })

  it('不传 keyword 时 URL 不含 wd 参数', async () => {
    const { CrawlerService } = await import('@/api/services/CrawlerService')
    const svc = new CrawlerService({} as import('pg').Pool, {} as import('@elastic/elasticsearch').Client)
    const url = svc.buildApiUrl('https://example.com', 'json', { page: 1 })
    expect(url).not.toContain('wd=')
  })
})

// ── Tests: CrawlJobData 新字段 ─────────────────────────────────────

describe('CrawlJobData — CRAWLER-01 新增字段', () => {
  it('crawlMode / keyword / targetVideoId / previewOnly / targetSiteKeys 均为可选字段', async () => {
    const data: import('@/api/workers/crawlerWorker').CrawlJobData = {
      type: 'full-crawl',
      siteKey: 'site-a',
      taskId: 'task-1',
      runId: 'run-1',
      crawlMode: 'keyword',
      keyword: '刺客信条',
      previewOnly: false,
      targetSiteKeys: ['site-a'],
    }
    expect(data.crawlMode).toBe('keyword')
    expect(data.keyword).toBe('刺客信条')
    expect(data.previewOnly).toBe(false)
  })

  it('source-refetch 模式下 targetVideoId 可填入', () => {
    const data: import('@/api/workers/crawlerWorker').CrawlJobData = {
      type: 'full-crawl',
      siteKey: 'site-a',
      taskId: 'task-1',
      runId: 'run-1',
      crawlMode: 'source-refetch',
      targetVideoId: 'vid-uuid-1234',
    }
    expect(data.crawlMode).toBe('source-refetch')
    expect(data.targetVideoId).toBe('vid-uuid-1234')
  })
})

// ── Tests: CrawlerRunService.createAndEnqueueRun crawlMode 传递 ───

describe('CrawlerRunService.createAndEnqueueRun — crawlMode 参数', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crawlMode=keyword 时传递 keyword 到 createRun', async () => {
    const { CrawlerRunService } = await import('@/api/services/CrawlerRunService')
    const { createRun } = await import('@/api/db/queries/crawlerRuns')

    const svc = new CrawlerRunService({} as import('pg').Pool)
    await svc.createAndEnqueueRun({
      triggerType: 'batch',
      mode: 'incremental',
      siteKeys: ['site-a'],
      crawlMode: 'keyword',
      keyword: '星球大战',
    })

    expect(createRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        crawlMode: 'keyword',
        keyword: '星球大战',
        targetVideoId: null,
      }),
    )
  })

  it('不传 crawlMode 时默认使用 batch', async () => {
    const { CrawlerRunService } = await import('@/api/services/CrawlerRunService')
    const { createRun } = await import('@/api/db/queries/crawlerRuns')

    const svc = new CrawlerRunService({} as import('pg').Pool)
    await svc.createAndEnqueueRun({
      triggerType: 'batch',
      mode: 'incremental',
      siteKeys: ['site-a'],
    })

    expect(createRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ crawlMode: 'batch' }),
    )
  })
})

// ── Tests: CrawlerRefetchService titleSimilarity ──────────────────

describe('titleSimilarity — bigram Dice 相似度', () => {
  it('完全相同的字符串返回 1', async () => {
    const { titleSimilarity } = await import('@/api/services/CrawlerRefetchService')
    expect(titleSimilarity('星际穿越', '星际穿越')).toBe(1)
  })

  it('完全不同的字符串返回 0 或接近 0', async () => {
    const { titleSimilarity } = await import('@/api/services/CrawlerRefetchService')
    const score = titleSimilarity('ABCD', 'WXYZ')
    expect(score).toBeLessThan(0.3)
  })

  it('短字符串（< 2 字符）完全相同时返回 1', async () => {
    const { titleSimilarity } = await import('@/api/services/CrawlerRefetchService')
    expect(titleSimilarity('A', 'A')).toBe(1)
  })

  it('短字符串（< 2 字符）不同时返回 0', async () => {
    const { titleSimilarity } = await import('@/api/services/CrawlerRefetchService')
    expect(titleSimilarity('A', 'B')).toBe(0)
  })
})
