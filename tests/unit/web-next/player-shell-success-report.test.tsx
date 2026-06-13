/**
 * @vitest-environment jsdom
 *
 * player-shell-success-report.test.tsx — SRCHEALTH-P2-1 / F1（PLAYER-LINE-BOUND-EP 重写）
 *
 * 首播成功上报 success:true：
 *   #1 onPlay 首次 → POST { videoId, sourceId（活跃线路当前集）, success: true }
 *   #2 同 sourceId 第二次 onPlay → 不重复 POST（per-sourceId 去抖）
 *   #3 previewMode=true → 不 POST（D-160-5 守卫）
 *   #4 切线后新 sourceId onPlay → 各自上报一次（去抖按 sourceId 隔离）
 *   #5 采样未中 → 不 POST 且记入去抖集
 *   #6 getSuccessSampleN / shouldReportPlaySuccess 纯函数边界
 *
 * sourceId 经 activeLineKey 解析当前集源（红线 1）；line-matrix/line-display-name 用真实实现。
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

const { apiGetMock, apiPostMock, mockState } = vi.hoisted(() => {
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
  id: 'jie_qi', displayName: '节气', labels: ['立春', '雨水'], deadLabel: '已断', fallbackPrefix: '线路',
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
import {
  PlayerShell,
  getSuccessSampleN,
  shouldReportPlaySuccess,
} from '../../../apps/web-next/src/components/player/PlayerShell'
import { buildLineKey } from '../../../apps/web-next/src/lib/line-display-name'
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
  sourceCount: 2,
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
    effectiveScore: 0.5,
  }) as unknown as VideoSource

const MOCK_SOURCES = [
  makeSource('src-1', 'https://example.com/v1.m3u8'),
  makeSource('src-2', 'https://example.com/v2.m3u8'),
]
const LINE_KEY = (i: number) =>
  buildLineKey({ siteDisplayName: MOCK_SOURCES[i]!.siteDisplayName, sourceName: MOCK_SOURCES[i]!.sourceName })

beforeEach(() => {
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
  await waitFor(() => expect(mockState.activeLineKey).toBe(LINE_KEY(0)))
  return view
}

describe('PlayerShell success 上报 — SRCHEALTH-P2-1 / F1（线路键化）', () => {
  it('#1 onPlay 首次 → POST success:true（活跃线路当前集 sourceId）', async () => {
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

  it('#2 同 sourceId 第二次 onPlay → 不重复 POST', async () => {
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

    // 切线到 line1（src-2）
    mockState.activeLineKey = LINE_KEY(1)
    await act(async () => {
      rerender(<PlayerShell slug="test-aB3kR9x1" initialVideo={MOCK_VIDEO} initialSources={MOCK_SOURCES} />)
    })
    const onPlay2 = testCapturedProps.onPlay as () => void
    await act(async () => { onPlay2() })
    expect(apiPostMock).toHaveBeenCalledTimes(2)
    expect(apiPostMock).toHaveBeenLastCalledWith('/feedback/playback', {
      videoId: 'uuid-video-1',
      sourceId: 'src-2',
      success: true,
    })

    // 切回 line0 再 onPlay → 已消费不重报
    mockState.activeLineKey = LINE_KEY(0)
    await act(async () => {
      rerender(<PlayerShell slug="test-aB3kR9x1" initialVideo={MOCK_VIDEO} initialSources={MOCK_SOURCES} />)
    })
    const onPlay3 = testCapturedProps.onPlay as () => void
    await act(async () => { onPlay3() })
    expect(apiPostMock).toHaveBeenCalledTimes(2)
  })

  it('#5 采样未中 → 不 POST 且记入去抖集', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEEDBACK_SUCCESS_SAMPLE_N', '1000000')
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)

    await renderShellAndWaitForPlayer()
    const onPlay = testCapturedProps.onPlay as () => void

    await act(async () => { onPlay() })
    expect(apiPostMock).not.toHaveBeenCalled()
    expect(randomSpy).toHaveBeenCalledTimes(1)

    await act(async () => { onPlay() })
    expect(apiPostMock).not.toHaveBeenCalled()
    expect(randomSpy).toHaveBeenCalledTimes(1)
  })

  it('#6 getSuccessSampleN / shouldReportPlaySuccess 纯函数边界', () => {
    vi.unstubAllEnvs()
    expect(getSuccessSampleN()).toBe(1)
    vi.stubEnv('NEXT_PUBLIC_FEEDBACK_SUCCESS_SAMPLE_N', '4')
    expect(getSuccessSampleN()).toBe(4)
    for (const bad of ['1.5', '0', '-2', 'abc', '']) {
      vi.stubEnv('NEXT_PUBLIC_FEEDBACK_SUCCESS_SAMPLE_N', bad)
      expect(getSuccessSampleN()).toBe(1)
    }
    expect(shouldReportPlaySuccess(1, 0)).toBe(true)
    expect(shouldReportPlaySuccess(1, 0.999999)).toBe(true)
    expect(shouldReportPlaySuccess(4, 0.249)).toBe(true)
    expect(shouldReportPlaySuccess(4, 0.25)).toBe(false)
    expect(shouldReportPlaySuccess(4, 0.9)).toBe(false)
  })
})
