/**
 * tests/unit/components/video/VideoDetailClient.test.tsx
 * VIDEO-07: VideoDetailClient 加载状态、数据渲染、404、showEpisodes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoDetailClient } from '@/components/video/VideoDetailClient'
import type { Video, ApiResponse } from '@/types'

// ── Mocks ──────────────────────────────────────────────────────────

const getMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}))

// Mock child components to avoid deep render complexity
vi.mock('@/components/video/VideoDetailHero', () => ({
  VideoDetailHero: ({ video }: { video: Video }) => (
    <div data-testid="video-detail-hero">{video.title}</div>
  ),
}))

vi.mock('@/components/video/EpisodeGrid', () => ({
  EpisodeGrid: () => <div data-testid="episode-grid">剧集列表</div>,
}))

// ── Helpers ────────────────────────────────────────────────────────

function makeVideo(overrides?: Partial<Video>): Video {
  return {
    id: 'vid-001',
    shortId: 'aB3kR9x1',
    slug: 'test-movie',
    title: '测试电影',
    titleEn: 'Test Movie',
    description: '这是一部测试电影。',
    coverUrl: 'https://cdn.example.com/cover.jpg',
    type: 'movie',
    genres: ['action'],
    rating: 8.5,
    year: 2024,
    country: 'JP',
    episodeCount: 1,
    status: 'completed',
    director: ['测试导演'],
    cast: ['测试演员'],
    writers: [],
    sourceCount: 2,
    subtitleLangs: ['zh-CN'],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeApiResponse(video: Video): ApiResponse<Video> {
  return { data: video }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('VideoDetailClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('加载中时渲染 skeleton（无 hero）', () => {
    getMock.mockReturnValue(new Promise(() => {}))
    render(<VideoDetailClient slug="test-movie-aB3kR9x1" />)
    expect(screen.queryByTestId('video-detail-hero')).toBeNull()
  })

  it('数据加载后渲染 hero', async () => {
    getMock.mockResolvedValue(makeApiResponse(makeVideo()))
    render(<VideoDetailClient slug="test-movie-aB3kR9x1" />)
    await screen.findByTestId('video-detail-hero')
    expect(screen.getByTestId('video-detail-hero').textContent).toBe('测试电影')
  })

  it('从 slug 中正确提取 shortId 进行 API 请求', async () => {
    getMock.mockResolvedValue(makeApiResponse(makeVideo()))
    render(<VideoDetailClient slug="attack-on-titan-aB3kR9x1" />)
    await screen.findByTestId('video-detail-hero')
    expect(getMock).toHaveBeenCalledWith('/videos/aB3kR9x1')
  })

  it('slug 无连字符时整个 slug 作为 shortId', async () => {
    getMock.mockResolvedValue(makeApiResponse(makeVideo({ shortId: 'aB3kR9x1' })))
    render(<VideoDetailClient slug="aB3kR9x1" />)
    await screen.findByTestId('video-detail-hero')
    expect(getMock).toHaveBeenCalledWith('/videos/aB3kR9x1')
  })

  it('API 失败时显示 404 提示', async () => {
    getMock.mockRejectedValue(new Error('not found'))
    render(<VideoDetailClient slug="missing-video-notfound" />)
    await screen.findByText('视频不存在或已下线')
  })

  it('showEpisodes=false 时不渲染 EpisodeGrid', async () => {
    getMock.mockResolvedValue(makeApiResponse(makeVideo()))
    render(<VideoDetailClient slug="test-movie-aB3kR9x1" showEpisodes={false} />)
    await screen.findByTestId('video-detail-hero')
    expect(screen.queryByTestId('episode-grid')).toBeNull()
  })

  it('showEpisodes=true 时渲染 EpisodeGrid', async () => {
    getMock.mockResolvedValue(makeApiResponse(makeVideo({ episodeCount: 12, type: 'series' })))
    render(<VideoDetailClient slug="some-series-aB3kR9x1" showEpisodes={true} />)
    await screen.findByTestId('episode-grid')
  })
})
