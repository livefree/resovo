/**
 * tests/unit/api/externalResourcesBrowse.test.ts
 * CHG-EXT-RES-API-B（ADR-188 D-188-5/6）：dump 搜索 + 合集浏览 query。
 *   searchDoubanEntries（LIKE 转义 + 映射）/ listCollectionItemsPaged（collection 过滤 + 分页）
 *   / listCollectionsSummary（GROUP BY 映射）。
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { searchDoubanEntries } from '@/api/db/queries/externalData'
import { listCollectionItemsPaged, listCollectionsSummary } from '@/api/db/queries/douban-collections'

describe('searchDoubanEntries', () => {
  it('LIKE 通配符 % _ \\ 转义 + rating Number + total', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ douban_id: '1', title: '流浪%地球', year: 2019, rating: '7.9', cover_url: 'x' }] })
    const db = { query } as unknown as Pool
    const res = await searchDoubanEntries(db, '流浪%地_球', 20, 0)
    // 转义后 pattern 含 \% 与 \_
    expect(query.mock.calls[0][1]).toEqual(['%流浪\\%地\\_球%'])
    expect(res.total).toBe(2)
    expect(res.rows[0]).toEqual({ doubanId: '1', title: '流浪%地球', year: 2019, rating: 7.9, coverUrl: 'x' })
  })
})

describe('listCollectionItemsPaged', () => {
  it('带 collection 过滤 → WHERE collection=$1 + LIMIT/OFFSET 后置参数', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: '345' }] })
      .mockResolvedValueOnce({ rows: [{ collection: 'movie_hot_gaia', domain: 'movie', category: 'trending', douban_id: '1', rank: 0, title: 'A', original_title: null, year: 2026, rating_value: '8.2', cover_url: 'x' }] })
    const db = { query } as unknown as Pool
    const res = await listCollectionItemsPaged(db, { collection: 'movie_hot_gaia', limit: 50, offset: 100 })
    expect(String(query.mock.calls[0][0])).toContain('WHERE collection = $1')
    expect(query.mock.calls[1][1]).toEqual(['movie_hot_gaia', 50, 100])
    expect(res.total).toBe(345)
    expect(res.rows[0]).toMatchObject({ collection: 'movie_hot_gaia', domain: 'movie', doubanId: '1', ratingValue: 8.2 })
  })

  it('无 collection → 无 WHERE，LIMIT/OFFSET 为 $1/$2', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: '1294' }] })
      .mockResolvedValueOnce({ rows: [] })
    const db = { query } as unknown as Pool
    await listCollectionItemsPaged(db, { limit: 50, offset: 0 })
    expect(String(query.mock.calls[1][0])).toContain('LIMIT $1 OFFSET $2')
    expect(query.mock.calls[1][1]).toEqual([50, 0])
  })
})

describe('listCollectionsSummary', () => {
  it('GROUP BY collection/domain/category + count 映射', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { collection: 'movie_hot_gaia', domain: 'movie', category: 'trending', count: '345' },
        { collection: 'tv_hot', domain: 'tv', category: 'trending', count: '247' },
      ],
    })
    const db = { query } as unknown as Pool
    const res = await listCollectionsSummary(db)
    expect(String(query.mock.calls[0][0])).toContain('GROUP BY collection, domain, category')
    expect(res).toEqual([
      { collection: 'movie_hot_gaia', domain: 'movie', category: 'trending', count: 345 },
      { collection: 'tv_hot', domain: 'tv', category: 'trending', count: 247 },
    ])
  })
})
