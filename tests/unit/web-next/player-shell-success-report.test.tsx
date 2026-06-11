/**
 * @vitest-environment jsdom
 *
 * player-shell-success-report.test.tsx — SRCHEALTH-P2-1 / F1（SEQ-20260610-02）
 *
 * 覆盖 PlayerShell 首播成功上报 success:true：
 *   #1 onPlay 首次触发 → POST /feedback/playback { videoId, sourceId, success: true }
 *   #2 同 sourceId 第二次 onPlay（pause→resume）→ 不重复 POST（per-sourceId 去抖）
 *   #3 previewMode=true → 不 POST（ADR-160 D-160-5 守卫）
 *   #4 切线后新 sourceId onPlay → 各自上报一次（去抖按 sourceId 隔离）
 *   #5 采样未中 → 不 POST 且记入去抖集（每 source 首播事件恰好掷一次骰，保 1/N 语义）
 *   #6 getSuccessSampleN / shouldReportPlaySuccess 纯函数边界
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock next/dynamic + next/navigation + next-intl ──────────────────────────

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
}))

// ── Mock VideoPlayer：暴露 onPlay 给测试触发 ─────────────────────────────────
import React from 'react'

vi.mock('next/dynamic', () => ({
  default: (_loader: unknown) => {
    return function MockVideoPlayer(props: Record<string, unknown>) {
      testCapturedProps = props
      return React.createElement('div', { 'data-mock-video-player': '' })
    }
  },
}))

let testCapturedProps: Record<string, unknown> = {}

// ── playerStore mock ─────────────────────────────────────────────────────────

const { apiGetMock, apiPostMock, mockState } = vi.hoisted(() => {
  const state = {
    mode: 'default' as 'default' | 'theater',
    currentEpisode: 1,
    activeSourceIndex: 0,
    shortId: '',
    currentTime: 0,
    setMode: vi.fn(),
    initPlayer: vi.fn((shortId: string, ep: number) => {
      state.shortId = shortId
      state.currentEpisode = ep
      state.currentTime = 0
      state.activeSourceIndex = 0
    }),
    setEpisode: vi.fn((ep: number) => {
      state.currentEpisode = ep
    }),
    setPlaying: vi.fn(),
    setCurrentTime: vi.fn(),
    setDuration: vi.fn(),
    setActiveSourceIndex: vi.fn((i: number) => {
      state.activeSourceIndex = i
    }),
    hostOrigin: null,
  }
  return {
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

vi.mock('@/lib/line-display-name', () => ({
  buildThemedSources: (sources: Array<{ id: string; sourceUrl: string; type: string; quality: string | null }>) =>
    sources.map((s) => ({ src: s.sourceUrl, type: s.type, label: `L-${s.id}`, quality: s.quality, isDead: false, isPending: false })),
  matchActiveSourceIndex: () => 0,
  applyThemeLabels: (arr: unknown[]) => arr,
  buildLineDisplayName: () => 'L1',
}))

vi.mock('@/lib/short-id', () => ({
  extractShortId: (slug: string) => slug.split('-').pop() ?? slug,
}))

// 稳定单例 mock：useRouteTheme 每次必须返回同引用，否则 PlayerShell useEffect([routeTheme]) 依赖每渲染失配 → 无限重渲染 → OOM
const STABLE_ROUTE_THEME = Object.freeze({ labels: ['立春'], deadLabel: '已断', pendingLabel: '未测' })
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
vi.mock('@/components/player/RouteThemeSelector', () => ({
  RouteThemeSelector: () => null,
}))
vi.mock('@/components/player/CustomThemeDialog', () => ({
  CustomThemeDialog: () => null,
}))
vi.mock('@/components/player/playerShell.layout', () => ({
  getInlineEpisodes: () => null,
  getPlayerLayoutClass: () => '',
  getSidePanelClass: () => '',
}))
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

import { render, waitFor, cleanup, act } from '@testing-library/react'
import {
  PlayerShell,
  getSuccessSampleN,
  shouldReportPlaySuccess,
} from '../../../apps/web-next/src/components/player/PlayerShell'
import type { Video, VideoSource } from '@resovo/types'

const MOCK_VIDEO: Video = {
  id: 'uuid-video-1',
  shortId: 'aB3kR9x1',
  slug: 'test-slug',
  title: '测试视频',
  type: 'movie',
  year: 2026,
  country: 'CN',
  rating: 8.5,
  episodeCount: 1,
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
  sourceCount: 3,
  status: 'completed',
  metaScore: 80,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
} as unknown as Video

const makeSource = (id: string, sourceUrl: string): VideoSource =>
  ({
    id,
    videoId: 'uuid-video-1',
    sourceUrl,
    sourceName: id,
    siteDisplayName: id,
    quality: '1080P',
    type: 'hls',
    episodeNumber: 1,
    isActive: true,
  }) as unknown as VideoSource

const MOCK_SOURCES = [
  makeSource('src-1', 'https://example.com/v1.m3u8'),
  makeSource('src-2', 'https://example.com/v2.m3u8'),
]

beforeEach(() => {
  apiGetMock.mockClear()
  apiGetMock.mockReset()
  apiPostMock.mockClear()
  apiPostMock.mockReset()
  apiPostMock.mockResolvedValue({})
  mockState.mode = 'default'
  mockState.currentEpisode = 1
  mockState.activeSourceIndex = 0
  mockState.shortId = ''
  mockState.currentTime = 0
  testCapturedProps = {}
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
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
    expect(testCapturedProps.onPlay).toBeTypeOf('function')
  })
  return view
}

describe('PlayerShell success 上报 — SRCHEALTH-P2-1 / F1', () => {
  it('#1 onPlay 首次触发 → POST success:true（videoId + 当前线路 raw sourceId）', async () => {
    await renderShellAndWaitForPlayer()
    const onPlay = testCapturedProps.onPlay as () => void

    await act(async () => { onPlay() })

    expect(apiPostMock).toHaveBeenCalledTimes(1)
    expect(apiPostMock).toHaveBeenCalledWith('/feedback/playback', {
      videoId: 'uuid-video-1',
      sourceId: 'src-1',
      success: true,
    })
  })

  it('#2 同 sourceId 第二次 onPlay（pause→resume）→ 不重复 POST', async () => {
    await renderShellAndWaitForPlayer()
    const onPlay = testCapturedProps.onPlay as () => void

    await act(async () => { onPlay() })
    await act(async () => { onPlay() })

    expect(apiPostMock).toHaveBeenCalledTimes(1)
  })

  it('#3 previewMode=true → 不 POST（D-160-5 守卫）', async () => {
    await renderShellAndWaitForPlayer({ previewMode: true })
    const onPlay = testCapturedProps.onPlay as () => void

    await act(async () => { onPlay() })

    expect(apiPostMock).not.toHaveBeenCalled()
  })

  it('#4 切线后新 sourceId onPlay → 各自上报一次（去抖按 sourceId 隔离）', async () => {
    const { rerender } = await renderShellAndWaitForPlayer()
    const onPlay1 = testCapturedProps.onPlay as () => void
    await act(async () => { onPlay1() })
    expect(apiPostMock).toHaveBeenLastCalledWith('/feedback/playback', expect.objectContaining({ sourceId: 'src-1' }))

    // 切线到 idx=1 / rerender 让 handlePlaySuccess 闭包绑最新 activeSourceIndex
    mockState.activeSourceIndex = 1
    await act(async () => {
      rerender(
        <PlayerShell
          slug="test-aB3kR9x1"
          initialVideo={MOCK_VIDEO}
          initialSources={MOCK_SOURCES}
        />,
      )
    })
    const onPlay2 = testCapturedProps.onPlay as () => void
    await act(async () => { onPlay2() })

    expect(apiPostMock).toHaveBeenCalledTimes(2)
    expect(apiPostMock).toHaveBeenLastCalledWith('/feedback/playback', {
      videoId: 'uuid-video-1',
      sourceId: 'src-2',
      success: true,
    })

    // 切回 src-1 再 onPlay → 已消费不重报
    mockState.activeSourceIndex = 0
    await act(async () => {
      rerender(
        <PlayerShell
          slug="test-aB3kR9x1"
          initialVideo={MOCK_VIDEO}
          initialSources={MOCK_SOURCES}
        />,
      )
    })
    const onPlay3 = testCapturedProps.onPlay as () => void
    await act(async () => { onPlay3() })
    expect(apiPostMock).toHaveBeenCalledTimes(2)
  })

  it('#5 采样未中 → 不 POST 且记入去抖集（首播事件恰好掷一次骰 / 后续 onPlay 不再掷）', async () => {
    // N 极大 + random=0.5 → 0.5 < 1/N 必为 false → 采样未中
    vi.stubEnv('NEXT_PUBLIC_FEEDBACK_SUCCESS_SAMPLE_N', '1000000')
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)

    await renderShellAndWaitForPlayer()
    const onPlay = testCapturedProps.onPlay as () => void

    await act(async () => { onPlay() })
    expect(apiPostMock).not.toHaveBeenCalled()
    expect(randomSpy).toHaveBeenCalledTimes(1)

    // 第二次 onPlay → 去抖集已记入 → 不再掷骰也不 POST（防反复掷骰逼近全量、破坏 1/N 语义）
    await act(async () => { onPlay() })
    expect(apiPostMock).not.toHaveBeenCalled()
    expect(randomSpy).toHaveBeenCalledTimes(1)
  })

  it('#6 getSuccessSampleN / shouldReportPlaySuccess 纯函数边界', () => {
    // 默认（未配置）→ 1
    vi.unstubAllEnvs()
    expect(getSuccessSampleN()).toBe(1)
    // 合法 N
    vi.stubEnv('NEXT_PUBLIC_FEEDBACK_SUCCESS_SAMPLE_N', '4')
    expect(getSuccessSampleN()).toBe(4)
    // 非法值回退 1（非整数 / 0 / 负数 / NaN）
    for (const bad of ['1.5', '0', '-2', 'abc', '']) {
      vi.stubEnv('NEXT_PUBLIC_FEEDBACK_SUCCESS_SAMPLE_N', bad)
      expect(getSuccessSampleN()).toBe(1)
    }

    // N=1 恒真（任意 random）
    expect(shouldReportPlaySuccess(1, 0)).toBe(true)
    expect(shouldReportPlaySuccess(1, 0.999999)).toBe(true)
    // N=4：random < 0.25 命中
    expect(shouldReportPlaySuccess(4, 0.249)).toBe(true)
    expect(shouldReportPlaySuccess(4, 0.25)).toBe(false)
    expect(shouldReportPlaySuccess(4, 0.9)).toBe(false)
  })
})
