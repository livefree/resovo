/**
 * sourceVerificationService.test.ts — CHG-388
 * 覆盖：孤岛检测、自动下架、补源入队、事件写入、错误隔离
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────

const mockListIslandVideos = vi.fn()
const mockInsertSourceHealthEvent = vi.fn().mockResolvedValue('event-1')
const mockTransitionVideoState = vi.fn()
const mockCreateAndEnqueueRun = vi.fn()

vi.mock('@/api/lib/postgres', () => ({
  db: { query: vi.fn(), connect: vi.fn() },
}))

vi.mock('@/api/lib/elasticsearch', () => ({ es: {} }))

vi.mock('@/api/db/queries/sources', () => ({
  listIslandVideos: (...args: unknown[]) => mockListIslandVideos(...args),
  insertSourceHealthEvent: (...args: unknown[]) => mockInsertSourceHealthEvent(...args),
}))

vi.mock('@/api/db/queries/videos', () => ({
  transitionVideoState: (...args: unknown[]) => mockTransitionVideoState(...args),
}))

vi.mock('@/api/services/CrawlerRunService', () => ({
  CrawlerRunService: vi.fn().mockImplementation(() => ({
    createAndEnqueueRun: (...args: unknown[]) => mockCreateAndEnqueueRun(...args),
  })),
}))

// ── 工具 ──────────────────────────────────────────────────────────

const ISLAND_VIDEO = {
  id: 'v1',
  title: '孤岛测试视频',
  siteKey: 'bilibili',
  reviewStatus: 'approved',
  visibilityStatus: 'public',
  isPublished: true,
  sourceCheckStatus: 'all_dead',
}

async function buildService() {
  const { SourceVerificationService } = await import('@/api/services/SourceVerificationService')
  return new SourceVerificationService({} as never)
}

// ── Tests ──────────────────────────────────────────────────────────

describe('SourceVerificationService.verifyPublishedSources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListIslandVideos.mockResolvedValue([ISLAND_VIDEO])
    mockTransitionVideoState.mockResolvedValue({ id: 'v1', review_status: 'approved', visibility_status: 'internal' })
    mockCreateAndEnqueueRun.mockResolvedValue({ runId: 'run-1', taskIds: [], enqueuedSiteKeys: [], skippedSiteKeys: [] })
  })

  it('正常孤岛视频：unpublish + 写事件 + 入队补源', async () => {
    const svc = await buildService()
    const result = await svc.verifyPublishedSources(10)

    expect(result.unpublished).toBe(1)
    expect(result.refetchEnqueued).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.failed).toBe(0)

    expect(mockTransitionVideoState).toHaveBeenCalledWith(
      expect.anything(),
      'v1',
      expect.objectContaining({ action: 'unpublish' }),
    )
    expect(mockInsertSourceHealthEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ videoId: 'v1', origin: 'island_detected' }),
    )
    expect(mockCreateAndEnqueueRun).toHaveBeenCalledWith(
      expect.objectContaining({ crawlMode: 'source-refetch', targetVideoId: 'v1' }),
    )
  })

  it('无孤岛视频时返回全零', async () => {
    mockListIslandVideos.mockResolvedValue([])
    const svc = await buildService()
    const result = await svc.verifyPublishedSources(10)

    expect(result).toEqual({ unpublished: 0, refetchEnqueued: 0, skipped: 0, failed: 0 })
    expect(mockTransitionVideoState).not.toHaveBeenCalled()
  })

  it('非 approved 状态视频被跳过（skipped++）', async () => {
    mockListIslandVideos.mockResolvedValue([{
      ...ISLAND_VIDEO,
      reviewStatus: 'rejected',
    }])
    const svc = await buildService()
    const result = await svc.verifyPublishedSources(10)

    expect(result.skipped).toBe(1)
    expect(result.unpublished).toBe(0)
    expect(mockTransitionVideoState).not.toHaveBeenCalled()
  })

  it('transitionVideoState 返回 null 时被跳过', async () => {
    mockTransitionVideoState.mockResolvedValue(null)
    const svc = await buildService()
    const result = await svc.verifyPublishedSources(10)

    expect(result.skipped).toBe(1)
    expect(result.unpublished).toBe(0)
  })

  it('补源入队失败时 unpublished 仍计入，refetchEnqueued 不增加', async () => {
    mockCreateAndEnqueueRun.mockRejectedValue(new Error('queue error'))
    const svc = await buildService()
    const result = await svc.verifyPublishedSources(10)

    expect(result.unpublished).toBe(1)
    expect(result.refetchEnqueued).toBe(0)
    expect(result.failed).toBe(0)  // 补源失败不算 failed
  })

  it('transitionVideoState 抛出异常时 failed++，不中断其他视频', async () => {
    const video2 = { ...ISLAND_VIDEO, id: 'v2', title: '第二视频' }
    mockListIslandVideos.mockResolvedValue([ISLAND_VIDEO, video2])
    mockTransitionVideoState
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValue({ id: 'v2' })
    const svc = await buildService()
    const result = await svc.verifyPublishedSources(10)

    expect(result.failed).toBe(1)
    expect(result.unpublished).toBe(1)
  })

  it('使用传入的 batchLimit', async () => {
    const svc = await buildService()
    await svc.verifyPublishedSources(30)

    expect(mockListIslandVideos).toHaveBeenCalledWith(expect.anything(), 30)
  })
})
