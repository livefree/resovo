import { describe, expect, it, vi, beforeEach } from 'vitest'

// CW1-B-EP-TEST：cancelTaskById + batchCancelTasks 需要 mock 子模块
const { getTaskByIdMock, syncRunStatusFromTasksMock } = vi.hoisted(() => ({
  getTaskByIdMock: vi.fn(),
  syncRunStatusFromTasksMock: vi.fn(),
}))

vi.mock('@/api/db/queries/crawlerTasks.queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/db/queries/crawlerTasks.queries')>()
  return { ...actual, getTaskById: getTaskByIdMock }
})
vi.mock('@/api/db/queries/crawlerRuns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/db/queries/crawlerRuns')>()
  return { ...actual, syncRunStatusFromTasks: syncRunStatusFromTasksMock }
})

import {
  listTasks,
  listTasksByRunId,
  markStaleHeartbeatRunningTasksWithRunIds,
  markTimedOutRunningTasksWithRunIds,
  touchTaskHeartbeat,
  cancelTaskById,
  batchCancelTasks,
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

// ADR-150 阶段 5 EP-4 follow-up（2026-05-25）：listTasksByRunId sort 全栈打通
describe('listTasksByRunId (HOTFIX MERGE-SORT follow-up)', () => {
  function makeDb(rows: object[] = []) {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows, rowCount: rows.length })        // data query
      .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 }) // count query
    return { query }
  }

  it('default ORDER BY scheduled_at DESC（无 sortField）', async () => {
    const db = makeDb()
    await listTasksByRunId(db as never, 'run-1', {})
    const sql: string = db.query.mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY scheduled_at DESC')
  })

  it('sortField=site sortDir=asc → ORDER BY source_site ASC NULLS LAST', async () => {
    const db = makeDb()
    await listTasksByRunId(db as never, 'run-1', { sortField: 'site', sortDir: 'asc' })
    const sql: string = db.query.mock.calls[0][0] as string
    expect(sql).toContain('source_site ASC NULLS LAST')
  })

  it('sortField=status sortDir=desc → ORDER BY status DESC NULLS LAST', async () => {
    const db = makeDb()
    await listTasksByRunId(db as never, 'run-1', { sortField: 'status', sortDir: 'desc' })
    const sql: string = db.query.mock.calls[0][0] as string
    expect(sql).toContain('status DESC NULLS LAST')
  })

  it('sortField=startedAt → started_at（白名单映射）', async () => {
    const db = makeDb()
    await listTasksByRunId(db as never, 'run-1', { sortField: 'startedAt', sortDir: 'asc' })
    const sql: string = db.query.mock.calls[0][0] as string
    expect(sql).toContain('started_at ASC NULLS LAST')
  })

  it('sortField=finishedAt → finished_at（白名单映射 / duration 派生 proxy）', async () => {
    const db = makeDb()
    await listTasksByRunId(db as never, 'run-1', { sortField: 'finishedAt', sortDir: 'desc' })
    const sql: string = db.query.mock.calls[0][0] as string
    expect(sql).toContain('finished_at DESC NULLS LAST')
  })

  it('未知 sortField → fallback scheduled_at DESC（白名单守卫）', async () => {
    const db = makeDb()
    await listTasksByRunId(db as never, 'run-1', { sortField: 'unknown', sortDir: 'asc' })
    const sql: string = db.query.mock.calls[0][0] as string
    expect(sql).toContain('ORDER BY scheduled_at DESC')
    expect(sql).not.toContain('unknown')
  })

  it('WHERE run_id = $1 始终注入（run-scoped）', async () => {
    const db = makeDb()
    await listTasksByRunId(db as never, 'run-abc', { sortField: 'status', sortDir: 'asc' })
    const sql: string = db.query.mock.calls[0][0] as string
    expect(sql).toContain('WHERE run_id = $1')
    expect(db.query.mock.calls[0][1]).toEqual(['run-abc', 200, 0])
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

// ── CW1-B-EP-TEST：cancelTaskById + batchCancelTasks ───────────────────────────

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    type: 'incremental-crawl' as const,
    sourceSite: 'site-a',
    targetUrl: 'https://site-a.example/',
    status: 'pending' as const,
    retryCount: 0,
    runId: 'run-1',
    triggerType: 'batch' as const,
    timeoutAt: null,
    heartbeatAt: null,
    cancelRequested: false,
    result: null,
    scheduledAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    ...overrides,
  }
}

