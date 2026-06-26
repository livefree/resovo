/**
 * video-play-analytics-service.test.ts — VideoPlayAnalyticsService 映射/口径单测（ADR-217 / STATS-07-A）
 *
 * 覆盖：period→天数窗口、BIGINT string → number 裸映射、avg 除零保护、
 *   totalPlays === anonPlays + loggedInPlays 恒等（D-217-4）、trend date 严格透传、top-videos 映射。
 * mock videoPlayStats query 层（service 唯一数据出入口），不触真 DB。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetVideoPlaysOverview = vi.fn()
const mockGetVideoPlaysTrend = vi.fn()
const mockGetTopVideosByPlays = vi.fn()

vi.mock('@/api/db/queries/videoPlayStats', () => ({
  getVideoPlaysOverview: (...a: unknown[]) => mockGetVideoPlaysOverview(...a),
  getVideoPlaysTrend: (...a: unknown[]) => mockGetVideoPlaysTrend(...a),
  getTopVideosByPlays: (...a: unknown[]) => mockGetTopVideosByPlays(...a),
}))

import type { Pool } from 'pg'
import { VideoPlayAnalyticsService } from '@/api/services/VideoPlayAnalyticsService'

const fakeDb = {} as Pool
const service = new VideoPlayAnalyticsService(fakeDb)

beforeEach(() => {
  mockGetVideoPlaysOverview.mockReset()
  mockGetVideoPlaysTrend.mockReset()
  mockGetTopVideosByPlays.mockReset()
})

describe('getOverview', () => {
  it('period→天数窗口：7d→7 / 30d→30 / 90d→90', async () => {
    mockGetVideoPlaysOverview.mockResolvedValue({
      total_plays: '0', total_watch_seconds: '0', anon_plays: '0', logged_in_plays: '0',
    })
    await service.getOverview('7d')
    expect(mockGetVideoPlaysOverview).toHaveBeenLastCalledWith(fakeDb, 7)
    await service.getOverview('30d')
    expect(mockGetVideoPlaysOverview).toHaveBeenLastCalledWith(fakeDb, 30)
    await service.getOverview('90d')
    expect(mockGetVideoPlaysOverview).toHaveBeenLastCalledWith(fakeDb, 90)
  })

  it('BIGINT string → number 映射 + period 回显 + totalPlays === anonPlays + loggedInPlays 恒等', async () => {
    // anon 含 ephemeral 匿名播放（聚合 play_count = anon + logged 互补，service 不再过滤/查 users）
    mockGetVideoPlaysOverview.mockResolvedValueOnce({
      total_plays: '100', total_watch_seconds: '5000', anon_plays: '70', logged_in_plays: '30',
    })
    const res = await service.getOverview('7d')
    expect(res).toEqual({
      period: '7d',
      totalPlays: 100,
      totalWatchSeconds: 5000,
      avgWatchSeconds: 50,
      anonPlays: 70,
      loggedInPlays: 30,
    })
    expect(res.totalPlays).toBe(res.anonPlays + res.loggedInPlays)
  })

  it('avg 除零保护：totalPlays=0 → avgWatchSeconds=0（非 NaN/null）', async () => {
    mockGetVideoPlaysOverview.mockResolvedValueOnce({
      total_plays: '0', total_watch_seconds: '0', anon_plays: '0', logged_in_plays: '0',
    })
    const res = await service.getOverview('30d')
    expect(res.avgWatchSeconds).toBe(0)
    expect(Number.isNaN(res.avgWatchSeconds)).toBe(false)
  })
})

describe('getTrend', () => {
  it('映射每点 BIGINT→number + date 严格透传（YYYY-MM-DD）+ 调 query 带正确天数', async () => {
    mockGetVideoPlaysTrend.mockResolvedValueOnce([
      { date: '2026-06-19', plays: '10', watch_seconds: '120', anon_plays: '6', logged_in_plays: '4' },
      { date: '2026-06-20', plays: '0', watch_seconds: '0', anon_plays: '0', logged_in_plays: '0' },
    ])
    const res = await service.getTrend('7d')
    expect(mockGetVideoPlaysTrend).toHaveBeenCalledWith(fakeDb, 7)
    expect(res).toEqual([
      { date: '2026-06-19', plays: 10, watchSeconds: 120, anonPlays: 6, loggedInPlays: 4 },
      { date: '2026-06-20', plays: 0, watchSeconds: 0, anonPlays: 0, loggedInPlays: 0 },
    ])
    for (const p of res) {
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(p.date).not.toContain('T')
    }
  })
})

describe('getTopVideos', () => {
  it('映射 shortId/title/plays/watchSeconds + 透传 period 天数 + limit', async () => {
    mockGetTopVideosByPlays.mockResolvedValueOnce([
      { short_id: 'abCD1234', title: '热门视频', plays: '999', watch_seconds: '88000' },
    ])
    const res = await service.getTopVideos('30d', 5)
    expect(mockGetTopVideosByPlays).toHaveBeenCalledWith(fakeDb, 30, 5)
    expect(res).toEqual([{ shortId: 'abCD1234', title: '热门视频', plays: 999, watchSeconds: 88000 }])
  })
})
