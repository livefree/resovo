/**
 * ShelfRow.test.tsx — CHG-HOME-FE-CONSUME-B（ADR-184 消费侧）
 *
 * 验证 ShelfRow 的 shelfSection 聚合消费链：
 *   - 提供 shelfSection → GET /home/shelf?section=...（brand_slug 透传 ADR-052 消费侧协议）
 *   - items 空 / 请求失败 → 降级 /videos/trending?query（方案 §7.1 消费侧兜底）
 *   - 缺省 shelfSection → 纯趋势消费（现状回归，非首页消费零影响）
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, waitFor, screen } from '@testing-library/react'

const getMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...args: unknown[]) => getMock(...args) },
}))

const brandSlugStub = { current: 'resovo' as string | undefined }
vi.mock('@/hooks/useBrand', () => ({
  useBrand: () => ({ brand: { id: 'resovo', name: 'Resovo', slug: brandSlugStub.current } }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

vi.mock('@/components/video/VideoCard', () => ({
  VideoCard: ({ video }: { video: { id: string; title: string } }) => <div data-testid="video-card">{video.title}</div>,
}))

vi.mock('@/components/primitives/feedback/Skeleton', () => ({
  Skeleton: ({ children }: { children?: React.ReactNode }) => <div data-testid="skeleton">{children}</div>,
}))

beforeAll(() => {
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

beforeEach(() => {
  getMock.mockReset()
  brandSlugStub.current = 'resovo'
})

function shelfBody(titles: string[]) {
  return {
    data: {
      items: titles.map((title, i) => ({
        video: { id: `v-${i}`, title, type: 'movie', sourceCount: 1 },
        rank: i + 1,
        isPinned: i === 0,
      })),
      snapshotAt: titles.length > 0 ? '2026-06-06T12:00:00Z' : null,
      generatedAt: '2026-06-06T12:00:30Z',
    },
  }
}

describe('ShelfRow · shelfSection 聚合消费（ADR-184）', () => {
  it('提供 shelfSection 时 GET /home/shelf?section=...&brand_slug=<slug> 并渲染 items', async () => {
    const { ShelfRow } = await import('@/components/video/Shelf')
    getMock.mockResolvedValueOnce(shelfBody(['置顶电影', '快照电影']))

    render(<ShelfRow template="poster-row" shelfSection="hot_movies" query="type=movie&period=week&limit=10" title="热门电影" />)

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        '/home/shelf?section=hot_movies&brand_slug=resovo',
        { skipAuth: true },
      )
      expect(screen.getByText('置顶电影')).toBeTruthy()
      expect(screen.getByText('快照电影')).toBeTruthy()
    })
    // 聚合成功时不走趋势路径
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('brand.slug undefined → /home/shelf 不带 brand_slug', async () => {
    brandSlugStub.current = undefined
    const { ShelfRow } = await import('@/components/video/Shelf')
    getMock.mockResolvedValueOnce(shelfBody(['卡片 A']))

    render(<ShelfRow template="poster-row" shelfSection="hot_series" query="type=series&period=week&limit=8" title="热播剧集" />)

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/home/shelf?section=hot_series', { skipAuth: true })
    })
  })

  it('聚合 items 为空 → 降级趋势 query（§7.1 消费侧兜底）', async () => {
    const { ShelfRow } = await import('@/components/video/Shelf')
    getMock
      .mockResolvedValueOnce(shelfBody([]))
      .mockResolvedValueOnce({ data: [{ id: 'v-t1', title: '趋势电影' }] })

    render(<ShelfRow template="poster-row" shelfSection="hot_movies" query="type=movie&period=week&limit=10" title="热门电影" />)

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/videos/trending?type=movie&period=week&limit=10', { skipAuth: true })
      expect(screen.getByText('趋势电影')).toBeTruthy()
    })
  })

  it('聚合请求失败 → 降级趋势 query', async () => {
    const { ShelfRow } = await import('@/components/video/Shelf')
    getMock
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ data: [{ id: 'v-t1', title: '趋势剧集' }] })

    render(<ShelfRow template="poster-row" shelfSection="hot_series" query="type=series&period=week&limit=8" title="热播剧集" />)

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/videos/trending?type=series&period=week&limit=8', { skipAuth: true })
      expect(screen.getByText('趋势剧集')).toBeTruthy()
    })
  })

  it('缺省 shelfSection → 仅趋势消费（现状回归）', async () => {
    const { ShelfRow } = await import('@/components/video/Shelf')
    getMock.mockResolvedValueOnce({ data: [{ id: 'v-t1', title: '趋势动漫' }] })

    render(<ShelfRow template="poster-row" query="type=anime&period=week&limit=8" title="热门动漫" />)

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/videos/trending?type=anime&period=week&limit=8', { skipAuth: true })
      expect(screen.getByText('趋势动漫')).toBeTruthy()
    })
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(getMock).not.toHaveBeenCalledWith(expect.stringContaining('/home/shelf'), expect.anything())
  })
})
