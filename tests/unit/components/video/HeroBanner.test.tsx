/**
 * tests/unit/components/video/HeroBanner.test.tsx
 * VIDEO-06: HeroBanner 加载状态、数据渲染、API 失败空态
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroBanner } from '@/components/video/HeroBanner'
import type { VideoCard as VideoCardType, ApiListResponse } from '@/types'

// ── Mocks ──────────────────────────────────────────────────────────

const getMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}))

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={props.src as string} alt={props.alt as string} />
  },
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

// ── Helpers ────────────────────────────────────────────────────────

function makeFeatured(overrides?: Partial<VideoCardType>): VideoCardType {
  return {
    id: 'vid-featured',
    shortId: 'feat0001',
    slug: 'test-movie',
    title: '热门电影',
    titleEn: 'Hot Movie',
    coverUrl: 'https://cdn.example.com/cover.jpg',
    type: 'movie',
    rating: 8.5,
    year: 2024,
    status: 'completed',
    episodeCount: 1,
    sourceCount: 2,
    ...overrides,
  }
}

function makeListResponse(videos: VideoCardType[]): ApiListResponse<VideoCardType> {
  return {
    data: videos,
    pagination: { page: 1, limit: 1, total: videos.length },
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('HeroBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('加载中时渲染占位 skeleton（data-testid=hero-banner）', () => {
    getMock.mockReturnValue(new Promise(() => {})) // never resolves
    render(<HeroBanner />)
    expect(screen.getByTestId('hero-banner')).toBeTruthy()
  })

  it('API 返回数据后渲染标题和观看按钮', async () => {
    const featured = makeFeatured()
    getMock.mockResolvedValue(makeListResponse([featured]))
    render(<HeroBanner />)
    expect(await screen.findByText('热门电影')).toBeTruthy()
    expect(screen.getByTestId('hero-watch-btn')).toBeTruthy()
  })

  it('有 slug 时观看链接包含 slug', async () => {
    const featured = makeFeatured({ slug: 'test-movie', shortId: 'feat0001' })
    getMock.mockResolvedValue(makeListResponse([featured]))
    render(<HeroBanner />)
    const btn = (await screen.findByTestId('hero-watch-btn')) as HTMLAnchorElement
    expect(btn.href).toContain('/watch/test-movie-feat0001?ep=1')
  })

  it('无 slug 时观看链接只用 shortId', async () => {
    const featured = makeFeatured({ slug: null, shortId: 'feat0001' })
    getMock.mockResolvedValue(makeListResponse([featured]))
    render(<HeroBanner />)
    const btn = (await screen.findByTestId('hero-watch-btn')) as HTMLAnchorElement
    expect(btn.href).toContain('/watch/feat0001?ep=1')
  })

  it('API 返回空列表时不渲染标题', async () => {
    getMock.mockResolvedValue(makeListResponse([]))
    render(<HeroBanner />)
    // Give it a moment to settle
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('热门电影')).toBeNull()
  })

  it('API 失败时不崩溃', async () => {
    getMock.mockRejectedValue(new Error('network error'))
    render(<HeroBanner />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByTestId('hero-banner')).toBeTruthy()
  })

  it('显示评分和年份', async () => {
    const featured = makeFeatured({ rating: 9.2, year: 2023 })
    getMock.mockResolvedValue(makeListResponse([featured]))
    render(<HeroBanner />)
    await screen.findByText('热门电影')
    expect(screen.getByText(/9\.2/)).toBeTruthy()
    expect(screen.getByText(/2023/)).toBeTruthy()
  })
})
