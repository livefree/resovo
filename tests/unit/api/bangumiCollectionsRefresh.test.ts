/**
 * tests/unit/api/bangumiCollectionsRefresh.test.ts
 * CHG-BNG-RES-STORE-2C：refresh 编排（ADR-189 D-189-2）
 *   - refreshSearchCollection：单页全量 → replace / 抓取失败(null) → failed 不替换 / empty_guard 骤降不替换
 *   - refreshCalendar：一拉七写 atomic replace / getCalendar null → 7 failed / 7 天总量 empty_guard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import type { BangumiSearchItem, BangumiCalendarDay } from '@/api/lib/bangumi'

vi.mock('@/api/lib/bangumi', () => ({
  searchSubjectsSorted: vi.fn(),
  getCalendar: vi.fn(),
}))
vi.mock('@/api/db/queries/bangumi-collections', () => ({
  replaceBangumiCollectionItems: vi.fn().mockResolvedValue(0),
  replaceBangumiCollectionGroupsAtomic: vi.fn().mockResolvedValue(0),
  recordBangumiCollectionSyncState: vi.fn().mockResolvedValue(undefined),
  getBangumiCollectionSyncState: vi.fn().mockResolvedValue(null),
  listAllBangumiCollectionSyncState: vi.fn().mockResolvedValue([]),
}))

import { refreshSearchCollection, refreshCalendar } from '@/api/services/bangumi-collections/refresh'
import { searchSubjectsSorted, getCalendar } from '@/api/lib/bangumi'
import {
  replaceBangumiCollectionItems,
  replaceBangumiCollectionGroupsAtomic,
  recordBangumiCollectionSyncState,
  getBangumiCollectionSyncState,
  listAllBangumiCollectionSyncState,
} from '@/api/db/queries/bangumi-collections'

const mSearch = searchSubjectsSorted as ReturnType<typeof vi.fn>
const mCalendar = getCalendar as ReturnType<typeof vi.fn>
const mReplaceOne = replaceBangumiCollectionItems as ReturnType<typeof vi.fn>
const mReplaceAtomic = replaceBangumiCollectionGroupsAtomic as ReturnType<typeof vi.fn>
const mRecord = recordBangumiCollectionSyncState as ReturnType<typeof vi.fn>
const mGetSync = getBangumiCollectionSyncState as ReturnType<typeof vi.fn>
const mListSync = listAllBangumiCollectionSyncState as ReturnType<typeof vi.fn>

const db = {} as Pool
const TRENDING = { key: 'bgm_trending', category: 'trending', sort: 'heat' } as const

function searchItem(id: number): BangumiSearchItem {
  return { id, name: `S${id}`, name_cn: `中${id}`, date: '2026-01-01', images: { large: 'x' }, rating: { rank: 1, total: 1, score: 8.5 } }
}
function calItem(id: number) {
  return { id, name: `C${id}`, name_cn: `番${id}`, air_date: '2026-01-01', images: null, rating: null }
}
function calDay(weekdayId: number, n: number): BangumiCalendarDay {
  return {
    weekday: { id: weekdayId, en: 'X', cn: '星期', ja: '耀日' },
    items: Array.from({ length: n }, (_, i) => calItem(weekdayId * 100 + i)),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mGetSync.mockResolvedValue(null)
  mListSync.mockResolvedValue([])
})

describe('refreshSearchCollection（trending/ranking）', () => {
  it('单页全量（<50 末页）→ replaceBangumiCollectionItems（rank 连续 + category 注入 + airWeekday null）', async () => {
    mSearch.mockResolvedValueOnce([searchItem(1), searchItem(2), searchItem(3)])
    const res = await refreshSearchCollection(db, TRENDING)

    expect(res).toEqual({ collection: 'bgm_trending', status: 'ok', count: 3 })
    expect(mReplaceOne).toHaveBeenCalledOnce()
    const [, key, category, rows] = mReplaceOne.mock.calls[0]
    expect(key).toBe('bgm_trending')
    expect(category).toBe('trending')
    expect(rows.map((r: { rank: number }) => r.rank)).toEqual([0, 1, 2])
    expect(rows[0]).toMatchObject({ bangumiId: '1', title: '中1', nameCn: '中1', year: 2026, rating: 8.5, airWeekday: null })
    expect(mRecord).not.toHaveBeenCalled()
  })

  it('抓取失败（searchSubjectsSorted null）→ recordSyncState(failed) 不替换', async () => {
    mSearch.mockResolvedValueOnce(null)
    const res = await refreshSearchCollection(db, TRENDING)
    expect(res).toEqual({ collection: 'bgm_trending', status: 'failed', count: 0 })
    expect(mReplaceOne).not.toHaveBeenCalled()
    expect(mRecord).toHaveBeenCalledWith(db, 'bgm_trending', 'failed', 'fetch failed')
  })

  it('empty_guard（上轮 200 → 本轮 5 骤降）→ 不替换', async () => {
    mGetSync.mockResolvedValueOnce({ collection: 'bgm_trending', itemCount: 200, lastStatus: 'ok', lastAttemptAt: null, lastSuccessAt: null, lastError: null })
    mSearch.mockResolvedValueOnce([searchItem(1), searchItem(2), searchItem(3), searchItem(4), searchItem(5)])
    const res = await refreshSearchCollection(db, TRENDING)
    expect(res.status).toBe('empty_guard')
    expect(mReplaceOne).not.toHaveBeenCalled()
    expect(mRecord).toHaveBeenCalledWith(db, 'bgm_trending', 'empty_guard', expect.stringContaining('count 5 vs prev 200'))
  })
})

describe('refreshCalendar（一拉七写）', () => {
  it('成功 → replaceBangumiCollectionGroupsAtomic 单次 7 组（mon=2/tue=1/其余 0 + airWeekday 注入）', async () => {
    mCalendar.mockResolvedValueOnce([calDay(1, 2), calDay(2, 1)])
    const res = await refreshCalendar(db)

    expect(res).toHaveLength(7)
    expect(res.every((r) => r.status === 'ok')).toBe(true)
    expect(mReplaceAtomic).toHaveBeenCalledOnce()
    const groups = mReplaceAtomic.mock.calls[0][1] as Array<{ collection: string; category: string; rows: Array<{ airWeekday: number }> }>
    expect(groups).toHaveLength(7)
    const mon = groups.find((g) => g.collection === 'bgm_calendar_mon')!
    expect(mon.category).toBe('calendar')
    expect(mon.rows).toHaveLength(2)
    expect(mon.rows[0].airWeekday).toBe(1)
    expect(groups.find((g) => g.collection === 'bgm_calendar_tue')!.rows).toHaveLength(1)
    expect(groups.find((g) => g.collection === 'bgm_calendar_wed')!.rows).toHaveLength(0)
    expect(mRecord).not.toHaveBeenCalled()
  })

  it('getCalendar null → 7 key 统一 failed，不 atomic 替换', async () => {
    mCalendar.mockResolvedValueOnce(null)
    const res = await refreshCalendar(db)
    expect(res).toHaveLength(7)
    expect(res.every((r) => r.status === 'failed')).toBe(true)
    expect(mReplaceAtomic).not.toHaveBeenCalled()
    expect(mRecord).toHaveBeenCalledTimes(7)
    expect(mRecord).toHaveBeenCalledWith(db, 'bgm_calendar_mon', 'failed', 'calendar fetch failed')
  })

  it('7 天总量 empty_guard（上轮 140 → 本轮 3 骤降）→ 7 key empty_guard 不替换', async () => {
    mListSync.mockResolvedValueOnce(
      ['bgm_calendar_mon', 'bgm_calendar_tue', 'bgm_calendar_wed', 'bgm_calendar_thu', 'bgm_calendar_fri', 'bgm_calendar_sat', 'bgm_calendar_sun']
        .map((collection) => ({ collection, itemCount: 20, lastStatus: 'ok', lastAttemptAt: null, lastSuccessAt: null, lastError: null })),
    )
    mCalendar.mockResolvedValueOnce([calDay(1, 2), calDay(2, 1)]) // total 3 << 140*0.5
    const res = await refreshCalendar(db)
    expect(res.every((r) => r.status === 'empty_guard')).toBe(true)
    expect(mReplaceAtomic).not.toHaveBeenCalled()
    expect(mRecord).toHaveBeenCalledTimes(7)
    expect(mRecord).toHaveBeenCalledWith(db, 'bgm_calendar_mon', 'empty_guard', expect.stringContaining('calendar total 3 vs prev 140'))
  })
})
