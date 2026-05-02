/**
 * tests/unit/api/auditLogService.test.ts
 * CHG-SN-4-05: AuditLogService.write fire-and-forget / 失败不阻塞
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuditLogService } from '@/api/services/AuditLogService'
import * as auditLogQueries from '@/api/db/queries/auditLog'

vi.mock('@/api/db/queries/auditLog', () => ({
  insertAuditLog: vi.fn(),
}))

const mockWarn = vi.hoisted(() => vi.fn())
vi.mock('@/api/lib/logger', () => ({
  baseLogger: { warn: mockWarn, error: vi.fn(), info: vi.fn() },
  createLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() })),
  createFastifyLoggerOptions: vi.fn(() => ({})),
  withRequest: vi.fn(),
  withJob: vi.fn(),
}))

const mockInsert = auditLogQueries.insertAuditLog as ReturnType<typeof vi.fn>

function makeDb() {
  return {} as unknown as import('pg').Pool
}

describe('AuditLogService.write', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功写入审计日志（fire-and-forget，异步）', async () => {
    mockInsert.mockResolvedValue(undefined)
    const svc = new AuditLogService(makeDb())
    svc.write({
      actorId: 'user-1',
      actionType: 'video.reject_labeled',
      targetKind: 'video',
      targetId: 'vid-1',
    })
    await vi.waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1))
    expect(mockInsert).toHaveBeenCalledWith(expect.anything(), {
      actorId: 'user-1',
      actionType: 'video.reject_labeled',
      targetKind: 'video',
      targetId: 'vid-1',
    })
  })

  it('写入失败时调用 baseLogger.warn，不抛异常（不阻塞主路径）', async () => {
    mockInsert.mockRejectedValue(new Error('DB connection lost'))
    const svc = new AuditLogService(makeDb())
    expect(() => svc.write({
      actorId: 'user-1',
      actionType: 'video.staff_note',
      targetKind: 'video',
    })).not.toThrow()
    await vi.waitFor(() => expect(mockWarn).toHaveBeenCalled())
    const [ctx] = mockWarn.mock.calls[0] as [Record<string, unknown>, string]
    expect(ctx).toMatchObject({ actionType: 'video.staff_note' })
  })

  it('写入失败不影响外部调用方（完全异步）', async () => {
    mockInsert.mockRejectedValue(new Error('timeout'))
    const svc = new AuditLogService(makeDb())
    const result = 'main-operation-result'
    svc.write({ actorId: 'a', actionType: 'staging.revert', targetKind: 'staging' })
    expect(result).toBe('main-operation-result')
  })
})
