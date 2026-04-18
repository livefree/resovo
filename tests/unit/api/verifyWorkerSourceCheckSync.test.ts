/**
 * tests/unit/api/verifyWorkerSourceCheckSync.test.ts
 * CHG-404: verifyWorker 完成后即时同步 source_check_status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks（factory 内不引用外部变量，避免 hoisting 问题）──────────

vi.mock('@/api/lib/queue', () => ({
  verifyQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
}))

vi.mock('@/api/lib/postgres', () => ({
  db: { query: vi.fn() },
}))

vi.mock('@/api/db/queries/sources', () => ({
  updateSourceActiveStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/db/queries/videos', () => ({
  syncSourceCheckStatusFromSources: vi.fn().mockResolvedValue(undefined),
}))

// ── 延迟导入（mocks 已就绪后再 import）────────────────────────────

import { registerVerifyWorker } from '@/api/workers/verifyWorker'
import { verifyQueue } from '@/api/lib/queue'
import { db } from '@/api/lib/postgres'
import { updateSourceActiveStatus } from '@/api/db/queries/sources'
import { syncSourceCheckStatusFromSources } from '@/api/db/queries/videos'

const mockVerifyProcess = verifyQueue.process as ReturnType<typeof vi.fn>
const mockDbQuery = db.query as ReturnType<typeof vi.fn>
const mockUpdateSourceActiveStatus = updateSourceActiveStatus as ReturnType<typeof vi.fn>
const mockSyncSourceCheckStatus = syncSourceCheckStatusFromSources as ReturnType<typeof vi.fn>

// ── Helpers ───────────────────────────────────────────────────────

function makeJob(overrides: Partial<{ sourceId: string; url: string }> = {}) {
  return {
    data: {
      type: 'verify-source',
      sourceId: 'src-1',
      url: 'https://cdn.example.com/ep1.m3u8',
      ...overrides,
    },
  }
}

// ── Tests ─────────────────────────────────────────────────────────

describe('verifyWorker — source_check_status 即时同步', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyProcess.mockImplementation(() => undefined)
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch
  })

  async function getWorkerHandler() {
    registerVerifyWorker(1)
    // registerVerifyWorker 调用 verifyQueue.process(concurrency, handler)
    const calls = mockVerifyProcess.mock.calls
    const lastCall = calls[calls.length - 1]
    if (!lastCall) throw new Error('worker handler not registered')
    // process(concurrency, handler) 的第二个参数，或 process(handler) 的第一个参数
    return (typeof lastCall[1] === 'function' ? lastCall[1] : lastCall[0]) as (job: unknown) => Promise<unknown>
  }

  it('验证完成后查 video_id 并调用 syncSourceCheckStatusFromSources', async () => {
    mockDbQuery.mockResolvedValue({ rows: [{ video_id: 'vid-1' }] })

    const handler = await getWorkerHandler()
    await handler(makeJob())

    expect(mockUpdateSourceActiveStatus).toHaveBeenCalledWith(
      expect.anything(),
      'src-1',
      true,
    )
    expect(mockDbQuery).toHaveBeenCalledWith(
      'SELECT video_id FROM video_sources WHERE id = $1',
      ['src-1'],
    )
    expect(mockSyncSourceCheckStatus).toHaveBeenCalledWith(
      expect.anything(),
      'vid-1',
    )
  })

  it('查不到 video_id 时：不调用 syncSourceCheckStatus，不抛异常', async () => {
    mockDbQuery.mockResolvedValue({ rows: [] })

    const handler = await getWorkerHandler()
    await expect(handler(makeJob())).resolves.not.toThrow()
    expect(mockSyncSourceCheckStatus).not.toHaveBeenCalled()
  })

  it('syncSourceCheckStatus 抛异常时：不中断 worker，仍返回正常结果', async () => {
    mockDbQuery.mockResolvedValue({ rows: [{ video_id: 'vid-1' }] })
    mockSyncSourceCheckStatus.mockRejectedValueOnce(new Error('DB error'))

    const handler = await getWorkerHandler()
    const result = await handler(makeJob()) as { sourceId: string; isActive: boolean }
    expect(result.sourceId).toBe('src-1')
    expect(result.isActive).toBe(true)
  })
})
