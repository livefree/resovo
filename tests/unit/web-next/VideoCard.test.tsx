import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VideoCard } from '@/components/video/VideoCard'
import type { VideoCard as VideoCardType } from '@resovo/types'

// ── mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

vi.mock('@/components/media', () => ({
  SafeImage: ({ alt, aspect }: { alt: string; aspect?: string }) => (
    <img alt={alt} data-aspect={aspect} />
  ),
}))

vi.mock('@/lib/report-broken-image', () => ({
  reportBrokenImage: vi.fn(),
}))

const mockEnter = vi.fn()

vi.mock('@/stores/playerStore', () => ({
  usePlayerStore: (selector: (s: { enter: typeof mockEnter }) => unknown) =>
    selector({ enter: mockEnter }),
}))

// ── fixtures ───────────────────────────────────────────────────────────────

function makeVideo(overrides?: Partial<VideoCardType>): VideoCardType {
  return {
    id: 'v1',
    shortId: 'ab12cd34',
    slug: 'demo-title',
    title: '演示视频',
    titleEn: null,
    coverUrl: 'https://cdn.example.com/demo.jpg',
    type: 'movie',
    rating: 8.3,
    year: 2025,
    status: 'completed',
    episodeCount: 1,
    sourceCount: 2,
    posterBlurhash: null,
    posterStatus: 'ok',
    ...overrides,
  }
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('VideoCard', () => {
  beforeEach(() => {
    mockEnter.mockClear()
  })

  describe('双出口', () => {
    it('点击图片区(PosterAction)调用 playerStore.enter() 携带 fast-takeover', () => {
      render(<VideoCard video={makeVideo()} />)
      const posterBtn = screen.getByRole('button', { name: '播放《演示视频》第 1 集' })
      fireEvent.click(posterBtn)
      expect(mockEnter).toHaveBeenCalledOnce()
      expect(mockEnter).toHaveBeenCalledWith({
        shortId: 'ab12cd34',
        slug: 'demo-title',
        episode: 1,
        transition: 'fast-takeover',
      })
    })

    it('文字区(MetaAction)链接指向详情页', () => {
      render(<VideoCard video={makeVideo()} />)
      const metaLink = screen.getByRole('link', { name: '演示视频 详情页' }) as HTMLAnchorElement
      expect(metaLink.getAttribute('href')).toBe('/movie/demo-title-ab12cd34')
    })

    it('slug 为 null 时 enter() 传 null slug，MetaAction 回退到 shortId 路径', () => {
      render(<VideoCard video={makeVideo({ slug: null })} />)
      fireEvent.click(screen.getByRole('button', { name: '播放《演示视频》第 1 集' }))
      expect(mockEnter).toHaveBeenCalledWith(
        expect.objectContaining({ slug: null, shortId: 'ab12cd34' }),
      )
      const link = screen.getByRole('link', { name: '演示视频 详情页' }) as HTMLAnchorElement
      expect(link.getAttribute('href')).toBe('/movie/ab12cd34')
    })
  })

  describe('Tab 顺序 / 无障碍', () => {
    it('DOM 中 PosterAction 在 MetaAction 之前', () => {
      render(<VideoCard video={makeVideo()} />)
      const article = screen.getByTestId('video-card')
      const button = screen.getByRole('button')
      const link = screen.getByRole('link', { name: '演示视频 详情页' })

      // button 应先于 link 出现在 DOM 中
      expect(
        article.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_PRECEDING,
      ).toBe(0) // button is NOT preceding article (it's inside)
      const allInteractives = article.querySelectorAll('button, a')
      expect(allInteractives[0].tagName).toBe('BUTTON')
      expect(allInteractives[1].tagName).toBe('A')
    })

    it('PosterAction aria-label 包含片名', () => {
      render(<VideoCard video={makeVideo()} />)
      expect(screen.getByRole('button', { name: '播放《演示视频》第 1 集' })).toBeTruthy()
    })

    it('MetaAction aria-label 包含"详情页"', () => {
      render(<VideoCard video={makeVideo()} />)
      expect(screen.getByRole('link', { name: '演示视频 详情页' })).toBeTruthy()
    })
  })

  describe('VideoCard.Skeleton', () => {
    it('Skeleton 子组件可正常渲染，data-testid 为 video-card-skeleton', () => {
      render(<VideoCard.Skeleton />)
      expect(screen.getByTestId('video-card-skeleton')).toBeTruthy()
    })

    it('Skeleton 为 aria-hidden（纯装饰性）', () => {
      render(<VideoCard.Skeleton />)
      expect(screen.getByTestId('video-card-skeleton').getAttribute('aria-hidden')).toBe('true')
    })
  })

  describe('内容渲染', () => {
    it('渲染年份和集数', () => {
      render(<VideoCard video={makeVideo({ type: 'series', episodeCount: 24, rating: null })} />)
      expect(screen.getByText('2025 · 24集')).toBeTruthy()
    })

    it('rating 为 null 时不渲染评分', () => {
      render(<VideoCard video={makeVideo({ rating: null })} />)
      expect(screen.queryByText(/★/)).toBeNull()
    })
  })
})
