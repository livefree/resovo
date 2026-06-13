/**
 * player-shell-hydration.test.tsx — PLAYER-LINE-BOUND-EP（重写）/ ADR-160 AMENDMENT 2 D-160-AMD2-3
 *
 * 线路优先模型下的 server-side hydration 拉取行为：
 * - initialVideo + initialSources（shortId 匹配）→ 完全跳过 client fetch
 * - 无 initialVideo → 走 client video fetch + 全集 sources fetch
 * - initialVideo + 无 initialSources → sources 走 client fetch `/sources`（省略 episode / 取全集）
 * - initialVideo.shortId ≠ 当前 shortId → 不复用 stale props，client 全拉（防客户端切视频命中 SSR stale）
 *
 * 关键：新模型一次拉全集源（`/sources` 无 `?episode`），不再 per-episode 重拉。
 * line-matrix / line-display-name 为纯函数，本测试直接用真实实现（无需 mock）。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}))

const searchParamsGet = vi.fn().mockReturnValue(null)
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: searchParamsGet }),
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
}))

const { initPlayerMock, apiGetMock, mockState } = vi.hoisted(() => {
  const state = {
    mode: 'default',
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
  apiClient: { get: apiGetMock, post: vi.fn() },
}))

vi.mock('@/lib/video-route', () => ({
  getVideoDetailHref: () => '/movie/test-slug-aB3kR9x1',
}))

vi.mock('@/lib/short-id', () => ({
  extractShortId: (slug: string) => slug.split('-').pop() ?? slug,
}))

// useRouteTheme：本测试只关心 fetch 行为，stub 主题/偏好同步子系统（提供有效 RouteTheme 供真实 buildThemedLines 消费）
vi.mock('@/lib/route-theme-storage', () => {
  const theme = { id: 'jie_qi', displayName: '节气', labels: ['立春', '雨水'], deadLabel: '已断', fallbackPrefix: '线路' }
  const noop = () => {}
  return {
    useRouteTheme: () => ({
      theme,
      customTheme: null,
      syncing: false,
      setTheme: noop,
      setCustomTheme: noop,
      clearCustomTheme: noop,
    }),
  }
})

vi.mock('@/components/player/SourceBar', () => ({ SourceBar: () => null }))
vi.mock('@/components/player/RouteThemeSelector', () => ({ RouteThemeSelector: () => null }))
vi.mock('@/components/player/ResumePrompt', () => ({
  ResumePrompt: () => null,
  saveProgress: vi.fn(),
}))
vi.mock('@/components/player/playerShell.layout', () => ({
  getInlineEpisodes: () => undefined,
  getPlayerLayoutClass: () => '',
  getSidePanelClass: () => '',
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

import { render, waitFor, cleanup } from '@testing-library/react'
import { PlayerShell } from '../../../apps/web-next/src/components/player/PlayerShell'
import type { Video, VideoSource } from '@resovo/types'

const MOCK_VIDEO: Video = {
  id: 'uuid-1',
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
  sourceCount: 1,
  status: 'completed',
  metaScore: 80,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
} as unknown as Video

const MOCK_SOURCE: VideoSource = {
  id: 's1',
  videoId: 'uuid-1',
  sourceUrl: 'https://example.com/play.m3u8',
  sourceName: 'L1',
  siteDisplayName: 'L1',
  quality: '1080P',
  type: 'hls',
  episodeNumber: 1,
  isActive: true,
  effectiveScore: 0.8,
} as unknown as VideoSource

describe('PlayerShell hydration（PLAYER-LINE-BOUND-EP / 线路优先一次拉全集）', () => {
  beforeEach(() => {
    initPlayerMock.mockClear()
    apiGetMock.mockReset()
    searchParamsGet.mockReset()
    searchParamsGet.mockReturnValue(null)
    mockState.mode = 'default'
    mockState.currentEpisode = 1
    mockState.activeLineKey = null
    mockState.shortId = ''
    mockState.currentTime = 0
  })

  afterEach(() => {
    cleanup()
  })

  it('有 initialVideo + initialSources（shortId 匹配）→ 完全跳过 client fetch', async () => {
    render(<PlayerShell slug="test-aB3kR9x1" initialVideo={MOCK_VIDEO} initialSources={[MOCK_SOURCE]} />)
    await waitFor(() => expect(initPlayerMock).toHaveBeenCalled())
    expect(apiGetMock).not.toHaveBeenCalled()
  })

  it('无 initialVideo → 走 client video fetch', async () => {
    apiGetMock.mockImplementation((url: string) =>
      url.includes('/sources') ? Promise.resolve({ data: [MOCK_SOURCE] }) : Promise.resolve({ data: MOCK_VIDEO })
    )
    render(<PlayerShell slug="test-aB3kR9x1" />)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    const calls = apiGetMock.mock.calls.map((c) => c[0] as string)
    expect(calls.some((url) => url.includes('/videos/aB3kR9x1') && !url.includes('/sources'))).toBe(true)
  })

  it('有 initialVideo + 无 initialSources → sources 走 client fetch `/sources`（无 ?episode / 全集）', async () => {
    apiGetMock.mockResolvedValue({ data: [MOCK_SOURCE] })
    render(<PlayerShell slug="test-aB3kR9x1" initialVideo={MOCK_VIDEO} />)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    const calls = apiGetMock.mock.calls.map((c) => c[0] as string)
    // 不调裸 video fetch
    expect(calls.some((url) => url.endsWith('/videos/aB3kR9x1'))).toBe(false)
    // 调 sources fetch（全集 / 无 ?episode）
    expect(calls.some((url) => url.includes('/videos/aB3kR9x1/sources'))).toBe(true)
    // 不再 per-episode 拉取
    expect(calls.some((url) => url.includes('?episode='))).toBe(false)
    // 仅 1 次 sources fetch（无双拉）
    expect(calls.filter((url) => url.includes('/sources')).length).toBe(1)
  })

  it('initialVideo.shortId ≠ 当前 shortId → 不复用 stale props，client 全拉（切视频防 stale）', async () => {
    apiGetMock.mockImplementation((url: string) =>
      url.includes('/sources') ? Promise.resolve({ data: [MOCK_SOURCE] }) : Promise.resolve({ data: MOCK_VIDEO })
    )
    // initialVideo 是 aB3kR9x1，但当前路由 slug 是另一个 shortId
    render(<PlayerShell slug="other-CCCCCCCC" initialVideo={MOCK_VIDEO} initialSources={[MOCK_SOURCE]} />)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    const calls = apiGetMock.mock.calls.map((c) => c[0] as string)
    expect(calls.some((url) => url.includes('/videos/CCCCCCCC') && !url.includes('/sources'))).toBe(true)
    expect(calls.some((url) => url.includes('/videos/CCCCCCCC/sources'))).toBe(true)
  })
})
