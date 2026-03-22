import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockMarkTimedOutRunningTasksWithRunIds = vi.fn()
const mockMarkStaleHeartbeatRunningTasksWithRunIds = vi.fn()
const mockSyncRunStatusFromTasks = vi.fn()

vi.mock('@/api/lib/postgres', () => ({
  db: { query: vi.fn() },
}))

vi.mock('@/api/db/queries/systemSettings', () => ({
  getSetting: vi.fn(),
  getAutoCrawlConfig: vi.fn(),
  setSetting: vi.fn(),
}))

vi.mock('@/api/db/queries/crawlerTasks', () => ({
  markTimedOutRunningTasksWithRunIds: mockMarkTimedOutRunningTasksWithRunIds,
  markStaleHeartbeatRunningTasksWithRunIds: mockMarkStaleHeartbeatRunningTasksWithRunIds,
}))

vi.mock('@/api/db/queries/crawlerRuns', () => ({
  syncRunStatusFromTasks: mockSyncRunStatusFromTasks,
}))

vi.mock('@/api/services/CrawlerRunService', () => ({
  CrawlerRunService: vi.fn().mockImplementation(() => ({
    createAndEnqueueRun: vi.fn(),
  })),
}))

describe('crawlerScheduler watchdog sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('syncs all affected runs after timeout/stale marking', async () => {
    mockMarkTimedOutRunningTasksWithRunIds.mockResolvedValue({
      count: 2,
      runIds: ['run-1', 'run-2'],
    })
    mockMarkStaleHeartbeatRunningTasksWithRunIds.mockResolvedValue({
      count: 1,
      runIds: ['run-2', 'run-3'],
    })

    const { runTimeoutWatchdogTick } = await import('@/api/workers/crawlerScheduler')
    await runTimeoutWatchdogTick()

    expect(mockSyncRunStatusFromTasks).toHaveBeenCalledTimes(3)
    expect(mockSyncRunStatusFromTasks).toHaveBeenNthCalledWith(1, expect.any(Object), 'run-1')
    expect(mockSyncRunStatusFromTasks).toHaveBeenNthCalledWith(2, expect.any(Object), 'run-2')
    expect(mockSyncRunStatusFromTasks).toHaveBeenNthCalledWith(3, expect.any(Object), 'run-3')
  })

  it('does not sync runs when watchdog marks nothing', async () => {
    mockMarkTimedOutRunningTasksWithRunIds.mockResolvedValue({ count: 0, runIds: [] })
    mockMarkStaleHeartbeatRunningTasksWithRunIds.mockResolvedValue({ count: 0, runIds: [] })

    const { runTimeoutWatchdogTick } = await import('@/api/workers/crawlerScheduler')
    await runTimeoutWatchdogTick()

    expect(mockSyncRunStatusFromTasks).not.toHaveBeenCalled()
  })
})
