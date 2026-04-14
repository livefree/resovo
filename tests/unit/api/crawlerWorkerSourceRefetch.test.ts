/**
 * tests/unit/api/crawlerWorkerSourceRefetch.test.ts
 * CHG-399: source-refetch 模式 task 落库完成态
 * 覆盖：processCrawlJob 在 source-refetch 分支结束后调用 updateTaskStatus('done')
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────

const mockUpdateTaskStatus = vi.fn().mockResolvedValue(undefined)
const mockGetTaskById = vi.fn()
const mockTouchTaskHeartbeat = vi.fn().mockResolvedValue(undefined)
const mockSyncRunStatusFromTasks = vi.fn().mockResolvedValue(undefined)
const mockUpdateCrawlStatus = vi.fn().mockResolvedValue(undefined)
const mockListEnabledCrawlerSites = vi.fn()
const mockGetRunById = vi.fn()
const mockCreateCrawlerTaskLog = vi.fn().mockResolvedValue(undefined)
const mockGetSetting = vi.fn().mockResolvedValue(null)
const mockRefetchSourcesForVideo = vi.fn()
const mockInsertSourceHealthEvent = vi.fn().mockResolvedValue('event-id-1')
const mockSyncSourceCheckStatusFromSources = vi.fn().mockResolvedValue(undefined)
const mockTransitionVideoState = vi.fn().mockResolvedValue({ id: 'video-uuid-1234', is_published: true })

const mockAdd = vi.fn().mockResolvedValue({ id: 'job-1' })
const mockProcess = vi.fn()
const mockOn = vi.fn()

vi.mock('@/api/lib/queue', () => ({
  crawlerQueue: { add: mockAdd, process: mockProcess, on: mockOn },
  ensureCrawlerQueueReady: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/lib/postgres', () => ({
  db: { query: vi.fn().mockResolvedValue({ rows: [] }), connect: vi.fn() },
}))

vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))

vi.mock('@/api/lib/config', () => ({
  config: { DATABASE_URL: 'postgres://test', AUTO_PUBLISH_CRAWLED: 'false' },
}))

vi.mock('@/api/services/CrawlerService', () => ({
  CrawlerService: vi.fn().mockImplementation(() => ({
    crawl: vi.fn().mockResolvedValue({ videosUpserted: 0, sourcesUpserted: 0, errors: 0 }),
  })),
}))

vi.mock('@/api/services/CrawlerRefetchService', () => ({
  CrawlerRefetchService: vi.fn().mockImplementation(() => ({
    refetchSourcesForVideo: mockRefetchSourcesForVideo,
  })),
}))

vi.mock('@/api/db/queries/crawlerTasks', () => ({
  getTaskById: mockGetTaskById,
  updateTaskStatus: mockUpdateTaskStatus,
  updateTaskProgress: vi.fn().mockResolvedValue(undefined),
  touchTaskHeartbeat: mockTouchTaskHeartbeat,
  findActiveTaskBySite: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/api/db/queries/crawlerRuns', () => ({
  getRunById: mockGetRunById,
  syncRunStatusFromTasks: mockSyncRunStatusFromTasks,
  updateRunControlStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/db/queries/crawlerSites', () => ({
  listEnabledCrawlerSites: mockListEnabledCrawlerSites,
  updateCrawlStatus: mockUpdateCrawlStatus,
  listCrawlerSites: vi.fn().mockResolvedValue([]),
  findCrawlerSite: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/api/db/queries/crawlerTaskLogs', () => ({
  createCrawlerTaskLog: mockCreateCrawlerTaskLog,
}))

vi.mock('@/api/db/queries/systemSettings', () => ({
  getSetting: mockGetSetting,
  getAutoCrawlConfig: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/api/db/queries/sources', () => ({
  insertSourceHealthEvent: mockInsertSourceHealthEvent,
}))

vi.mock('@/api/db/queries/videos', () => ({
  syncSourceCheckStatusFromSources: mockSyncSourceCheckStatusFromSources,
  transitionVideoState: mockTransitionVideoState,
}))

// ── 工具函数 ────────────────────────────────────────────────────────

function makeJob(data: object) {
  return {
    id: 'job-1',
    data,
    progress: vi.fn().mockResolvedValue(undefined),
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('processCrawlJob — source-refetch 任务落库完成态', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetTaskById.mockResolvedValue({ id: 'task-1', cancelRequested: false })
    mockGetRunById.mockResolvedValue({ id: 'run-1', controlStatus: 'running' })
    mockListEnabledCrawlerSites.mockResolvedValue([
      {
        key: 'site-a',
        apiUrl: 'https://a.example.com',
        format: 'json',
        disabled: false,
        ingestPolicy: { allow_auto_publish: false, source_update: 'replace' },
      },
    ])
    mockRefetchSourcesForVideo.mockResolvedValue({
      sourcesAdded: 3,
      notFound: [],
    })
  })

  it('source-refetch 成功：updateTaskStatus("done") 包含 sourcesUpserted', async () => {
    const { registerCrawlerWorker } = await import('@/api/workers/crawlerWorker')
    registerCrawlerWorker(1)

    // 从 mockProcess 提取 processCrawlJob 函数
    const processFn = mockProcess.mock.calls[0][1] as (job: unknown) => Promise<unknown>

    const job = makeJob({
      type: 'incremental-crawl',
      siteKey: 'site-a',
      taskId: 'task-1',
      runId: 'run-1',
      hoursAgo: 24,
      crawlMode: 'source-refetch',
      targetVideoId: 'video-uuid-1234',
    })

    await processFn(job)

    // updateTaskStatus('done') 必须被调用，且 sourcesUpserted=3
    const doneCalls = mockUpdateTaskStatus.mock.calls.filter(
      (call) => call[2] === 'done'
    )
    expect(doneCalls).toHaveLength(1)
    expect(doneCalls[0][1]).toBe('task-1')
    expect(doneCalls[0][3]).toMatchObject({ sourcesUpserted: 3, videosUpserted: 0 })

    // sourcesAdded > 0 → 写 auto_refetch_success 事件
    expect(mockInsertSourceHealthEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ videoId: 'video-uuid-1234', origin: 'auto_refetch_success' }),
    )

    // P1b: 补源成功后同步 source_check_status 并重新发布
    expect(mockSyncSourceCheckStatusFromSources).toHaveBeenCalledWith(
      expect.anything(),
      'video-uuid-1234',
    )
    expect(mockTransitionVideoState).toHaveBeenCalledWith(
      expect.anything(),
      'video-uuid-1234',
      expect.objectContaining({ action: 'publish', reviewedBy: 'system' }),
    )
  })

  it('source-refetch 成功：syncRunStatusFromTasks 被调用以更新 run 状态', async () => {
    const { registerCrawlerWorker } = await import('@/api/workers/crawlerWorker')
    registerCrawlerWorker(1)

    const processFn = mockProcess.mock.calls[0][1] as (job: unknown) => Promise<unknown>

    await processFn(makeJob({
      type: 'incremental-crawl',
      siteKey: 'site-a',
      taskId: 'task-1',
      runId: 'run-1',
      hoursAgo: 24,
      crawlMode: 'source-refetch',
      targetVideoId: 'video-uuid-1234',
    }))

    expect(mockSyncRunStatusFromTasks).toHaveBeenCalledWith(
      expect.anything(),
      'run-1'
    )
  })

  it('source-refetch notFound：errors 计入 done 结果', async () => {
    mockRefetchSourcesForVideo.mockResolvedValue({
      sourcesAdded: 0,
      notFound: ['site-a'],
    })

    const { registerCrawlerWorker } = await import('@/api/workers/crawlerWorker')
    registerCrawlerWorker(1)

    const processFn = mockProcess.mock.calls[0][1] as (job: unknown) => Promise<unknown>

    await processFn(makeJob({
      type: 'incremental-crawl',
      siteKey: 'site-a',
      taskId: 'task-1',
      runId: 'run-1',
      hoursAgo: 24,
      crawlMode: 'source-refetch',
      targetVideoId: 'video-uuid-1234',
    }))

    const doneCalls = mockUpdateTaskStatus.mock.calls.filter(
      (call) => call[2] === 'done'
    )
    expect(doneCalls).toHaveLength(1)
    expect(doneCalls[0][3]).toMatchObject({ errors: 1 })

    // sourcesAdded = 0 → 写 auto_refetch_failed 事件
    expect(mockInsertSourceHealthEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ videoId: 'video-uuid-1234', origin: 'auto_refetch_failed' }),
    )

    // P1b: 补源失败时不调用 sync/publish
    expect(mockSyncSourceCheckStatusFromSources).not.toHaveBeenCalled()
    expect(mockTransitionVideoState).not.toHaveBeenCalled()
  })

  it('batch 模式：updateTaskStatus("done") 由 CrawlerService.crawl() 内部调用，不重复调用', async () => {
    // batch 模式走 CrawlerService.crawl()，crawl() 内部会调 updateTaskStatus('done')
    // processCrawlJob 的新逻辑只在 source-refetch 模式下触发
    const { CrawlerService } = await import('@/api/services/CrawlerService')
    const mockCrawl = vi.fn().mockImplementation(async (_source: unknown, _opts: unknown) => {
      // 模拟 CrawlerService.crawl() 内部调用 updateTaskStatus('done')
      await mockUpdateTaskStatus(null, 'task-1', 'done', { videosUpserted: 5, sourcesUpserted: 10 })
      return { videosUpserted: 5, sourcesUpserted: 10, errors: 0 }
    })
    ;(CrawlerService as ReturnType<typeof vi.fn>).mockImplementation(() => ({ crawl: mockCrawl }))

    const { registerCrawlerWorker } = await import('@/api/workers/crawlerWorker')
    registerCrawlerWorker(1)

    const processFn = mockProcess.mock.calls[0][1] as (job: unknown) => Promise<unknown>

    await processFn(makeJob({
      type: 'incremental-crawl',
      siteKey: 'site-a',
      taskId: 'task-1',
      runId: 'run-1',
      hoursAgo: 24,
      // 无 crawlMode，默认 batch
    }))

    const doneCalls = mockUpdateTaskStatus.mock.calls.filter(
      (call) => call[2] === 'done'
    )
    // batch 模式只有 crawl() 内部那一次（不重复）
    expect(doneCalls).toHaveLength(1)
  })
})
