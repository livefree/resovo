/**
 * @vitest-environment jsdom
 *
 * player-shell-on-error.test.tsx — CHG-SN-9-PLAYER-ERROR-CONSUMER-B / Wave 4 #3
 *
 * 覆盖 PlayerShell 接入 player-core onError 后的自动切线 + 标 dead-source + feedback 失败上报：
 *   #1 onError 触发 → 当前 source 标 isDead（SourceBar 渲染 dead 视觉）+ 切到下一非 dead source
 *   #2 全部 source 已 dead → 不切换（保持原 idx）但 feedback 仍上报
 *   #3 previewMode=true → 不调 apiClient.post（D-160-5 守卫）
 *   #4 feedback POST 携带 errorCode + 同 (sourceId, errorCode) 去抖
 *   #5 R-N-3 警告闭环：sources 切线后 event.src 失效 / 关联仍按 activeSourceIndex 稳定
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock next/dynamic + next/navigation + next-intl ──────────────────────────

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
}))

// ── Mock VideoPlayer：暴露 onError 给测试触发 ────────────────────────────────
// dynamic import 在 dynamic mock 之外 → 用 path mock 直接替换 VideoPlayer 模块
import React from 'react'

vi.mock('next/dynamic', () => ({
  default: (_loader: unknown) => {
    // 返回一个组件，转发 props 到 testCapturedProps 暴露
    return function MockVideoPlayer(props: Record<string, unknown>) {
      testCapturedProps = props
      return React.createElement('div', { 'data-mock-video-player': '' })
    }
  },
}))

// 测试期 prop 捕获
let testCapturedProps: Record<string, unknown> = {}

// ── playerStore mock ─────────────────────────────────────────────────────────

const { initPlayerMock, apiGetMock, apiPostMock, mockState } = vi.hoisted(() => {
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

// buildThemedSources：每条 source 透传 src/type/quality + 标签默认 'L1'
vi.mock('@/lib/line-display-name', () => ({
  buildThemedSources: (sources: Array<{ id: string; sourceUrl: string; type: string; quality: string | null }>) =>
    sources.map((s) => ({ src: s.sourceUrl, type: s.type, label: `L-${s.id}`, quality: s.quality, isDead: false, isPending: false })),
  matchActiveSourceIndex: () => 0,
  applyThemeLabels: (arr: unknown[]) => arr,
  buildLineDisplayName: () => 'L1',
}))

vi.mock('@/lib/video-detail', () => ({
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
import { PlayerShell } from '../../../apps/web-next/src/components/player/PlayerShell'
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
  makeSource('src-3', 'https://example.com/v3.m3u8'),
]

beforeEach(() => {
  initPlayerMock.mockClear()
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
  // 等到 VideoPlayer mount + onError prop 可用
  await waitFor(() => {
    expect(testCapturedProps.onError).toBeTypeOf('function')
  })
  return view
}

// 模拟 controls 工厂（ADR-166 / Wave 4 #4-EP）：每次 onError 调用需注入 controls 第 2 参
function makeControls() {
  return { retry: vi.fn() }
}

describe('PlayerShell onError — CHG-SN-9-PLAYER-ERROR-CONSUMER-B / Wave 4 #3 + RETRY-CONTROL-EP / Wave 4 #4-EP', () => {
  it('#1 首次 fatal → 调 controls.retry()（不切线 / 启 watchdog）+ 3s 超时后才切线 + POST', async () => {
    await renderShellAndWaitForPlayer()
    vi.useFakeTimers()
    try {
      expect(mockState.activeSourceIndex).toBe(0)

      const onError = testCapturedProps.onError as (e: unknown, c: unknown) => void
      const controls = makeControls()
      await act(async () => {
        onError({ code: 'hls_fatal', src: MOCK_SOURCES[0].sourceUrl, fatal: true }, controls)
      })

      // 首次 fatal → 调 retry / 不切线 / 不 POST（watchdog 内未超时）
      expect(controls.retry).toHaveBeenCalledTimes(1)
      expect(mockState.activeSourceIndex).toBe(0)
      expect(apiPostMock).not.toHaveBeenCalled()

      // 推进 3s watchdog 超时 / act flush React 同步
      await act(async () => {
        vi.advanceTimersByTime(3000)
        await Promise.resolve()
      })

      // 切线 + POST（fake timers 下用 sync expect / waitFor 内部 setTimeout 会被冻结）
      expect(mockState.activeSourceIndex).toBe(1)
      expect(apiPostMock).toHaveBeenCalledWith('/feedback/playback', {
        videoId: 'uuid-video-1',
        sourceId: 'src-1',
        success: false,
        errorCode: 'hls_fatal',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('#1b 首次 fatal → retry / 第二次 fatal（watchdog 内）→ 立即切线 + cancel watchdog + POST', async () => {
    await renderShellAndWaitForPlayer()
    vi.useFakeTimers()
    try {
      const onError = testCapturedProps.onError as (e: unknown, c: unknown) => void

      const c1 = makeControls()
      await act(async () => {
        onError({ code: 'hls_fatal', src: null, fatal: true }, c1)
      })
      expect(c1.retry).toHaveBeenCalledTimes(1)
      expect(mockState.activeSourceIndex).toBe(0)

      // 1s 内第二次 fatal（watchdog 未超时）→ 立即切线 / 第二次不再 retry
      vi.advanceTimersByTime(1000)
      const onError2 = testCapturedProps.onError as (e: unknown, c: unknown) => void
      const c2 = makeControls()
      await act(async () => {
        onError2({ code: 'hls_fatal', src: null, fatal: true }, c2)
      })

      expect(c2.retry).not.toHaveBeenCalled()
      expect(mockState.activeSourceIndex).toBe(1)
      expect(apiPostMock).toHaveBeenCalledTimes(1)

      // 推进时间到 watchdog 应触发的点 → watchdog 已 cancel / 不应再切线
      const switchCountBefore = mockState.activeSourceIndex
      vi.advanceTimersByTime(5000)
      await act(async () => { await Promise.resolve() })
      expect(mockState.activeSourceIndex).toBe(switchCountBefore)
    } finally {
      vi.useRealTimers()
    }
  })

  it('#2 previewMode=true → retry + watchdog 3s 后切线，但不 POST feedback（D-160-5 守卫）', async () => {
    await renderShellAndWaitForPlayer({ previewMode: true })
    vi.useFakeTimers()
    try {
      const onError = testCapturedProps.onError as (e: unknown, c: unknown) => void
      const controls = makeControls()
      await act(async () => {
        onError({ code: 'native_media_failed', src: null, fatal: true }, controls)
      })
      expect(controls.retry).toHaveBeenCalledTimes(1)

      await act(async () => {
        vi.advanceTimersByTime(3000)
        await Promise.resolve()
      })
      expect(mockState.activeSourceIndex).toBe(1)
      expect(apiPostMock).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('#3 同 (sourceId, errorCode) 第二次 onError 不重复 POST（去抖 / 防 fatal 刷流量）', async () => {
    await renderShellAndWaitForPlayer()
    vi.useFakeTimers()
    try {
      const onError = testCapturedProps.onError as (e: unknown, c: unknown) => void

      // 首次 fatal + 立即第二次 fatal（绕 retry）→ 切线 + POST 1 次
      const c1 = makeControls()
      await act(async () => {
        onError({ code: 'hls_fatal', src: null, fatal: true }, c1)
      })
      const c2 = makeControls()
      await act(async () => {
        onError({ code: 'hls_fatal', src: null, fatal: true }, c2)
      })
      expect(apiPostMock).toHaveBeenCalledTimes(1)

      // 复位 activeSourceIndex=0 构造"src-1 重复失败"场景
      mockState.activeSourceIndex = 0
      // 两次 fatal 触发切线但 dedupe 拦截
      const c3 = makeControls()
      await act(async () => {
        onError({ code: 'hls_fatal', src: null, fatal: true }, c3)
      })
      const c4 = makeControls()
      await act(async () => {
        onError({ code: 'hls_fatal', src: null, fatal: true }, c4)
      })
      // 仍只 1 次 POST（dedupe 命中）
      expect(apiPostMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('#4 切线后新 source 的失败上报用最新 activeSourceIndex 关联（R-N-3 闭环 / sourceId=src-2）', async () => {
    await renderShellAndWaitForPlayer()
    vi.useFakeTimers()
    try {
      const onError1 = testCapturedProps.onError as (e: unknown, c: unknown) => void
      const c1 = makeControls()
      await act(async () => {
        onError1({ code: 'hls_fatal', src: null, fatal: true }, c1)
      })
      const c2 = makeControls()
      await act(async () => {
        onError1({ code: 'hls_fatal', src: null, fatal: true }, c2)
      })
      expect(apiPostMock).toHaveBeenCalledTimes(1)
      expect(apiPostMock).toHaveBeenLastCalledWith('/feedback/playback', expect.objectContaining({ sourceId: 'src-1' }))
      expect(mockState.activeSourceIndex).toBe(1)

      // 切线后 PlayerShell 重渲染 → onError 新闭包绑 activeSourceIndex=1 → src-2
      const onError2 = testCapturedProps.onError as (e: unknown, c: unknown) => void
      const c3 = makeControls()
      await act(async () => {
        onError2({ code: 'hls_fatal', src: null, fatal: true }, c3)
      })
      // 新 source / 新 idx / 算首次 fatal → retry + watchdog
      expect(c3.retry).toHaveBeenCalledTimes(1)
      const c4 = makeControls()
      await act(async () => {
        onError2({ code: 'hls_fatal', src: null, fatal: true }, c4)
      })
      expect(apiPostMock).toHaveBeenCalledTimes(2)
      expect(apiPostMock).toHaveBeenLastCalledWith('/feedback/playback', {
        videoId: 'uuid-video-1',
        sourceId: 'src-2',
        success: false,
        errorCode: 'hls_fatal',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('#5 retry 后 onPlay 成功 → cancel watchdog + 重置 retry 计数 / 下一次 fatal 仍允许 retry', async () => {
    await renderShellAndWaitForPlayer()
    vi.useFakeTimers()
    try {
      const onError = testCapturedProps.onError as (e: unknown, c: unknown) => void
      const onPlay = testCapturedProps.onPlay as () => void

      const c1 = makeControls()
      await act(async () => {
        onError({ code: 'hls_fatal', src: null, fatal: true }, c1)
      })
      expect(c1.retry).toHaveBeenCalledTimes(1)

      // 模拟 retry 后播放成功 → cancel watchdog + 清 retry 计数
      await act(async () => { onPlay() })
      // 推进时间到 watchdog 应触发的点 → 已 cancel / 不切线
      vi.advanceTimersByTime(5000)
      await act(async () => { await Promise.resolve() })
      expect(mockState.activeSourceIndex).toBe(0)

      // 同 idx 再 fatal → 允许 retry 一次（计数已清空）
      const c2 = makeControls()
      await act(async () => {
        onError({ code: 'hls_fatal', src: null, fatal: true }, c2)
      })
      expect(c2.retry).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
