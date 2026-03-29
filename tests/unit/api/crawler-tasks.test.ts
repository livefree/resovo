import { describe, expect, it, vi } from 'vitest'

import {
  listTasks,
  markStaleHeartbeatRunningTasksWithRunIds,
  markTimedOutRunningTasksWithRunIds,
  touchTaskHeartbeat,
} from '@/api/db/queries/crawlerTasks'

const EMPTY_DB_RESULT = { rows: [], rowCount: 0 }

describe('listTasks', () => {
  function makeDb(rows: object[] = []) {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows, rowCount: rows.length })        // data query
      .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 }) // count query
    return { query }
  }

  it('uses default ORDER BY scheduled_at DESC when no sortField', async () => {
    const db = makeDb()
    await listTasks(db as never, {})
    const sql: string = db.query.mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY scheduled_at DESC')
  })

  it('maps sortField=startedAt to started_at ASC', async () => {
    const db = makeDb()
    await listTasks(db as never, { sortField: 'startedAt', sortDir: 'asc' })
    const sql: string = db.query.mock.calls[0][0] as string
    expect(sql).toContain('started_at ASC NULLS LAST')
  })

  it('maps sortField=site to source_site DESC', async () => {
    const db = makeDb()
    await listTasks(db as never, { sortField: 'site', sortDir: 'desc' })
    const sql: string = db.query.mock.calls[0][0] as string
    expect(sql).toContain('source_site DESC NULLS LAST')
  })

  it('falls back to scheduled_at DESC for unknown sortField', async () => {
    const db = makeDb()
    await listTasks(db as never, { sortField: 'unknown_field', sortDir: 'asc' })
    const sql: string = db.query.mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY scheduled_at DESC')
    expect(sql).not.toContain('unknown_field')
  })
})

describe('crawlerTasks query helpers', () => {
  // keep unused var lint-quiet
  void EMPTY_DB_RESULT
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

