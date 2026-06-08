/**
 * tests/unit/api/bangumiCollections.test.ts
 * CHG-BNG-RES-STORE-2A（ADR-189 D-189-2/3）：bangumi_collection_items / _sync_state queries + registry
 *   - replaceBangumiCollectionItems 单合集同事务 DELETE+INSERT+sync ok
 *   - replaceBangumiCollectionGroupsAtomic calendar「一拉七写」原子（单事务多合集 / 任一失败全 ROLLBACK）
 *   - recordBangumiCollectionSyncState failed/empty_guard 不刷新 last_success_at
 *   - 读路径映射（syncState / browse paged / summary）
 *   - registry：9 合集 / weekday 映射 / search·calendar 分区
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import {
  replaceBangumiCollectionItems,
  replaceBangumiCollectionGroupsAtomic,
  recordBangumiCollectionSyncState,
  getBangumiCollectionSyncState,
  listBangumiCollectionItemsPaged,
  listBangumiCollectionsSummary,
  type BangumiCollectionItemInput,
  type BangumiCollectionGroup,
} from '@/api/db/queries/bangumi-collections'
import {
  BANGUMI_COLLECTIONS,
  BANGUMI_SEARCH_COLLECTIONS,
  BANGUMI_CALENDAR_COLLECTIONS,
  CALENDAR_WEEKDAY_KEYS,
  calendarKeyForWeekday,
} from '@/api/services/bangumi-collections/registry'

function makeItem(overrides: Partial<BangumiCollectionItemInput> = {}): BangumiCollectionItemInput {
  return {
    bangumiId: '326125',
    rank: 0,
    title: '葬送的芙莉莲',
    nameCn: '葬送的芙莉莲',
    year: 2023,
    rating: 9.1,
    airWeekday: null,
    coverUrl: 'https://lain.bgm.tv/p.jpg',
    raw: { id: 326125, name: 'Sousou no Frieren' },
    ...overrides,
  }
}

function makeClient() {
  const clientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
  const release = vi.fn()
  const db = { connect: vi.fn().mockResolvedValue({ query: clientQuery, release }) } as unknown as Pool
  return { db, clientQuery, release }
}

describe('replaceBangumiCollectionItems', () => {
  it('单合集 BEGIN→DELETE→批量 INSERT→sync_state ok→COMMIT', async () => {
    const { db, clientQuery, release } = makeClient()
    const rows = [makeItem(), makeItem({ bangumiId: '400602', rank: 1, year: null, rating: null })]
    const count = await replaceBangumiCollectionItems(db, 'bgm_trending', 'trending', rows)

    expect(count).toBe(2)
    const sql = clientQuery.mock.calls.map((c) => String(c[0]))
    expect(sql[0]).toBe('BEGIN')
    expect(sql.some((s) => s.includes('DELETE FROM external_data.bangumi_collection_items'))).toBe(true)
    expect(sql.filter((s) => s.includes('INSERT INTO external_data.bangumi_collection_items')).length).toBe(2)
    expect(sql.some((s) => s.includes('bangumi_collection_sync_state') && s.includes("'ok'"))).toBe(true)
    expect(sql[sql.length - 1]).toBe('COMMIT')
    expect(release).toHaveBeenCalledOnce()

    // INSERT 第二行 year=null / rating=null 原样入参（中性 input 不二次解析）
    const secondInsert = clientQuery.mock.calls.find(
      (c) => String(c[0]).includes('INSERT INTO') && (c[1] as unknown[])[2] === '400602',
    )
    expect((secondInsert?.[1] as unknown[])[6]).toBe(null) // year
    expect((secondInsert?.[1] as unknown[])[7]).toBe(null) // rating
  })

  it('INSERT 失败 → ROLLBACK + release + 抛出', async () => {
    const clientQuery = vi.fn().mockImplementation((sql: string) => {
      if (String(sql).includes('INSERT INTO external_data.bangumi_collection_items')) {
        return Promise.reject(new Error('boom'))
      }
      return Promise.resolve({ rows: [], rowCount: 0 })
    })
    const release = vi.fn()
    const db = { connect: vi.fn().mockResolvedValue({ query: clientQuery, release }) } as unknown as Pool

    await expect(replaceBangumiCollectionItems(db, 'bgm_ranking', 'ranking', [makeItem()])).rejects.toThrow('boom')
    expect(clientQuery.mock.calls.map((c) => String(c[0]))).toContain('ROLLBACK')
    expect(release).toHaveBeenCalledOnce()
  })
})

describe('replaceBangumiCollectionGroupsAtomic（calendar 一拉七写）', () => {
  it('单事务替换多 collection：1 个 BEGIN / 每组 DELETE+INSERT+sync / 1 个 COMMIT', async () => {
    const { db, clientQuery, release } = makeClient()
    const groups: BangumiCollectionGroup[] = [
      { collection: 'bgm_calendar_mon', category: 'calendar', rows: [makeItem({ airWeekday: 1 })] },
      { collection: 'bgm_calendar_tue', category: 'calendar', rows: [makeItem({ bangumiId: '1', airWeekday: 2 })] },
    ]
    const total = await replaceBangumiCollectionGroupsAtomic(db, groups)

    expect(total).toBe(2)
    const sql = clientQuery.mock.calls.map((c) => String(c[0]))
    expect(sql.filter((s) => s === 'BEGIN').length).toBe(1)
    expect(sql.filter((s) => s === 'COMMIT').length).toBe(1)
    expect(sql.filter((s) => s.includes('DELETE FROM external_data.bangumi_collection_items')).length).toBe(2)
    expect(release).toHaveBeenCalledOnce()
  })

  it('任一组失败 → 整体 ROLLBACK（不留半份 calendar）', async () => {
    let inserts = 0
    const clientQuery = vi.fn().mockImplementation((sql: string) => {
      if (String(sql).includes('INSERT INTO external_data.bangumi_collection_items')) {
        inserts += 1
        if (inserts === 2) return Promise.reject(new Error('day2 boom'))
      }
      return Promise.resolve({ rows: [], rowCount: 0 })
    })
    const release = vi.fn()
    const db = { connect: vi.fn().mockResolvedValue({ query: clientQuery, release }) } as unknown as Pool

    const groups: BangumiCollectionGroup[] = [
      { collection: 'bgm_calendar_mon', category: 'calendar', rows: [makeItem({ airWeekday: 1 })] },
      { collection: 'bgm_calendar_tue', category: 'calendar', rows: [makeItem({ airWeekday: 2 })] },
    ]
    await expect(replaceBangumiCollectionGroupsAtomic(db, groups)).rejects.toThrow('day2 boom')
    const sql = clientQuery.mock.calls.map((c) => String(c[0]))
    expect(sql).toContain('ROLLBACK')
    expect(sql).not.toContain('COMMIT')
    expect(release).toHaveBeenCalledOnce()
  })
})

describe('recordBangumiCollectionSyncState', () => {
  it('failed → 不刷新 last_success_at；status/error 透传', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    const db = { query } as unknown as Pool
    await recordBangumiCollectionSyncState(db, 'bgm_trending', 'failed', 'timeout')
    const [sql, params] = query.mock.calls[0]
    expect(String(sql)).toContain('bangumi_collection_sync_state')
    expect(String(sql)).not.toContain('last_success_at = NOW()')
    expect(String(sql)).toMatch(/DO UPDATE SET[\s\S]*last_status = \$2/)
    expect(params).toEqual(['bgm_trending', 'failed', 'timeout'])
  })

  it('empty_guard → status 透传', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    const db = { query } as unknown as Pool
    await recordBangumiCollectionSyncState(db, 'bgm_calendar_sun', 'empty_guard', null)
    expect(query.mock.calls[0][1]).toEqual(['bgm_calendar_sun', 'empty_guard', null])
  })
})

describe('读路径映射', () => {
  it('getBangumiCollectionSyncState：行→camelCase；无行→null', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{
          collection: 'bgm_trending', last_attempt_at: '2026-06-07T10:00:00Z',
          last_success_at: '2026-06-07T10:00:00Z', last_status: 'ok', last_error: null, item_count: 200,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
    const db = { query } as unknown as Pool
    expect(await getBangumiCollectionSyncState(db, 'bgm_trending')).toMatchObject({ lastStatus: 'ok', itemCount: 200 })
    expect(await getBangumiCollectionSyncState(db, 'nope')).toBeNull()
  })

  it('listBangumiCollectionItemsPaged：rating Number 强转 + total 解析 + 可选过滤', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ count: '7' }] })
      .mockResolvedValueOnce({
        rows: [{
          collection: 'bgm_calendar_mon', category: 'calendar', bangumi_id: '326125', rank: 0,
          title: '芙莉莲', name_cn: '葬送的芙莉莲', year: 2023, rating: '9.1', air_weekday: 1, cover_url: 'x',
        }],
      })
    const db = { query } as unknown as Pool
    const { rows, total } = await listBangumiCollectionItemsPaged(db, { collection: 'bgm_calendar_mon', limit: 20, offset: 0 })
    expect(total).toBe(7)
    expect(rows[0]).toMatchObject({ bangumiId: '326125', rating: 9.1, airWeekday: 1, category: 'calendar' })
    expect(typeof rows[0]!.rating).toBe('number')
    // 带 collection 过滤 → 第一条 SQL（count）含 WHERE + 参数
    expect(String(query.mock.calls[0][0])).toContain('WHERE collection = $1')
    expect(query.mock.calls[0][1]).toEqual(['bgm_calendar_mon'])
  })

  it('listBangumiCollectionsSummary：count 解析 + 按 category/collection 排序', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { collection: 'bgm_calendar_mon', category: 'calendar', count: '12' },
        { collection: 'bgm_trending', category: 'trending', count: '200' },
      ],
    })
    const db = { query } as unknown as Pool
    const summary = await listBangumiCollectionsSummary(db)
    expect(summary).toEqual([
      { collection: 'bgm_calendar_mon', category: 'calendar', count: 12 },
      { collection: 'bgm_trending', category: 'trending', count: 200 },
    ])
    expect(String(query.mock.calls[0][0])).toContain('ORDER BY category ASC, collection ASC')
  })
})

describe('registry', () => {
  it('9 合集 = trending 1 + ranking 1 + calendar 7', () => {
    expect(BANGUMI_COLLECTIONS).toHaveLength(9)
    expect(BANGUMI_SEARCH_COLLECTIONS.map((c) => c.key)).toEqual(['bgm_trending', 'bgm_ranking'])
    expect(BANGUMI_CALENDAR_COLLECTIONS).toHaveLength(7)
    expect(CALENDAR_WEEKDAY_KEYS).toHaveLength(7)
  })

  it('search 合集携 sort；calendar 合集携 weekday 1-7', () => {
    expect(BANGUMI_SEARCH_COLLECTIONS.find((c) => c.key === 'bgm_trending')?.sort).toBe('date')
    expect(BANGUMI_SEARCH_COLLECTIONS.find((c) => c.key === 'bgm_ranking')?.sort).toBe('rank')
    expect(BANGUMI_CALENDAR_COLLECTIONS.map((c) => c.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('calendarKeyForWeekday：1→mon / 7→sun / 越界→null', () => {
    expect(calendarKeyForWeekday(1)).toBe('bgm_calendar_mon')
    expect(calendarKeyForWeekday(7)).toBe('bgm_calendar_sun')
    expect(calendarKeyForWeekday(0)).toBeNull()
    expect(calendarKeyForWeekday(8)).toBeNull()
  })
})
