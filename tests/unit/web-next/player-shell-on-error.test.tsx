/**
 * @vitest-environment jsdom
 *
 * player-shell-on-error.test.tsx — PLAYER-LINE-BOUND-EP（重写）/ ADR-166 retry-control
 *
 * 线路优先模型下的自动切线 + 标 dead 线路 + feedback 失败上报：
 *   #1 首次 fatal → controls.retry() + 3s watchdog；超时切线（环形扫含当前集线路）+ POST
 *   #1b watchdog 内第二次 fatal → 立即切线 + cancel watchdog + POST
 *   #2 previewMode → 切线但不 POST（D-160-5 守卫）
 *   #3 同 (sourceId, errorCode) 去抖不重复 POST
 *   #4 切线后失败上报用新线路当前集 sourceId 关联
 *   #5b 切集 → stale watchdog 取消 + retry 计数清空
 *   #5  retry 后 onPlay 成功 → cancel watchdog + 重置 retry 计数
 *
 * 切线/切集语义键化为 activeLineKey（红线 1）；line-matrix/line-display-name 用真实实现。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
}))

vi.mock('next/dynamic', () => ({
  default: (_loader: unknown) => {
    return function MockVideoPlayer(props: Record<string, unknown>) {
      testCapturedProps = props
      return React.createElement('div', { 'data-mock-video-player': '' })
    }
  },
}))

let testCapturedProps: Record<string, unknown> = {}

const { initPlayerMock, apiGetMock, apiPostMock, mockState } = vi.hoisted(() => {
  const state = {
    mode: 'default' as 'default' | 'theater',
    currentEpisode: 1,
    activeLineKey: null as string | null,
    shortId: '',
    currentTime: 0,
    setMode: vi.fn(),
    initPlayer: vi.fn((shortId: string, ep: number) => {
      state.shortId = shortId
      state.currentEpisode = ep
      state.currentTime = 0
      state.activeLineKey = null
    }),
    setEpisode: vi.fn((ep: number) => {
      state.currentEpisode = ep
    }),
    setPlaying: vi.fn(),
    setCurrentTime: vi.fn(),
    setDuration: vi.fn(),
    setActiveLineKey: vi.fn((k: string | null) => {
      state.activeLineKey = k
    }),
    hostOrigin: null,
  }
  return {
    initPlayerMock: state.initPlayer,
    apiGetMock: vi.fn(),
    apiPostMock: vi.fn().mockResolvedValue({}),
    mockState: state,
  }
})

vi.mock('@/stores/playerStore', () => {
  const usePlayerStore = (selector?: (s: typeof mockState) => unknown) =>
    selector ? selector(mockState) : mockState
  ;(usePlayerStore as unknown as { getState: () => typeof mockState }).getState = () => mockState
  return { usePlayerStore }
})

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: apiGetMock, post: apiPostMock },
}))

vi.mock('@/lib/video-route', () => ({
  getVideoDetailHref: () => '/movie/test-slug-aB3kR9x1',
}))

vi.mock('@/lib/short-id', () => ({
  extractShortId: (slug: string) => slug.split('-').pop() ?? slug,
}))

const STABLE_ROUTE_THEME = Object.freeze({
  id: 'jie_qi', displayName: '节气', labels: ['立春', '雨水', '惊蛰'], deadLabel: '已断', fallbackPrefix: '线路',
})
const STABLE_ROUTE_THEME_RESULT = Object.freeze({
  theme: STABLE_ROUTE_THEME,
  customTheme: null,
  syncing: false,
  setTheme: vi.fn(),
  setCustomTheme: vi.fn(),
  clearCustomTheme: vi.fn(),
})
vi.mock('@/lib/route-theme-storage', () => ({
  useRouteTheme: () => STABLE_ROUTE_THEME_RESULT,
}))

vi.mock('@/components/player/SourceBar', () => ({ SourceBar: () => null }))
vi.mock('@/components/player/ResumePrompt', () => ({
  ResumePrompt: () => null,
  saveProgress: vi.fn(),
}))
vi.mock('@/components/player/RouteThemeSelector', () => ({ RouteThemeSelector: () => null }))
vi.mock('@/components/player/CustomThemeDialog', () => ({ CustomThemeDialog: () => null }))
vi.mock('@/components/player/playerShell.layout', () => ({
  getInlineEpisodes: () => undefined,
  getPlayerLayoutClass: () => '',
  getSidePanelClass: () => '',
}))
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

import { render, waitFor, cleanup, act } from '@testing-library/react'
import { PlayerShell } from '../../../apps/web-next/src/components/player/PlayerShell'
import { buildLineKey } from '../../../apps/web-next/src/lib/line-display-name'
import type { Video, VideoSource } from '@resovo/types'

const MOCK_VIDEO: Video = {
  id: 'uuid-video-1',
  shortId: 'aB3kR9x1',
  slug: 'test-slug',
  title: '测试视频',
  type: 'series',
  year: 2026,
  country: 'CN',
  rating: 8.5,
  episodeCount: 2,
  coverUrl: null,
  description: '测试',
  category: null,
  genres: [],
  director: [],
  cast: [],
  writers: [],
  isPublished: false,
  visibilityStatus: 'internal',
  reviewStatus: 'pending_review',
  doubanId: null,
  doubanStatus: 'pending',
  sourceCount: 6,
  status: 'completed',
  metaScore: 80,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
} as unknown as Video

const makeSource = (lineId: string, ep: number, score = 0.5): VideoSource =>
  ({
    id: `${lineId}-e${ep}`,
    videoId: 'uuid-video-1',
    sourceUrl: `https://example.com/${lineId}-e${ep}.m3u8`,
    sourceName: lineId,
    siteDisplayName: lineId,
    quality: '1080P',
    type: 'hls',
    episodeNumber: ep,
    isActive: true,
    effectiveScore: score,
  }) as unknown as VideoSource

// 3 条线路，每条含 ep1/ep2（切集后 VideoPlayer 仍挂载）
const LINE_IDS = ['lineA', 'lineB', 'lineC']
const MOCK_SOURCES = LINE_IDS.flatMap((id) => [makeSource(id, 1), makeSource(id, 2)])
const LINE_KEY = (i: number) => buildLineKey({ siteDisplayName: LINE_IDS[i], sourceName: LINE_IDS[i]! })

beforeEach(() => {
  initPlayerMock.mockClear()
  apiGetMock.mockReset()
  apiPostMock.mockReset()
  apiPostMock.mockResolvedValue({})
  mockState.mode = 'default'
  mockState.currentEpisode = 1
  mockState.activeLineKey = null
  mockState.shortId = ''
  mockState.currentTime = 0
  testCapturedProps = {}
})

afterEach(() => {
  cleanup()
})

async function renderShellAndWaitForPlayer(options?: { previewMode?: boolean }) {
  const view = render(
    <PlayerShell
      slug="test-aB3kR9x1"
      initialVideo={MOCK_VIDEO}
      initialSources={MOCK_SOURCES}
      previewMode={options?.previewMode}
    />,
  )
  await waitFor(() => {
    expect(testCapturedProps.onError).toBeTypeOf('function')
  })
  // 初始活跃线路 = 首条（line0）
  await waitFor(() => expect(mockState.activeLineKey).toBe(LINE_KEY(0)))
  return view
}

function makeControls() {
  return { retry: vi.fn() }
}

describe('PlayerShell onError（PLAYER-LINE-BOUND-EP / 线路键化切线）', () => {
  it('#1 首次 fatal → retry + 3s watchdog 超时切线（line0→line1）+ POST(line0 当前集 sourceId)', async () => {
    await renderShellAndWaitForPlayer()
    vi.useFakeTimers()
    try {
      const onError = testCapturedProps.onError as (e: unknown, c: unknown) => void
      const controls = makeControls()
      await act(async () => {
        onError({ code: 'hls_fatal', src: null, fatal: true }, controls)
      })
      expect(controls.retry).toHaveBeenCalledTimes(1)
      expect(mockState.activeLineKey).toBe(LINE_KEY(0))
      expect(apiPostMock).not.toHaveBeenCalled()

      await act(async () => {
        vi.advanceTimersByTime(3000)
        await Promise.resolve()
      })

      expect(mockState.activeLineKey).toBe(LINE_KEY(1))
      expect(apiPostMock).toHaveBeenCalledWith('/feedback/playback', {
        videoId: 'uuid-video-1',
        sourceId: 'lineA-e1',
        success: false,
        errorCode: 'hls_fatal',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('#1b watchdog 内第二次 fatal → 立即切线 + cancel watchdog + POST', async () => {
    await renderShellAndWaitForPlayer()
    vi.useFakeTimers()
    try {
      const c1 = makeControls()
      await act(async () => {
        ;(testCapturedProps.onError as (e: unknown, c: unknown) => void)({ code: 'hls_fatal', src: null, fatal: true }, c1)
      })
      expect(c1.retry).toHaveBeenCalledTimes(1)
      expect(mockState.activeLineKey).toBe(LINE_KEY(0))

      vi.advanceTimersByTime(1000)
      const c2 = makeControls()
      await act(async () => {
        ;(testCapturedProps.onError as (e: unknown, c: unknown) => void)({ code: 'hls_fatal', src: null, fatal: true }, c2)
      })
      expect(c2.retry).not.toHaveBeenCalled()
      expect(mockState.activeLineKey).toBe(LINE_KEY(1))
      expect(apiPostMock).toHaveBeenCalledTimes(1)

      const keyBefore = mockState.activeLineKey
      vi.advanceTimersByTime(5000)
      await act(async () => { await Promise.resolve() })
      expect(mockState.activeLineKey).toBe(keyBefore)
    } finally {
      vi.useRealTimers()
    }
  })

  it('#2 previewMode=true → retry + 切线，但不 POST（D-160-5 守卫）', async () => {
    await renderShellAndWaitForPlayer({ previewMode: true })
    vi.useFakeTimers()
    try {
      const controls = makeControls()
      await act(async () => {
        ;(testCapturedProps.onError as (e: unknown, c: unknown) => void)({ code: 'native_media_failed', src: null, fatal: true }, controls)
      })
      expect(controls.retry).toHaveBeenCalledTimes(1)
      await act(async () => {
        vi.advanceTimersByTime(3000)
        await Promise.resolve()
      })
      expect(mockState.activeLineKey).toBe(LINE_KEY(1))
      expect(apiPostMock).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('#3 同 (sourceId, errorCode) 去抖不重复 POST', async () => {
    const { rerender } = await renderShellAndWaitForPlayer()
    vi.useFakeTimers()
    try {
      const onError = testCapturedProps.onError as (e: unknown, c: unknown) => void
      await act(async () => { onError({ code: 'hls_fatal', src: null, fatal: true }, makeControls()) })
      await act(async () => { onError({ code: 'hls_fatal', src: null, fatal: true }, makeControls()) })
      expect(apiPostMock).toHaveBeenCalledTimes(1) // POST lineA-e1，切到 line1

      // 复位活跃线路到 line0 + rerender（同步 activeLineRef）构造"lineA-e1 重复失败"场景
      mockState.activeLineKey = LINE_KEY(0)
      await act(async () => {
        rerender(<PlayerShell slug="test-aB3kR9x1" initialVideo={MOCK_VIDEO} initialSources={MOCK_SOURCES} />)
      })
      const onError2 = testCapturedProps.onError as (e: unknown, c: unknown) => void
      await act(async () => { onError2({ code: 'hls_fatal', src: null, fatal: true }, makeControls()) })
      await act(async () => { onError2({ code: 'hls_fatal', src: null, fatal: true }, makeControls()) })
      // lineA-e1|hls_fatal 已上报 → 去抖命中 → 仍 1 次
      expect(apiPostMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('#4 切线后失败上报用新线路当前集 sourceId（lineB-e1）', async () => {
    await renderShellAndWaitForPlayer()
    vi.useFakeTimers()
    try {
      const onError = testCapturedProps.onError as (e: unknown, c: unknown) => void
      await act(async () => { onError({ code: 'hls_fatal', src: null, fatal: true }, makeControls()) })
      await act(async () => { onError({ code: 'hls_fatal', src: null, fatal: true }, makeControls()) })
      expect(apiPostMock).toHaveBeenCalledTimes(1)
      expect(apiPostMock).toHaveBeenLastCalledWith('/feedback/playback', expect.objectContaining({ sourceId: 'lineA-e1' }))
      expect(mockState.activeLineKey).toBe(LINE_KEY(1))

      // 切线后重渲染 → onError 新闭包绑 line1 → lineB-e1
      const onError2 = testCapturedProps.onError as (e: unknown, c: unknown) => void
      const c3 = makeControls()
      await act(async () => { onError2({ code: 'hls_fatal', src: null, fatal: true }, c3) })
      expect(c3.retry).toHaveBeenCalledTimes(1)
      await act(async () => { onError2({ code: 'hls_fatal', src: null, fatal: true }, makeControls()) })
      expect(apiPostMock).toHaveBeenCalledTimes(2)
      expect(apiPostMock).toHaveBeenLastCalledWith('/feedback/playback', {
        videoId: 'uuid-video-1',
        sourceId: 'lineB-e1',
        success: false,
        errorCode: 'hls_fatal',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('#5b 切集 → stale watchdog 取消 + retry 计数清空 + 活跃线路不变', async () => {
    const { rerender } = await renderShellAndWaitForPlayer()
    vi.useFakeTimers()
    try {
      const onError = testCapturedProps.onError as (e: unknown, c: unknown) => void
      const c1 = makeControls()
      await act(async () => { onError({ code: 'hls_fatal', src: null, fatal: true }, c1) })
      expect(c1.retry).toHaveBeenCalledTimes(1)
      const postCountBefore = apiPostMock.mock.calls.length

      // 1s 后切到 ep=2（line0 含 ep2 → VideoPlayer 仍挂载）
      vi.advanceTimersByTime(1000)
      mockState.currentEpisode = 2
      await act(async () => {
        rerender(<PlayerShell slug="test-aB3kR9x1" initialVideo={MOCK_VIDEO} initialSources={MOCK_SOURCES} />)
        await Promise.resolve()
      })

      // stale watchdog 取消 → 不切线 / 不 POST
      vi.advanceTimersByTime(5000)
      await act(async () => { await Promise.resolve() })
      expect(mockState.activeLineKey).toBe(LINE_KEY(0))
      expect(apiPostMock.mock.calls.length).toBe(postCountBefore)

      // retry 计数清空 → 新集再 fatal 仍允许 retry
      const c2 = makeControls()
      await act(async () => {
        ;(testCapturedProps.onError as (e: unknown, c: unknown) => void)({ code: 'hls_fatal', src: null, fatal: true }, c2)
      })
      expect(c2.retry).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('#6 自动兜底按"当前集源"判健康，跳过 current-ep 坏但 representative 健康的线路（Codex stop-time review）', async () => {
    // line0 健康（active 失败）；
    // line1：ep1=0.05（当前集 dead）+ ep2=0.9（representative 健康）→ 旧 representative 守卫会误判可切入；
    // line2：ep1=0.8 健康。currentEpisode=1 → 兜底须跳过 line1 切到 line2。
    const lineKey = (id: string) => buildLineKey({ siteDisplayName: id, sourceName: id })
    const sources = [
      makeSource('lineGood0', 1, 0.8),
      makeSource('lineRepGap1', 1, 0.05),
      makeSource('lineRepGap1', 2, 0.9),
      makeSource('lineGood2', 1, 0.8),
    ]
    render(<PlayerShell slug="test-aB3kR9x1" initialVideo={MOCK_VIDEO} initialSources={sources} />)
    await waitFor(() => expect(testCapturedProps.onError).toBeTypeOf('function'))
    await waitFor(() => expect(mockState.activeLineKey).toBe(lineKey('lineGood0')))
    vi.useFakeTimers()
    try {
      const onError = testCapturedProps.onError as (e: unknown, c: unknown) => void
      await act(async () => { onError({ code: 'hls_fatal', src: null, fatal: true }, makeControls()) })
      await act(async () => { onError({ code: 'hls_fatal', src: null, fatal: true }, makeControls()) })
      // 当前集（ep1）在 line1 是 dead → 跳过，切到 line2（不是 line1，尽管其 representative 健康）
      expect(mockState.activeLineKey).toBe(lineKey('lineGood2'))
      expect(mockState.activeLineKey).not.toBe(lineKey('lineRepGap1'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('#5 retry 后 onPlay 成功 → cancel watchdog + 重置 retry 计数', async () => {
    await renderShellAndWaitForPlayer()
    vi.useFakeTimers()
    try {
      const onError = testCapturedProps.onError as (e: unknown, c: unknown) => void
      const onPlay = testCapturedProps.onPlay as () => void

      const c1 = makeControls()
      await act(async () => { onError({ code: 'hls_fatal', src: null, fatal: true }, c1) })
      expect(c1.retry).toHaveBeenCalledTimes(1)

      await act(async () => { onPlay() })
      vi.advanceTimersByTime(5000)
      await act(async () => { await Promise.resolve() })
      expect(mockState.activeLineKey).toBe(LINE_KEY(0))

      const c2 = makeControls()
      await act(async () => { onError({ code: 'hls_fatal', src: null, fatal: true }, c2) })
      expect(c2.retry).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
