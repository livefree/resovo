/**
 * tests/unit/api/audit-log-queries.test.ts — sub B advisory RR-EP3A-1
 *
 * listAdminAuditLog sort 非白名单字段 fail-fast throw 验证（反 M-SN-8 "假装实现"模式）
 * 范式参考：tests/unit/api/crawler-runs-queries.test.ts #12
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listAdminAuditLog } from '@/api/db/queries/auditLog'
import type { Pool } from 'pg'

const mockQuery = vi.fn()
const mockPool = { query: mockQuery, connect: vi.fn() } as unknown as Pool

beforeEach(() => {
  mockQuery.mockReset()
  // listAdminAuditLog 用 Promise.all 调 2 次（rows + count）/ throw 路径 query 不会被调
  mockQuery.mockResolvedValue({ rows: [{ count: '0' }] })
})

describe('auditLog.listAdminAuditLog (sub B advisory RR-EP3A-1: sort fail-fast)', () => {
  it('#1 sortField 非白名单字段 → throw（反 M-SN-8 假装实现模式）', async () => {
    await expect(
      // @ts-expect-error 故意传非白名单字段触发 throw（运行时 fail-fast 防御）
      listAdminAuditLog(mockPool, { page: 1, limit: 20, sortField: 'actorId', sortDirection: 'asc' }),
    ).rejects.toThrow(/invalid sortField "actorId"/)
  })

  it('#2 sortField=createdAt 白名单字段 → SQL 含 ORDER BY al.created_at ASC', async () => {
    mockQuery
      .mockReset()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
    await listAdminAuditLog(mockPool, { page: 1, limit: 20, sortField: 'createdAt', sortDirection: 'asc' })
    const [dataSql] = mockQuery.mock.calls[0]
    expect(dataSql).toContain('ORDER BY al.created_at ASC, al.id DESC')
  })

  it('#3 无 sortField → fallback al.created_at DESC, al.id DESC', async () => {
    mockQuery
      .mockReset()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
    await listAdminAuditLog(mockPool, { page: 1, limit: 20 })
    const [dataSql] = mockQuery.mock.calls[0]
    expect(dataSql).toContain('ORDER BY al.created_at DESC, al.id DESC')
  })
})
