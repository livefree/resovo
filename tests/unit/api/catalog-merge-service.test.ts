/**
 * catalog-merge-service.test.ts — CatalogMergeService 守卫与输入校验（CHG-VIR-12-F）
 * 合并/回滚主体行为由 dev 真实 DB 往返实测覆盖（changelog 留档）；本文件测前置守卫：
 * R10 快照表齐全阻断 / loser=survivor 拒绝 / 行缺失阻断 / 重复回滚阻断。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CatalogMergeService } from '@/api/services/CatalogMergeService'

const mockClientQuery = vi.fn()
const mockClient = { query: mockClientQuery, release: vi.fn() }
const mockDb = {
  query: vi.fn(),
  connect: vi.fn().mockResolvedValue(mockClient),
} as unknown as import('pg').Pool

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(mockDb.connect).mockResolvedValue(mockClient as never)
  mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 })
})

describe('CatalogMergeService.merge 前置守卫', () => {
  it('loser === survivor → 拒绝（不连接 DB）', async () => {
    const svc = new CatalogMergeService(mockDb)
    await expect(svc.merge('same-id', 'same-id', 'op')).rejects.toThrow(/不得相同/)
    expect(mockDb.connect).not.toHaveBeenCalled()
  })

  it('快照表缺失 → R10 前向守卫阻断（绝不带病合并）+ ROLLBACK', async () => {
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('information_schema.tables')) return { rows: [{ n: '7' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })
    const svc = new CatalogMergeService(mockDb)
    await expect(svc.merge('a', 'b', 'op')).rejects.toThrow(/快照表缺失.*migration 092/)
    expect(mockClientQuery.mock.calls.map((c) => String(c[0]))).toContain('ROLLBACK')
  })

  it('loser/survivor 行缺失 → 阻断 + ROLLBACK（命中 1/2）', async () => {
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('information_schema.tables')) return { rows: [{ n: '11' }], rowCount: 1 }
      if (String(sql).includes('SELECT id FROM media_catalog')) return { rows: [{ id: 'a' }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })
    const svc = new CatalogMergeService(mockDb)
    await expect(svc.merge('a', 'b', 'op')).rejects.toThrow(/行缺失（命中 1\/2）/)
    expect(mockClientQuery.mock.calls.map((c) => String(c[0]))).toContain('ROLLBACK')
  })
})

describe('CatalogMergeService.rollback 前置守卫', () => {
  it('merge_op 不存在 → 阻断', async () => {
    const svc = new CatalogMergeService(mockDb)
    await expect(svc.rollback('nonexistent')).rejects.toThrow(/不存在/)
  })

  it('已回滚的 op → 重复回滚阻断（防双重复活）', async () => {
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM _bak_catalog_merge_ops_092')) {
        return {
          rows: [{
            loser_catalog_id: 'a', survivor_catalog_id: 'b',
            survivor_cache_snapshot: {}, rolled_back_at: '2026-06-04T00:00:00Z',
          }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })
    const svc = new CatalogMergeService(mockDb)
    await expect(svc.rollback('op-1')).rejects.toThrow(/已于 .* 回滚/)
    expect(mockClientQuery.mock.calls.map((c) => String(c[0]))).toContain('ROLLBACK')
  })
})
