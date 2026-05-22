/**
 * HomeBrandFiltering.test.tsx — CHG-SN-8-GAPS-HOME-BRAND-MULTI
 *
 * 验证 TopTenRow + FeaturedRow 在 useEffect 中读取 useBrand().brand.slug
 * 并以 brand_slug query param 透传给后端（ADR-052 brand 协议消费侧）
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const getMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...args: unknown[]) => getMock(...args) },
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// useBrand mock：默认 brand='resovo'
const brandSlugStub = { current: 'resovo' as string | undefined }
vi.mock('@/hooks/useBrand', () => ({
  useBrand: () => ({ brand: { id: 'resovo', name: 'Resovo', slug: brandSlugStub.current } }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

// FeaturedRow 依赖 VideoCard，复用最小 stub 避免 next/image
vi.mock('@/components/video/VideoCard', () => ({
  VideoCard: ({ video }: { video: { id: string; title: string } }) => <div data-testid="video-card">{video.title}</div>,
}))

vi.mock('@/components/primitives/feedback/Skeleton', () => ({
  Skeleton: ({ children }: { children?: React.ReactNode }) => <div data-testid="skeleton">{children}</div>,
}))

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    })),
  })
  // TopTenRow useScrollTrack uses ResizeObserver
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

describe('TopTenRow · brand_slug 透传', () => {
  it('brand.slug 存在时 GET /home/top10?brand_slug=<slug>', async () => {
    const { TopTenRow } = await import('@/components/home/TopTenRow')
    getMock.mockResolvedValueOnce({ data: { items: [], sortStrategy: 'manual_plus_rating' } })
    render(<TopTenRow title="TOP 10" />)
    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/home/top10?brand_slug=resovo', { skipAuth: true })
    })
  })

  it('brand.slug undefined → 退化为 /home/top10 不带 query', async () => {
    brandSlugStub.current = undefined
    const { TopTenRow } = await import('@/components/home/TopTenRow')
    getMock.mockResolvedValueOnce({ data: { items: [], sortStrategy: 'manual_plus_rating' } })
    render(<TopTenRow title="TOP 10" />)
    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/home/top10', { skipAuth: true })
    })
  })
})

describe('FeaturedRow · brand_slug 透传', () => {
  it('brand.slug 存在时 modules URL 带 brand_slug', async () => {
    const { FeaturedRow } = await import('@/components/home/FeaturedRow')
    getMock
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
    render(<FeaturedRow title="精选推荐" />)
    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(
        '/home/modules?slot=featured&brand_slug=resovo',
        { skipAuth: true },
      )
    })
  })
})
