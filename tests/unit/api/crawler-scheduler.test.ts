import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockMarkTimedOutRunningTasksWithRunIds = vi.fn()
const mockMarkStaleHeartbeatRunningTasksWithRunIds = vi.fn()
const mockSyncRunStatusFromTasks = vi.fn()
const mockListActiveRunIds = vi.fn()

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
  listActiveRunIds: mockListActiveRunIds,
}))

vi.mock('@/api/services/CrawlerRunService', () => ({
  CrawlerRunService: vi.fn().mockImplementation(() => ({
    createAndEnqueueRun: vi.fn(),
  })),
}))

describe('crawlerScheduler watchdog sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认无活跃 run，避免测试间干扰
    mockListActiveRunIds.mockResolvedValue([])
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

    // 受影响 run（去重后 3 个）均被 sync
    expect(mockSyncRunStatusFromTasks).toHaveBeenCalledWith(expect.any(Object), 'run-1')
    expect(mockSyncRunStatusFromTasks).toHaveBeenCalledWith(expect.any(Object), 'run-2')
    expect(mockSyncRunStatusFromTasks).toHaveBeenCalledWith(expect.any(Object), 'run-3')
  })

  it('does not sync stale runs when watchdog marks nothing, but still syncs active runs', async () => {
    mockMarkTimedOutRunningTasksWithRunIds.mockResolvedValue({ count: 0, runIds: [] })
    mockMarkStaleHeartbeatRunningTasksWithRunIds.mockResolvedValue({ count: 0, runIds: [] })
    mockListActiveRunIds.mockResolvedValue(['run-active-1'])

    const { runTimeoutWatchdogTick } = await import('@/api/workers/crawlerScheduler')
    await runTimeoutWatchdogTick()

    // 仅 active run 被 sync
    expect(mockSyncRunStatusFromTasks).toHaveBeenCalledTimes(1)
    expect(mockSyncRunStatusFromTasks).toHaveBeenCalledWith(expect.any(Object), 'run-active-1')
  })

  it('does not call syncRunStatusFromTasks when there are no affected or active runs', async () => {
    mockMarkTimedOutRunningTasksWithRunIds.mockResolvedValue({ count: 0, runIds: [] })
    mockMarkStaleHeartbeatRunningTasksWithRunIds.mockResolvedValue({ count: 0, runIds: [] })
    mockListActiveRunIds.mockResolvedValue([])

    const { runTimeoutWatchdogTick } = await import('@/api/workers/crawlerScheduler')
    await runTimeoutWatchdogTick()

    expect(mockSyncRunStatusFromTasks).not.toHaveBeenCalled()
  })

  it('deduplicates sync calls when affected run is also in active runs', async () => {
    mockMarkTimedOutRunningTasksWithRunIds.mockResolvedValue({ count: 1, runIds: ['run-x'] })
    mockMarkStaleHeartbeatRunningTasksWithRunIds.mockResolvedValue({ count: 0, runIds: [] })
    // run-x 出现在 active 列表中（理论上已被标记但 DB 尚未反映）
    mockListActiveRunIds.mockResolvedValue(['run-x', 'run-y'])

    const { runTimeoutWatchdogTick } = await import('@/api/workers/crawlerScheduler')
    await runTimeoutWatchdogTick()

    // run-x 被 affected sync 调用一次，再被 active sync 调用一次；run-y 被调用一次
    const calls = mockSyncRunStatusFromTasks.mock.calls.map((c) => c[1] as string)
    expect(calls).toContain('run-x')
    expect(calls).toContain('run-y')
  })
})
