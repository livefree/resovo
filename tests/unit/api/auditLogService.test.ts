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

const mockInsert = auditLogQueries.insertAuditLog as ReturnType<typeof vi.fn>

function makeDb() {
  return {} as unknown as import('pg').Pool
}

describe('AuditLogService.write', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
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

  it('写入失败时写 stderr，不抛异常（不阻塞主路径）', async () => {
    mockInsert.mockRejectedValue(new Error('DB connection lost'))
    const svc = new AuditLogService(makeDb())
    expect(() => svc.write({
      actorId: 'user-1',
      actionType: 'video.staff_note',
      targetKind: 'video',
    })).not.toThrow()
    await vi.waitFor(() => expect(process.stderr.write).toHaveBeenCalled())
    const output = (process.stderr.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(output).toContain('video.staff_note')
    expect(output).toContain('DB connection lost')
  })

  it('写入失败不影响外部调用方（完全异步）', async () => {
    mockInsert.mockRejectedValue(new Error('timeout'))
    const svc = new AuditLogService(makeDb())
    const result = 'main-operation-result'
    svc.write({ actorId: 'a', actionType: 'staging.revert', targetKind: 'staging' })
    expect(result).toBe('main-operation-result')
  })
})
