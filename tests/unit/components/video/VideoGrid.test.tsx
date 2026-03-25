/**
 * tests/unit/components/video/VideoGrid.test.tsx
 * VIDEO-06: VideoGrid 加载状态、网格/滚动布局、空态
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoGrid } from '@/components/video/VideoGrid'
import type { VideoCard as VideoCardType, ApiListResponse } from '@/types'

// ── Mocks ──────────────────────────────────────────────────────────

const getMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}))

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img src={props.src as string} alt={props.alt as string} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

// ── Helpers ────────────────────────────────────────────────────────

function makeVideoCard(n: number): VideoCardType {
  return {
    id: `vid-${n}`,
    shortId: `sh${n}`.padEnd(8, '0').slice(0, 8),
    slug: `video-${n}`,
    title: `视频 ${n}`,
    titleEn: null,
    coverUrl: null,
    type: 'movie',
    rating: null,
    year: 2024,
    status: 'completed',
    episodeCount: 1,
    sourceCount: 1,
  }
}

function makeListResponse(count: number): ApiListResponse<VideoCardType> {
  return {
    data: Array.from({ length: count }, (_, i) => makeVideoCard(i + 1)),
    pagination: { page: 1, limit: count, total: count },
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('VideoGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('加载中时渲染 skeleton', () => {
    getMock.mockReturnValue(new Promise(() => {}))
    render(<VideoGrid query="type=movie&limit=10" data-testid="movie-grid" />)
    expect(screen.getByTestId('movie-grid')).toBeTruthy()
    // Loading skeletons rendered (no video-card links)
    expect(screen.queryAllByTestId('video-card')).toHaveLength(0)
  })

  it('加载完成后渲染视频卡片（portrait 默认）', async () => {
    getMock.mockResolvedValue(makeListResponse(5))
    render(<VideoGrid query="type=movie&limit=5" data-testid="movie-grid" />)
    await screen.findAllByTestId('video-card')
    expect(screen.getAllByTestId('video-card')).toHaveLength(5)
  })

  it('landscape variant 渲染 VideoCardWide', async () => {
    getMock.mockResolvedValue(makeListResponse(3))
    render(<VideoGrid query="type=series&limit=3" variant="landscape" data-testid="wide-grid" />)
    await screen.findAllByTestId('video-card-wide')
    expect(screen.getAllByTestId('video-card-wide')).toHaveLength(3)
  })

  it('API 返回空列表时显示空态文字', async () => {
    getMock.mockResolvedValue(makeListResponse(0))
    render(<VideoGrid query="type=movie&limit=5" data-testid="empty-grid" />)
    await screen.findByText('暂无数据')
    expect(screen.getByTestId('empty-grid')).toBeTruthy()
  })

  it('API 失败时不崩溃并显示空态', async () => {
    getMock.mockRejectedValue(new Error('network'))
    render(<VideoGrid query="type=movie&limit=5" data-testid="fail-grid" />)
    await screen.findByText('暂无数据')
    expect(screen.getByTestId('fail-grid')).toBeTruthy()
  })

  it('scroll 布局时加载 skeleton 包含 scroll wrapper', () => {
    getMock.mockReturnValue(new Promise(() => {}))
    render(<VideoGrid query="type=anime&limit=8" layout="scroll" data-testid="scroll-grid" />)
    const container = screen.getByTestId('scroll-grid')
    expect(container).toBeTruthy()
  })

  it('scroll 布局数据加载后渲染滚动卡片', async () => {
    getMock.mockResolvedValue(makeListResponse(4))
    render(<VideoGrid query="type=anime&limit=4" layout="scroll" data-testid="scroll-grid" />)
    await screen.findAllByTestId('video-card')
    expect(screen.getAllByTestId('video-card')).toHaveLength(4)
  })
})
