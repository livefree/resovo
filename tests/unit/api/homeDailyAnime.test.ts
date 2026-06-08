/**
 * tests/unit/api/homeDailyAnime.test.ts
 * CHG-BNG-HOME-WIRE-5A（ADR-189 D-189-7）：每日放送发现查询 + 站内交叉态
 *   - listDailyAnimeByWeekday：weekday→calendar key 解析 / 映射 / linkedVideo 交叉 / rating Number
 *   - weekday 越界 → [] 不查
 *   - HomeService.dailyAnime → { weekday, items }
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { listDailyAnimeByWeekday } from '@/api/db/queries/home-discovery'

function dbWithRows(rows: unknown[]) {
  const query = vi.fn().mockResolvedValue({ rows })
  return { db: { query } as unknown as Pool, query }
}

describe('listDailyAnimeByWeekday', () => {
  it('weekday=1 → 解析 bgm_calendar_mon + 映射 + linkedVideo 交叉（有/无站内）', async () => {
    const { db, query } = dbWithRows([
      { bangumi_id: '326125', title: '芙莉莲', name_cn: '葬送的芙莉莲', cover_url: 'x', air_weekday: 1, rating: '9.1', rank: 0, video_id: 'vid-1', video_slug: 'frieren', video_short_id: 'ab12cd' },
      { bangumi_id: '400602', title: '某番', name_cn: null, cover_url: null, air_weekday: 1, rating: null, rank: 1, video_id: null, video_slug: null, video_short_id: null },
    ])
    const items = await listDailyAnimeByWeekday(db, 1)

    // 查询用 collection = bgm_calendar_mon
    expect(query.mock.calls[0][1]).toEqual(['bgm_calendar_mon'])
    expect(items).toHaveLength(2)
    // 命中站内 → linkedVideo（含 shortId 供前台 watch deeplink）
    expect(items[0]).toMatchObject({ bangumiSubjectId: '326125', rating: 9.1, airWeekday: 1, linkedVideo: { videoId: 'vid-1', slug: 'frieren', shortId: 'ab12cd' } })
    expect(typeof items[0]!.rating).toBe('number')
    // 未入站 → linkedVideo null
    expect(items[1]).toMatchObject({ bangumiSubjectId: '400602', rating: null, linkedVideo: null })
  })

  it('weekday=7 → bgm_calendar_sun', async () => {
    const { db, query } = dbWithRows([])
    await listDailyAnimeByWeekday(db, 7)
    expect(query.mock.calls[0][1]).toEqual(['bgm_calendar_sun'])
  })

  it('weekday 越界（0/8）→ 返回 [] 不发查询', async () => {
    const { db, query } = dbWithRows([])
    expect(await listDailyAnimeByWeekday(db, 0)).toEqual([])
    expect(await listDailyAnimeByWeekday(db, 8)).toEqual([])
    expect(query).not.toHaveBeenCalled()
  })

  it('LATERAL 仅取 published 公开 video（SQL 含 is_published + visibility_status 过滤）', async () => {
    const { db, query } = dbWithRows([])
    await listDailyAnimeByWeekday(db, 3)
    const sql = String(query.mock.calls[0][0])
    expect(sql).toContain('is_published = true')
    expect(sql).toContain("visibility_status = 'public'")
    expect(sql).toContain('mc.bangumi_subject_id::TEXT = bci.bangumi_id')
  })
})