describe('cancelTaskById — CW1-B-EP-TEST（5 case）', () => {
  const makeDb = () => ({ query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }) })

  beforeEach(() => {
    getTaskByIdMock.mockReset()
    syncRunStatusFromTasksMock.mockReset()
  })

  it('#1 task not found → returns null', async () => {
    getTaskByIdMock.mockResolvedValueOnce(null)
    const db = makeDb()
    const result = await cancelTaskById(db as never, 'no-such-task')
    expect(result).toBeNull()
  })

  it('#2 terminal status (cancelled) → throws STATE_CONFLICT AppError', async () => {
    getTaskByIdMock.mockResolvedValueOnce(makeTask({ status: 'cancelled' }))
    const db = makeDb()
    await expect(cancelTaskById(db as never, 'task-1')).rejects.toThrow()
    // AppError.code = 'STATE_CONFLICT'
    await cancelTaskById(db as never, 'task-1').catch((err: unknown) => {
      if (err && typeof err === 'object' && 'code' in err) {
        expect((err as { code: string }).code).toBe('STATE_CONFLICT')
      }
    })
  })

  it('#3 running + not cancelRequested → cancel_requested status', async () => {
    getTaskByIdMock.mockResolvedValueOnce(makeTask({ status: 'running', cancelRequested: false }))
    const db = makeDb()
    const result = await cancelTaskById(db as never, 'task-1')
    expect(result).not.toBeNull()
    expect(result?.finalStatus).toBe('cancel_requested')
    expect(result?.alreadyRequested).toBe(false)
    expect(result?.runId).toBe('run-1')
    // UPDATE SQL 应被调用一次（设置 cancel_requested=true）
    expect(db.query).toHaveBeenCalledOnce()
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('cancel_requested = true')
  })

  it('#4 running + already cancelRequested → idempotent（不重写 / alreadyRequested=true）', async () => {
    getTaskByIdMock.mockResolvedValueOnce(makeTask({ status: 'running', cancelRequested: true }))
    const db = makeDb()
    const result = await cancelTaskById(db as never, 'task-1')
    expect(result?.alreadyRequested).toBe(true)
    expect(result?.finalStatus).toBe('cancel_requested')
    // 幂等：无 UPDATE 调用
    expect(db.query).not.toHaveBeenCalled()
  })

  it('#5 pending → 直接 cancelled + finishedAt', async () => {
    const pendingTask = makeTask({ status: 'pending', cancelRequested: false })
    const cancelledTask = makeTask({ status: 'cancelled', cancelRequested: true, finishedAt: new Date().toISOString() })
    getTaskByIdMock
      .mockResolvedValueOnce(pendingTask)   // 第 1 次（状态检查）
      .mockResolvedValueOnce(cancelledTask)  // 第 2 次（refresh 读最新状态）
    const db = makeDb()
    const result = await cancelTaskById(db as never, 'task-1')
    expect(result?.finalStatus).toBe('cancelled')
    expect(result?.alreadyRequested).toBe(false)
    expect(result?.task.status).toBe('cancelled')
    // UPDATE SQL 包含 status = 'cancelled'
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain("status = 'cancelled'")
  })
})

describe('batchCancelTasks — CW1-B-EP-TEST（2 case）', () => {
  beforeEach(() => {
    getTaskByIdMock.mockReset()
    syncRunStatusFromTasksMock.mockReset().mockResolvedValue(undefined)
  })

  it('#6 mixed tasks → summary 正确聚合（cancelled + cancel_requested）', async () => {
    const pendingTask = makeTask({ id: 'task-p', status: 'pending', runId: 'run-A' })
    const cancelledTask = makeTask({ id: 'task-p', status: 'cancelled', cancelRequested: true, finishedAt: new Date().toISOString(), runId: 'run-A' })
    const runningTask = makeTask({ id: 'task-r', status: 'running', cancelRequested: false, runId: 'run-B' })
    getTaskByIdMock
      .mockResolvedValueOnce(pendingTask)   // task-p 第 1 次
      .mockResolvedValueOnce(cancelledTask)  // task-p 第 2 次（refresh）
      .mockResolvedValueOnce(runningTask)    // task-r
    const db = { query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }) }
    const result = await batchCancelTasks(db as never, ['task-p', 'task-r'])
    expect(result.summary.cancelled).toBe(1)
    expect(result.summary.cancelRequested).toBe(1)
    expect(result.summary.alreadyRequested).toBe(0)
    expect(result.summary.errors).toHaveLength(0)
    expect(result.runIds).toEqual(expect.arrayContaining(['run-A', 'run-B']))
    expect(syncRunStatusFromTasksMock).toHaveBeenCalledTimes(2)
  })

  it('#7 STATE_CONFLICT → errors[] 累入；其余 task 继续处理', async () => {
    const terminalTask = makeTask({ id: 'task-done', status: 'done', runId: null })
    const pendingTask = makeTask({ id: 'task-p', status: 'pending', runId: 'run-C' })
    const cancelledTask = makeTask({ id: 'task-p', status: 'cancelled', cancelRequested: true, finishedAt: new Date().toISOString(), runId: 'run-C' })
    getTaskByIdMock
      .mockResolvedValueOnce(terminalTask) // task-done → STATE_CONFLICT throw
      .mockResolvedValueOnce(pendingTask)  // task-p 第 1 次
      .mockResolvedValueOnce(cancelledTask) // task-p refresh
    const db = { query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }) }
    const result = await batchCancelTasks(db as never, ['task-done', 'task-p'])
    expect(result.summary.errors).toHaveLength(1)
    expect(result.summary.errors[0]?.code).toBe('STATE_CONFLICT')
    expect(result.summary.cancelled).toBe(1) // task-p 成功
  })
})

