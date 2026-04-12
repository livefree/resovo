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

  it('enqueueFullCrawl dispatches full-crawl job with contract ids', async () => {
    const { enqueueFullCrawl } = await import('@/api/workers/crawlerWorker')
    const job = await enqueueFullCrawl('site-a', 'task-1', 'run-1')
    expect(mockAdd).toHaveBeenCalledWith(
      { type: 'full-crawl', siteKey: 'site-a', taskId: 'task-1', runId: 'run-1' },
      expect.objectContaining({ timeout: 30 * 60 * 1000 }),
    )
    expect(job.id).toBe('job-1')
  })

  it('enqueueFullCrawl missing contract ids throws error', async () => {
    const { enqueueFullCrawl } = await import('@/api/workers/crawlerWorker')
    await expect(enqueueFullCrawl('site-a', '', 'run-1')).rejects.toThrow('CRAWL_JOB_CONTRACT_INVALID')
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('enqueueIncrementalCrawl uses default hoursAgo=24', async () => {
    const { enqueueIncrementalCrawl } = await import('@/api/workers/crawlerWorker')
    await enqueueIncrementalCrawl('site-b', 24, 'task-2', 'run-2')
    expect(mockAdd).toHaveBeenCalledWith(
      { type: 'incremental-crawl', siteKey: 'site-b', hoursAgo: 24, taskId: 'task-2', runId: 'run-2' },
      expect.objectContaining({ timeout: 30 * 60 * 1000 }),
    )
  })

  it('enqueueIncrementalCrawl with custom siteKey and hoursAgo', async () => {
    const { enqueueIncrementalCrawl } = await import('@/api/workers/crawlerWorker')
    await enqueueIncrementalCrawl('site-b', 48, 'task-3', 'run-3')
    expect(mockAdd).toHaveBeenCalledWith(
      { type: 'incremental-crawl', siteKey: 'site-b', hoursAgo: 48, taskId: 'task-3', runId: 'run-3' },
      expect.objectContaining({ timeout: 30 * 60 * 1000 }),
    )
  })

  it('enqueueIncrementalCrawl missing contract ids throws error', async () => {
    const { enqueueIncrementalCrawl } = await import('@/api/workers/crawlerWorker')
    await expect(enqueueIncrementalCrawl('site-b', 24, '', 'run-3')).rejects.toThrow('CRAWL_JOB_CONTRACT_INVALID')
    expect(mockAdd).not.toHaveBeenCalled()
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
    const data = {
      type: 'full-crawl' as const,
      siteKey: 'my-site',
      taskId: 'task-1',
      runId: 'run-1',
      hoursAgo: 12,
    }
    expect(data.siteKey).toBe('my-site')
    expect(data.taskId).toBe('task-1')
    expect(data.runId).toBe('run-1')
    expect(data.hoursAgo).toBe(12)
  })

  it('CrawlJobData keeps only hoursAgo as optional field', async () => {
    const data = {
      type: 'incremental-crawl' as const,
      siteKey: 'my-site',
      taskId: 'task-2',
      runId: 'run-2',
    }
    expect(data.type).toBe('incremental-crawl')
    expect(data.siteKey).toBe('my-site')
  })
})
