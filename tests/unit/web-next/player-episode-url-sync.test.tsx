/**
 * player-episode-url-sync.test.tsx — BUGFIX-WATCH-EP-URL（Bug 2）
 *
 * 播放页切换选集应把当前集号写回 URL（history.replaceState）：
 * - 点击侧栏选集 → replaceState 携带 `?ep=<集号>`（地址栏即时反映 + 刷新可恢复）
 * - portalMode（全局播放器）→ 不改 URL（不污染任意路由地址）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/dynamic', () => ({ default: () => () => null }))

const searchParamsGet = vi.fn().mockReturnValue(null)
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: searchParamsGet }),
}))

vi.mock('next-intl', () => ({ useLocale: () => 'zh-CN' }))

const { apiGetMock, mockState } = vi.hoisted(() => {
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
  return { apiGetMock: vi.fn(), mockState: state }
})

vi.mock('@/stores/playerStore', () => {
  const usePlayerStore = (selector?: (s: typeof mockState) => unknown) =>
    selector ? selector(mockState) : mockState
  ;(usePlayerStore as unknown as { getState: () => typeof mockState }).getState = () => mockState
  return { usePlayerStore }
})

vi.mock('@/lib/api-client', () => ({ apiClient: { get: apiGetMock, post: vi.fn() } }))
vi.mock('@/lib/video-route', () => ({ getVideoDetailHref: () => '/movie/test-slug-aB3kR9x1' }))
vi.mock('@/lib/short-id', () => ({
  extractShortId: (slug: string) => slug.split('-').pop() ?? slug,
}))
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
vi.mock('@/components/player/ResumePrompt', () => ({ ResumePrompt: () => null, saveProgress: vi.fn() }))
vi.mock('@/components/player/playerShell.layout', () => ({
  getInlineEpisodes: () => undefined,
  getPlayerLayoutClass: () => '',
  getSidePanelClass: () => '',
}))
vi.mock('@/lib/utils', () => ({ cn: (...args: unknown[]) => args.filter(Boolean).join(' ') }))

import { render, fireEvent, cleanup, screen } from '@testing-library/react'
import { PlayerShell } from '../../../apps/web-next/src/components/player/PlayerShell'
import type { Video, VideoSource } from '@resovo/types'

const MOCK_VIDEO: Video = {
  id: 'uuid-1',
  shortId: 'aB3kR9x1',
  slug: 'test-slug',
  title: '测试剧集',
  type: 'series',
  year: 2026,
  country: 'CN',
  rating: 8.5,
  episodeCount: 3,
  coverUrl: null,
  description: '测试',
  category: null,
  genres: [],
  director: [],
  cast: [],
  writers: [],
  isPublished: true,
  visibilityStatus: 'public',
  reviewStatus: 'approved',
  doubanId: null,
  doubanStatus: 'pending',
  sourceCount: 1,
  status: 'completed',
  metaScore: 80,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
} as unknown as Video

/** 同一线路（buildLineKey 一致）三集源 → 矩阵单线路 episodeNumbers=[1,2,3] */
function makeSource(ep: number): VideoSource {
  return {
    id: `s${ep}`,
    videoId: 'uuid-1',
    sourceUrl: `https://example.com/play-${ep}.m3u8`,
    sourceName: 'L1',
    siteDisplayName: 'L1',
    quality: '1080P',
    type: 'hls',
    episodeNumber: ep,
    isActive: true,
    effectiveScore: 0.8,
  } as unknown as VideoSource
}

const MOCK_SOURCES = [makeSource(1), makeSource(2), makeSource(3)]

describe('PlayerShell 选集 URL 同步 — BUGFIX-WATCH-EP-URL', () => {
  let replaceStateSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockState.mode = 'default'
    mockState.currentEpisode = 1
    mockState.activeLineKey = null
    mockState.shortId = ''
    mockState.currentTime = 0
    mockState.setEpisode.mockClear()
    searchParamsGet.mockReset()
    searchParamsGet.mockReturnValue(null)
    replaceStateSpy = vi.spyOn(window.history, 'replaceState')
  })

  afterEach(() => {
    replaceStateSpy.mockRestore()
    cleanup()
  })

  it('点击侧栏选集 → replaceState 写 ?ep=2', async () => {
    render(<PlayerShell slug="test-aB3kR9x1" initialVideo={MOCK_VIDEO} initialSources={MOCK_SOURCES} />)
    const btn = await screen.findByTestId('side-episode-2')
    replaceStateSpy.mockClear()
    fireEvent.click(btn)
    expect(mockState.setEpisode).toHaveBeenCalledWith(2)
    expect(replaceStateSpy).toHaveBeenCalledTimes(1)
    const url = replaceStateSpy.mock.calls[0]![2] as string
    expect(new URLSearchParams(url.split('?')[1]).get('ep')).toBe('2')
  })

  it('portalMode → 不改 URL（replaceState 不被调用）', async () => {
    render(<PlayerShell slug="test-aB3kR9x1" portalMode initialVideo={MOCK_VIDEO} initialSources={MOCK_SOURCES} />)
    const btn = await screen.findByTestId('side-episode-3')
    replaceStateSpy.mockClear()
    fireEvent.click(btn)
    expect(mockState.setEpisode).toHaveBeenCalledWith(3)
    expect(replaceStateSpy).not.toHaveBeenCalled()
  })
})
