/**
 * tests/unit/components/video/HeroBanner.test.tsx
 * M5-PAGE-BANNER-FE-01: HeroBanner 重写后的合约验证
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { HeroBanner } from '@/components/video/HeroBanner'
import type { LocalizedBannerCard, ApiListResponse } from '@/types'

// ── Mocks ──────────────────────────────────────────────────────────

const getMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...args: unknown[]) => getMock(...args) },
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/useBrand', () => ({
  useBrand: () => ({ brand: { id: 'resovo', name: 'Resovo', slug: 'resovo' } }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src as string} alt={props.alt as string} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

// KenBurnsLayer 和 BannerCarouselMobile 在 jsdom 中无法运行，stub 为无内容占位
vi.mock('@/components/video/KenBurnsLayer', () => ({
  KenBurnsLayer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/video/BannerCarouselMobile', () => ({
  // 不渲染标题，避免与 PC 布局重复计数
  BannerCarouselMobile: () => <div data-testid="banner-carousel-mobile" />,
}))

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  Element.prototype.animate = vi.fn().mockReturnValue({ cancel: vi.fn() })
})

// ── Helpers ────────────────────────────────────────────────────────

function makeBanner(overrides?: Partial<LocalizedBannerCard>): LocalizedBannerCard {
  return {
    id: 'ban-001',
    title: '测试 Banner',
    imageUrl: 'https://cdn.example.com/banner.jpg',
    linkType: 'video',
    linkTarget: 'feat0001',
    sortOrder: 0,
    videoType: 'movie',
    videoSlug: 'test-movie',
    ...overrides,
  }
}

function makeResponse(banners: LocalizedBannerCard[]): ApiListResponse<LocalizedBannerCard> {
  return { data: banners, pagination: { page: 1, limit: 20, total: banners.length } }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('HeroBanner', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('加载中时渲染 skeleton（data-testid=hero-banner-skeleton）', () => {
    getMock.mockReturnValue(new Promise(() => {}))
    render(<HeroBanner />)
    expect(screen.getByTestId('hero-banner-skeleton')).toBeTruthy()
  })

  it('API 使用 /banners?locale=en 路径', async () => {
    getMock.mockResolvedValue(makeResponse([makeBanner()]))
    await act(async () => { render(<HeroBanner />) })
    expect(getMock).toHaveBeenCalledWith(
      expect.stringContaining('/banners?locale=en'),
      expect.anything()
    )
  })

  it('API 返回 banner 后渲染标题', async () => {
    getMock.mockResolvedValue(makeResponse([makeBanner()]))
    render(<HeroBanner />)
    // PC + mobile 两个布局在 jsdom 中同时渲染，至少出现一次即通过
    expect(await screen.findAllByText('测试 Banner')).toBeTruthy()
  })

  it('视频 banner 显示"立即播放"CTA，href 指向 /watch/shortId', async () => {
    getMock.mockResolvedValue(makeResponse([makeBanner({ linkTarget: 'feat0001' })]))
    render(<HeroBanner />)
    await screen.findAllByText('测试 Banner')
    const btn = screen.getAllByTestId('hero-watch-btn')[0] as HTMLAnchorElement
    expect(btn.href).toContain('/watch/feat0001?ep=1')
  })

  it('视频 banner 有 videoType+videoSlug 时显示"详情信息"CTA，href 指向 detail 路径', async () => {
    getMock.mockResolvedValue(makeResponse([
      makeBanner({ linkTarget: 'feat0001', videoType: 'movie', videoSlug: 'test-movie' }),
    ]))
    render(<HeroBanner />)
    await screen.findAllByText('测试 Banner')
    const detailBtn = screen.getAllByTestId('hero-detail-btn')[0] as HTMLAnchorElement
    expect(detailBtn.href).toContain('/movie/test-movie-feat0001')
  })

  it('视频 banner 无 videoType 时"详情信息"降级指向 /watch', async () => {
    getMock.mockResolvedValue(makeResponse([
      makeBanner({ linkTarget: 'feat0001', videoType: null, videoSlug: null }),
    ]))
    render(<HeroBanner />)
    await screen.findAllByText('测试 Banner')
    const detailBtn = screen.getAllByTestId('hero-detail-btn')[0] as HTMLAnchorElement
    expect(detailBtn.href).toContain('/watch/feat0001?ep=1')
  })

  it('外部 banner 渲染"立即观看"，不渲染"详情信息"', async () => {
    getMock.mockResolvedValue(makeResponse([
      makeBanner({ linkType: 'external', linkTarget: 'https://example.com' }),
    ]))
    render(<HeroBanner />)
    await screen.findAllByText('测试 Banner')
    expect(screen.getAllByTestId('hero-watch-btn').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('hero-detail-btn')).toBeNull()
  })

  it('API 返回空列表时不渲染任何 banner', async () => {
    getMock.mockResolvedValue(makeResponse([]))
    render(<HeroBanner />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByTestId('hero-banner')).toBeNull()
    expect(screen.queryByTestId('hero-banner-skeleton')).toBeNull()
  })

  it('API 失败时不崩溃，返回空', async () => {
    getMock.mockRejectedValue(new Error('network error'))
    render(<HeroBanner />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByTestId('hero-banner-skeleton')).toBeNull()
  })

  it('多条 banner 时渲染指示点（PC + mobile 各一组，共 4 个）', async () => {
    getMock.mockResolvedValue(makeResponse([
      makeBanner({ id: 'b1', title: 'Banner 1' }),
      makeBanner({ id: 'b2', title: 'Banner 2' }),
    ]))
    render(<HeroBanner />)
    await screen.findAllByText('Banner 1')
    // jsdom 同时渲染 PC 和 mobile 两个布局，每布局 2 个点
    expect(screen.getAllByTestId(/^banner-dot-/)).toHaveLength(4)
  })
})
