/**
 * tests/unit/api/externalResourcesStats.test.ts
 * CHG-EXT-RES-API-A（ADR-188 D-188-5）：治理概览聚合 query。
 *   getDoubanDataScale（双 COUNT 解析）/ aggregateExternalRefMatch（byStatus/byMethod 映射 + NULL→(unknown)）。
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { getDoubanDataScale, aggregateExternalRefMatch } from '@/api/db/queries/external-resources-stats'

describe('getDoubanDataScale', () => {
  it('解析 collection_items + douban_entries 双 COUNT', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ collection_items: '1294', douban_entries: '140000' }] })
    const db = { query } as unknown as Pool
    const scale = await getDoubanDataScale(db)
    expect(scale).toEqual({ collectionItems: 1294, doubanEntries: 140000 })
    expect(String(query.mock.calls[0][0])).toContain('douban_collection_items')
    expect(String(query.mock.calls[0][0])).toContain('douban_entries')
  })
})

describe('aggregateExternalRefMatch', () => {
  it('按 provider 聚合 total + byStatus + byMethod；NULL method → (unknown)', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: '12' }] }) // total
      .mockResolvedValueOnce({ rows: [{ key: 'auto_matched', count: '8' }, { key: 'candidate', count: '4' }] }) // byStatus
      .mockResolvedValueOnce({ rows: [{ key: 'imdb_id', count: '6' }, { key: null, count: '2' }] }) // byMethod (含 NULL)
    const db = { query } as unknown as Pool

    const stats = await aggregateExternalRefMatch(db, 'douban')
    expect(stats.total).toBe(12)
    expect(stats.byStatus).toEqual([{ key: 'auto_matched', count: 8 }, { key: 'candidate', count: 4 }])
    expect(stats.byMethod).toEqual([{ key: 'imdb_id', count: 6 }, { key: '(unknown)', count: 2 }])
    // 三查询均带 provider 参数
    for (const call of query.mock.calls) expect(call[1]).toEqual(['douban'])
  })
})
