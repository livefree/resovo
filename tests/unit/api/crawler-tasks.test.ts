import { describe, expect, it, vi } from 'vitest'

import {
  markStaleHeartbeatRunningTasksWithRunIds,
  markTimedOutRunningTasksWithRunIds,
  touchTaskHeartbeat,
} from '@/api/db/queries/crawlerTasks'

describe('crawlerTasks query helpers', () => {
  it('touchTaskHeartbeat updates heartbeat_at only', async () => {
    const db = {
      query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
    } as unknown as Parameters<typeof touchTaskHeartbeat>[0]

    await touchTaskHeartbeat(db, 'task-1')

    expect((db as { query: ReturnType<typeof vi.fn> }).query).toHaveBeenCalledWith(
      expect.stringContaining('SET heartbeat_at = NOW()'),
      ['task-1'],
    )
  })

  it('markTimedOutRunningTasksWithRunIds returns deduped non-null run ids', async () => {
    const db = {
      query: vi.fn().mockResolvedValue({
        rowCount: 4,
        rows: [
          { run_id: 'run-1' },
          { run_id: 'run-2' },
          { run_id: 'run-2' },
          { run_id: null },
        ],
      }),
    } as unknown as Parameters<typeof markTimedOutRunningTasksWithRunIds>[0]

    const result = await markTimedOutRunningTasksWithRunIds(db)
    expect(result).toEqual({ count: 4, runIds: ['run-1', 'run-2'] })
  })

  it('markStaleHeartbeatRunningTasksWithRunIds forwards staleMinutes parameter', async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ run_id: 'run-3' }],
    })
    const db = { query } as unknown as Parameters<typeof markStaleHeartbeatRunningTasksWithRunIds>[0]

    const result = await markStaleHeartbeatRunningTasksWithRunIds(db, 20)

    expect(result).toEqual({ count: 1, runIds: ['run-3'] })
    expect(query).toHaveBeenCalledWith(expect.stringContaining('staleMinutes'), [20])
  })
})
