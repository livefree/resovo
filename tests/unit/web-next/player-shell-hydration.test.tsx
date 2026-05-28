/**
 * player-shell-hydration.test.tsx — CHG-361-E3 / ADR-160 AMENDMENT 2 D-160-AMD2-3
 *
 * 覆盖 PlayerShell initialVideo + initialSources props 的 server-side hydration 行为：
 * - 有 initialVideo → 跳过 client video fetch（apiClient.get videos 不调）
 * - 无 initialVideo → 走 client video fetch（apiClient.get videos 调 1 次）
 * - 有 initialSources + ep=1 → 跳过 sources fetch（仅 1 次 apiClient.get）
 * - 有 initialVideo + 无 initialSources → sources 仍走 client fetch
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// dynamic VideoPlayer mock：避免 SSR-only import
vi.mock('next/dynamic', () => ({
  default: () => () => null,
}))

// next/navigation mock
const searchParamsGet = vi.fn().mockReturnValue(null)
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: searchParamsGet }),
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
}))

// playerStore + apiClient mock — vi.hoisted 保证在 vi.mock 工厂之前初始化
// mockState 暴露为可变，模拟切集时由测试代码改写 currentEpisode + rerender 触发 episode-switch effect
const { initPlayerMock, apiGetMock, mockState } = vi.hoisted(() => {
  const state = {
    mode: 'default',
    currentEpisode: 1,
    activeSourceIndex: 0,
    shortId: '',
    currentTime: 0,
    setMode: vi.fn(),
    initPlayer: vi.fn(),
    setEpisode: vi.fn(),
    setPlaying: vi.fn(),
    setCurrentTime: vi.fn(),
    setDuration: vi.fn(),
    setActiveSourceIndex: vi.fn(),
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
  apiClient: { get: apiGetMock },
}))

// brand / route 工具
vi.mock('@/lib/video-route', () => ({
  getVideoDetailHref: () => '/movie/test-slug-aB3kR9x1',
}))

vi.mock('@/lib/line-display-name', () => ({
  applyThemeLabels: (arr: unknown[]) => arr.map(() => ({ themeLabel: 'L1', isDead: false, isPending: false })),
  buildLineDisplayName: () => 'L1',
  deduplicateLabels: (arr: unknown[]) => arr,
  getDefaultTheme: () => ({ labels: ['立春'], deadLabel: '已断', pendingLabel: '未测' }),
}))

vi.mock('@/lib/video-detail', () => ({
  extractShortId: (slug: string) => slug.split('-').pop() ?? slug,
}))

// SourceBar / ResumePrompt / playerShell.layout 等 UI 组件简化 mock
vi.mock('@/components/player/SourceBar', () => ({ SourceBar: () => null }))
vi.mock('@/components/player/ResumePrompt', () => ({
  ResumePrompt: () => null,
  saveProgress: vi.fn(),
}))
vi.mock('@/components/player/playerShell.layout', () => ({
  getInlineEpisodes: () => null,
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
} as unknown as VideoSource

describe('PlayerShell server-side hydration (ADR-160 AMENDMENT 2 D-160-AMD2-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    initPlayerMock.mockReset()
    apiGetMock.mockReset()
    mockState.currentEpisode = 1 // 每个 case 复位 episode
  })

  afterEach(() => {
    cleanup()
  })

  it('有 initialVideo + initialSources → 完全跳过 client fetch（apiClient.get 不调）', async () => {
    render(<PlayerShell slug="test-aB3kR9x1" initialVideo={MOCK_VIDEO} initialSources={[MOCK_SOURCE]} />)
    await waitFor(() => expect(initPlayerMock).toHaveBeenCalled())
    expect(apiGetMock).not.toHaveBeenCalled()
  })

  it('无 initialVideo → 走 client video fetch（apiClient.get 至少调 1 次）', async () => {
    apiGetMock.mockResolvedValue({ data: MOCK_VIDEO })
    render(<PlayerShell slug="test-aB3kR9x1" />)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    const calls = apiGetMock.mock.calls.map((c) => c[0] as string)
    expect(calls.some((url) => url.includes('/videos/aB3kR9x1') && !url.includes('/sources'))).toBe(true)
  })

  it('有 initialVideo + 无 initialSources → 跳过 video fetch / sources 仅 1 次 client（防止双拉回归）', async () => {
    apiGetMock.mockResolvedValue({ data: [MOCK_SOURCE] })
    render(<PlayerShell slug="test-aB3kR9x1" initialVideo={MOCK_VIDEO} />)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    const calls = apiGetMock.mock.calls.map((c) => c[0] as string)
    // video fetch 不调（无 /sources 后缀的 video URL）
    expect(calls.some((url) => url.endsWith('/videos/aB3kR9x1'))).toBe(false)
    // sources fetch 调（含 /sources?episode=1）
    expect(calls.some((url) => url.includes('/sources?episode=1'))).toBe(true)
    // 仅初始 fetch effect 拉一次，episode-switch effect 跳过首次挂载 → 共 1 次 sources fetch
    expect(calls.filter((url) => url.includes('/sources?episode=')).length).toBe(1)
  })

  it('有 initialVideo + initialSources + url ep=2 → sources 走 client fetch（Y-AMD2-2 episode 切换限制）', async () => {
    apiGetMock.mockResolvedValue({ data: [MOCK_SOURCE] })
    searchParamsGet.mockImplementation((key: string) => (key === 'ep' ? '2' : null))
    render(<PlayerShell slug="test-aB3kR9x1" initialVideo={MOCK_VIDEO} initialSources={[MOCK_SOURCE]} />)
    await waitFor(() => expect(initPlayerMock).toHaveBeenCalled())
    const calls = apiGetMock.mock.calls.map((c) => c[0] as string)
    // ep=2 → 不复用 initialSources（仅 ep=1 时复用）
    expect(calls.some((url) => url.includes('/sources?episode=2'))).toBe(true)
    searchParamsGet.mockReturnValue(null) // 复位
  })

  it('非 hydrated + 首次切集 → episode-switch effect 正常 fetch（Codex stop-time review 回归防御）', async () => {
    // 场景：用户公开访问 watch 页（无 initialVideo / initialSources）→ useEffect 1 完成
    // 后用户切到 ep=2 → episode-switch effect 应触发 sources fetch（修复前 ref 错误时序
    // 会让首次切集被跳过；修复后 ref 在 useEffect 1 sources 处理完成后设 true，确保首次切集正常）
    apiGetMock.mockImplementation((url: string) =>
      url.includes('/sources')
        ? Promise.resolve({ data: [MOCK_SOURCE] })
        : Promise.resolve({ data: MOCK_VIDEO })
    )
    const { rerender } = render(<PlayerShell slug="test-aB3kR9x1" />)
    // 等待初始 fetch 完成（video + sources 都拉过）
    await waitFor(() => {
      const calls = apiGetMock.mock.calls.map((c) => c[0] as string)
      expect(calls.some((url) => url.includes('/sources?episode=1'))).toBe(true)
    })
    apiGetMock.mockClear()
    // 模拟用户切集：改 store currentEpisode → rerender PlayerShell 触发 useEffect 2
    mockState.currentEpisode = 2
    rerender(<PlayerShell slug="test-aB3kR9x1" />)
    // 首次切集不应被跳过 → 应看到 ep=2 的 sources fetch
    await waitFor(() => {
      const calls = apiGetMock.mock.calls.map((c) => c[0] as string)
      expect(calls.some((url) => url.includes('/sources?episode=2'))).toBe(true)
    })
  })
})
