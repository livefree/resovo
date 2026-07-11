/**
 * VideoPlaysAnalyticsView.test.tsx — 后台「视频播放」分析 tab 单测（ADR-217 / SEQ-20260624-02 STATS-07-B）
 *
 * 覆盖（Codex 卡审吸收）：
 *   1. 默认 7d → 三视图渲染（overview/trend/top-videos）+ 三端点各收 7d
 *   2. period 切 30d → 三端点重取带新 period（MEDIUM-4 切换重取）
 *   3. overview avg=0（totalPlays=0）展示为 0 非 NaN（LOW-9 avg 除零展示）
 *   4. trend line `points` token 数 == data 长度，覆盖 7 点全 0 / 90 / 正常非零（MEDIUM-5/6 退化态 + 精确钩子）
 *   5. top-videos DataTable **body** 行数 == data（MEDIUM-6 不含表头）
 *   6. error 态 → ErrorState，不渲三视图假数据
 *
 * 静态 query 的 DataTable 无 useTableQuery/router 依赖 → 无需 mock next/navigation。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getOverviewMock = vi.fn()
const getTrendMock = vi.fn()
const getTopVideosMock = vi.fn()

vi.mock('../../../../../apps/server-next/src/lib/video-plays/api', () => ({
  getVideoPlaysOverview: (...a: unknown[]) => getOverviewMock(...a),
  getVideoPlaysTrend: (...a: unknown[]) => getTrendMock(...a),
  getTopVideos: (...a: unknown[]) => getTopVideosMock(...a),
}))

import { VideoPlaysAnalyticsView } from '../../../../../apps/server-next/src/app/admin/_client/VideoPlaysAnalyticsView'
import type { VideoPlaysOverview, VideoPlaysTrendPoint, VideoPlaysTopVideo } from '@resovo/types'

const OVERVIEW: VideoPlaysOverview = {
  period: '7d', totalPlays: 100, totalWatchSeconds: 5000, avgWatchSeconds: 50, anonPlays: 70, loggedInPlays: 30,
}

function makeTrend(n: number, allZero = false): VideoPlaysTrendPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const v = allZero ? 0 : (i + 1) * 3
    const d = String((i % 28) + 1).padStart(2, '0')
    return { date: `2026-06-${d}`, plays: v, watchSeconds: v * 10, anonPlays: v, loggedInPlays: 0 }
  })
}

// 25 行（> client 默认 pageSize 20）：拦 server-mode 直渲被误改 client 切片回归（Codex MEDIUM-2）
const TOP: VideoPlaysTopVideo[] = Array.from({ length: 25 }, (_, i) => ({
  shortId: `vid${i}`,
  title: `视频${i}`,
  plays: 1000 - i,
  watchSeconds: (1000 - i) * 10,
}))

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function trendLinePointCount(container: HTMLElement): number {
  const line = container.querySelector('[data-video-plays-trend-line]')
  const pts = line?.getAttribute('points')?.trim() ?? ''
  return pts === '' ? 0 : pts.split(/\s+/).length
}

function bodyRowCount(container: HTMLElement): number {
  const body = container.querySelector('[data-table-body]')
  return body ? body.querySelectorAll('[role="row"]').length : -1
}

beforeEach(() => {
  getOverviewMock.mockReset()
  getTrendMock.mockReset()
  getTopVideosMock.mockReset()
})

describe('VideoPlaysAnalyticsView', () => {
  it('1. 默认 7d → 三视图渲染 + 三端点各收 7d', async () => {
    getOverviewMock.mockResolvedValue(OVERVIEW)
    getTrendMock.mockResolvedValue(makeTrend(7))
    getTopVideosMock.mockResolvedValue(TOP)
    const { container } = render(<VideoPlaysAnalyticsView />)
    await waitFor(() => expect(container.querySelector('[data-video-plays-overview]')).toBeTruthy())
    expect(container.querySelector('[data-video-plays-trend-chart]')).toBeTruthy()
    expect(container.querySelector('[data-testid="video-plays-top-videos-table"]')).toBeTruthy()
    expect(getOverviewMock).toHaveBeenCalledWith('7d')
    expect(getTrendMock).toHaveBeenCalledWith('7d')
    expect(getTopVideosMock).toHaveBeenCalledWith('7d', 20)
  })

  it('2. period 切 30d → 三端点重取带 30d', async () => {
    getOverviewMock.mockResolvedValue(OVERVIEW)
    getTrendMock.mockResolvedValue(makeTrend(7))
    getTopVideosMock.mockResolvedValue(TOP)
    const { container } = render(<VideoPlaysAnalyticsView />)
    await waitFor(() => expect(container.querySelector('[data-video-plays-overview]')).toBeTruthy())
    const select = container.querySelector('[data-video-plays-period-select]') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '30d' } })
    await waitFor(() => expect(getTrendMock).toHaveBeenCalledWith('30d'))
    expect(getOverviewMock).toHaveBeenCalledWith('30d')
    expect(getTopVideosMock).toHaveBeenCalledWith('30d', 20)
  })

  it('3. overview avg=0（totalPlays=0）展示为 0 非 NaN', async () => {
    getOverviewMock.mockResolvedValue({
      period: '7d', totalPlays: 0, totalWatchSeconds: 0, avgWatchSeconds: 0, anonPlays: 0, loggedInPlays: 0,
    })
    getTrendMock.mockResolvedValue(makeTrend(7, true))
    getTopVideosMock.mockResolvedValue([])
    const { container } = render(<VideoPlaysAnalyticsView />)
    await waitFor(() => expect(container.querySelector('[data-video-plays-overview]')).toBeTruthy())
    const overview = container.querySelector('[data-video-plays-overview]') as HTMLElement
    expect(overview.textContent).not.toContain('NaN')
    // 精确断言「均观看秒数 / 次」卡 value === '0'（非空/破折号/NaN，Codex LOW-1）
    const cards = Array.from(overview.querySelectorAll('[data-kpi-card]'))
    const avgCard = cards.find((c) => c.textContent?.includes('均观看秒数'))
    expect(avgCard?.querySelector('[data-card-value]')?.textContent).toBe('0')
  })

  it('4. trend line points token 数 == data 长度（7 全 0 / 90 / 正常非零）', async () => {
    for (const [n, allZero] of [[7, true], [90, false], [7, false]] as const) {
      getOverviewMock.mockResolvedValue(OVERVIEW)
      getTrendMock.mockResolvedValue(makeTrend(n, allZero))
      getTopVideosMock.mockResolvedValue(TOP)
      const { container, unmount } = render(<VideoPlaysAnalyticsView />)
      await waitFor(() => expect(container.querySelector('[data-video-plays-trend-line]')).toBeTruthy())
      expect(trendLinePointCount(container)).toBe(n)
      unmount()
      getOverviewMock.mockReset()
      getTrendMock.mockReset()
      getTopVideosMock.mockReset()
    }
  })

  it('5. top-videos DataTable 直渲全 25 行（不被 pageSize 切片）+ 无列 ⋯ 死交互', async () => {
    getOverviewMock.mockResolvedValue(OVERVIEW)
    getTrendMock.mockResolvedValue(makeTrend(7))
    getTopVideosMock.mockResolvedValue(TOP)
    const { container } = render(<VideoPlaysAnalyticsView />)
    await waitFor(() => expect(container.querySelector('[data-table-body]')).toBeTruthy())
    // server mode 直渲 25 行（> client 默认 pageSize 20）：误改 client 切片会 ≤20 → 此断言失败（Codex MEDIUM-2）
    expect(bodyRowCount(container)).toBe(TOP.length)
    expect(TOP.length).toBe(25)
    expect(screen.getByText('视频0')).toBeTruthy()
    expect(screen.getByText('视频24')).toBeTruthy()
    // 无列级 ⋯ 触发器（columnTriggerVisibility="never" → 无 noop 死交互，Codex HIGH-1）
    expect(container.querySelectorAll('[data-testid^="th-menu-trigger-"]').length).toBe(0)
  })

  it('6. error 态 → ErrorState，不渲三视图假数据', async () => {
    getOverviewMock.mockRejectedValue(new Error('boom'))
    getTrendMock.mockResolvedValue(makeTrend(7))
    getTopVideosMock.mockResolvedValue(TOP)
    const { container } = render(<VideoPlaysAnalyticsView />)
    // ErrorState 渲染 data-retry-btn + data-error-title（不转发自定义 data-*），用其作错误态信号
    await waitFor(() => expect(container.querySelector('[data-retry-btn]')).toBeTruthy())
    expect(screen.getByText('加载视频播放分析失败')).toBeTruthy()
    expect(container.querySelector('[data-video-plays-overview]')).toBeFalsy()
    expect(container.querySelector('[data-testid="video-plays-top-videos-table"]')).toBeFalsy()
  })

  it('7. stale guard：旧 7d 响应晚到不覆盖新 30d（删 requestSeqRef 即失败）', async () => {
    const d7 = deferred<VideoPlaysOverview>()
    getOverviewMock.mockImplementation((p: string) =>
      p === '30d'
        ? Promise.resolve({ period: '30d', totalPlays: 30000, totalWatchSeconds: 300000, avgWatchSeconds: 10, anonPlays: 30000, loggedInPlays: 0 })
        : d7.promise,
    )
    getTrendMock.mockResolvedValue(makeTrend(7))
    getTopVideosMock.mockResolvedValue(TOP)
    const { container } = render(<VideoPlaysAnalyticsView />)
    // 初始 7d overview pending（d7 未 resolve）；切到 30d
    const select = container.querySelector('[data-video-plays-period-select]') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '30d' } })
    // 30d 原子提交 → overview 显示 30,000
    await waitFor(() => {
      const ov = container.querySelector('[data-video-plays-overview]') as HTMLElement | null
      expect(ov?.textContent).toContain('30,000')
    })
    // 晚到 resolve 旧 7d（seq 已过期 → 应被丢弃，不覆盖 30d、不混 period）
    d7.resolve({ period: '7d', totalPlays: 7000, totalWatchSeconds: 70000, avgWatchSeconds: 10, anonPlays: 7000, loggedInPlays: 0 })
    await new Promise((r) => setTimeout(r, 0))
    const ov = container.querySelector('[data-video-plays-overview]') as HTMLElement
    expect(ov.textContent).toContain('30,000')
    expect(ov.textContent).not.toContain('7,000')
  })
})
