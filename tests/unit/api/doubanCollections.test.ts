/**
 * tests/unit/api/doubanCollections.test.ts
 * CHG-DOUBAN-HOT-STORE-A：douban_collection_items / _sync_state queries
 *   - replaceCollectionItems 同事务 DELETE+INSERT+sync_state UPSERT（D-187-3 M4①）
 *   - recordCollectionSyncState failed/empty_guard
 *   - getCollectionSyncState / listCollectionItems 映射
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import type { DoubanCollectionItem } from 'douban-adapter'
import {
  replaceCollectionItems,
  recordCollectionSyncState,
  getCollectionSyncState,
  listCollectionItems,
  type CollectionItemInput,
} from '@/api/db/queries/douban-collections'

function makeItem(overrides: Partial<DoubanCollectionItem> = {}): DoubanCollectionItem {
  return {
    id: '36916000',
    title: '诺曼底72小时',
    originalTitle: 'Pressure',
    cardSubtitle: '2026 / 英国 / 剧情',
    info: '英国 / 剧情',
    year: '2026',
    ratingValue: 8.2,
    ratingCount: 12882,
    coverUrl: 'https://img.example.com/p.jpg',
    uri: 'douban://douban.com/movie/36916000',
    releaseDate: '06.06',
    subjectType: 'movie',
    hasLinewatch: false,
    raw: { id: '36916000', directors: ['安东尼·马拉斯'] },
    ...overrides,
  }
}

function makeInput(rank: number, item?: DoubanCollectionItem): CollectionItemInput {
  return { item: item ?? makeItem(), domain: 'movie', category: 'trending', rank }
}

describe('replaceCollectionItems', () => {
  it('同事务 BEGIN→DELETE→批量 INSERT→sync_state UPSERT ok→COMMIT', async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
    const release = vi.fn()
    const db = {
      connect: vi.fn().mockResolvedValue({ query: clientQuery, release }),
    } as unknown as Pool

    const rows = [makeInput(0), makeInput(1, makeItem({ id: '35000000', year: null, ratingValue: null }))]
    const count = await replaceCollectionItems(db, 'movie_hot_gaia', rows)

    expect(count).toBe(2)
    const sql = clientQuery.mock.calls.map((c) => String(c[0]))
    expect(sql[0]).toBe('BEGIN')
    expect(sql.some((s) => s.includes('DELETE FROM external_data.douban_collection_items'))).toBe(true)
    expect(sql.filter((s) => s.includes('INSERT INTO external_data.douban_collection_items')).length).toBe(2)
    expect(sql.some((s) => s.includes('douban_collection_sync_state') && s.includes("'ok'"))).toBe(true)
    expect(sql[sql.length - 1]).toBe('COMMIT')
    expect(release).toHaveBeenCalledOnce()

    // INSERT 第二行 year='' → null（parseYear 防御）
    const secondInsert = clientQuery.mock.calls.find(
      (c) => String(c[0]).includes('INSERT INTO') && (c[1] as unknown[])[3] === '35000000',
    )
    expect((secondInsert?.[1] as unknown[])[9]).toBe(null) // year
    expect((secondInsert?.[1] as unknown[])[10]).toBe(null) // rating_value
  })

  it('INSERT 失败时 ROLLBACK + release + 抛出', async () => {
    const clientQuery = vi.fn().mockImplementation((sql: string) => {
      if (String(sql).includes('INSERT INTO external_data.douban_collection_items')) {
        return Promise.reject(new Error('boom'))
      }
      return Promise.resolve({ rows: [], rowCount: 0 })
    })
    const release = vi.fn()
    const db = {
      connect: vi.fn().mockResolvedValue({ query: clientQuery, release }),
    } as unknown as Pool

    await expect(replaceCollectionItems(db, 'tv_hot', [makeInput(0)])).rejects.toThrow('boom')
    const sql = clientQuery.mock.calls.map((c) => String(c[0]))
    expect(sql).toContain('ROLLBACK')
    expect(release).toHaveBeenCalledOnce()
  })
})

describe('recordCollectionSyncState', () => {
  it('failed → UPSERT 且 DO UPDATE SET 不重置 last_success_at（保留上次成功时间，D-187-5）', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    const db = { query } as unknown as Pool
    await recordCollectionSyncState(db, 'movie_soon', 'failed', 'timeout')
    const [sql, params] = query.mock.calls[0]
    expect(String(sql)).toContain('douban_collection_sync_state')
    // 失败路径绝不刷新 last_success_at（陈旧度据其持续增长）
    expect(String(sql)).not.toContain('last_success_at = NOW()')
    expect(String(sql)).toMatch(/DO UPDATE SET[\s\S]*last_status = \$2/)
    expect(params).toEqual(['movie_soon', 'failed', 'timeout'])
  })

  it('empty_guard → status 透传', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    const db = { query } as unknown as Pool
    await recordCollectionSyncState(db, 'tv_hot', 'empty_guard', null)
    expect(query.mock.calls[0][1]).toEqual(['tv_hot', 'empty_guard', null])
  })
})

describe('getCollectionSyncState', () => {
  it('映射行 → camelCase；无行 → null', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{
          collection: 'movie_hot_gaia',
          last_attempt_at: '2026-06-07T10:00:00Z',
          last_success_at: '2026-06-07T10:00:00Z',
          last_status: 'ok',
          last_error: null,
          item_count: 345,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
    const db = { query } as unknown as Pool

    const hit = await getCollectionSyncState(db, 'movie_hot_gaia')
    expect(hit).toMatchObject({ collection: 'movie_hot_gaia', lastStatus: 'ok', itemCount: 345 })

    const miss = await getCollectionSyncState(db, 'unknown')
    expect(miss).toBeNull()
  })
})

describe('listCollectionItems', () => {
  it('按 rank 映射 + rating_value Number 强转', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        douban_id: '36916000', rank: 0, title: '诺曼底72小时', original_title: 'Pressure',
        year: 2026, rating_value: '8.2', rating_count: 12882, cover_url: 'x',
        release_date: '06.06', subject_type: 'movie', has_linewatch: false,
      }],
    })
    const db = { query } as unknown as Pool
    const rows = await listCollectionItems(db, 'movie_hot_gaia', 10)
    expect(rows[0]).toMatchObject({ doubanId: '36916000', rank: 0, ratingValue: 8.2, year: 2026 })
    expect(typeof rows[0]!.ratingValue).toBe('number')
  })
})
