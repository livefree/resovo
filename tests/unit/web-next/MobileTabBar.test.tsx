import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'

// ── shared mocks ──────────────────────────────────────────────────────────────

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
})

vi.mock('next/navigation', () => ({
  usePathname: () => '/en',
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/primitives/feedback/Skeleton', () => ({
  Skeleton: ({ width, height }: { width?: number; height?: number }) => (
    <div role="presentation" style={{ width, height }} />
  ),
}))

// ── MobileTabBar ──────────────────────────────────────────────────────────────

describe('MobileTabBar', () => {
  it('渲染 data-testid="mobile-tabbar"', async () => {
    const { MobileTabBar } = await import('@/components/layout/MobileTabBar')
    render(<MobileTabBar />)
    expect(screen.getByTestId('mobile-tabbar')).toBeTruthy()
  })

  it('包含三个 tab 链接', async () => {
    const { MobileTabBar } = await import('@/components/layout/MobileTabBar')
    render(<MobileTabBar />)
    expect(screen.getByTestId('tabbar-home')).toBeTruthy()
    expect(screen.getByTestId('tabbar-browse')).toBeTruthy()
    expect(screen.getByTestId('tabbar-search')).toBeTruthy()
  })

  it('当前路径 /en 时 home tab 具有 aria-current="page"', async () => {
    const { MobileTabBar } = await import('@/components/layout/MobileTabBar')
    render(<MobileTabBar />)
    const homeTab = screen.getByTestId('tabbar-home')
    expect(homeTab.getAttribute('aria-current')).toBe('page')
  })

  it('browse 和 search tab 不具有 aria-current', async () => {
    const { MobileTabBar } = await import('@/components/layout/MobileTabBar')
    render(<MobileTabBar />)
    expect(screen.getByTestId('tabbar-browse').getAttribute('aria-current')).toBeNull()
    expect(screen.getByTestId('tabbar-search').getAttribute('aria-current')).toBeNull()
  })

  it('nav 元素具有 data-tabbar 属性（CSS 媒体查询控制显隐）', async () => {
    const { MobileTabBar } = await import('@/components/layout/MobileTabBar')
    render(<MobileTabBar />)
    const nav = screen.getByTestId('mobile-tabbar')
    expect(nav.hasAttribute('data-tabbar')).toBe(true)
  })

  it('z-index 使用 CSS 变量 --z-tabbar', async () => {
    const { MobileTabBar } = await import('@/components/layout/MobileTabBar')
    render(<MobileTabBar />)
    const nav = screen.getByTestId('mobile-tabbar')
    expect(nav.style.zIndex).toBe('var(--z-tabbar, 40)')
  })

  it('高度包含 tabbar-height + safe-area-inset-bottom', async () => {
    const { MobileTabBar } = await import('@/components/layout/MobileTabBar')
    render(<MobileTabBar />)
    const nav = screen.getByTestId('mobile-tabbar')
    expect(nav.style.height).toContain('--tabbar-height')
    expect(nav.style.height).toContain('safe-area-inset-bottom')
  })
})

// ── MobileTabBar.Skeleton ─────────────────────────────────────────────────────

describe('MobileTabBar.Skeleton', () => {
  it('渲染 data-testid="mobile-tabbar-skeleton"', async () => {
    const { MobileTabBar } = await import('@/components/layout/MobileTabBar')
    render(<MobileTabBar.Skeleton />)
    expect(screen.getByTestId('mobile-tabbar-skeleton')).toBeTruthy()
  })

  it('aria-hidden="true"', async () => {
    const { MobileTabBar } = await import('@/components/layout/MobileTabBar')
    render(<MobileTabBar.Skeleton />)
    expect(screen.getByTestId('mobile-tabbar-skeleton').getAttribute('aria-hidden')).toBe('true')
  })

  it('包含 3 个 Skeleton 占位块', async () => {
    const { MobileTabBar } = await import('@/components/layout/MobileTabBar')
    const { container } = render(<MobileTabBar.Skeleton />)
    const skeletons = container.querySelectorAll('[role="presentation"]')
    expect(skeletons.length).toBe(3)
  })
})

// ── 路径匹配 ──────────────────────────────────────────────────────────────────

describe('MobileTabBar 路径激活', () => {
  it('/en/browse 激活 browse tab', async () => {
    vi.resetModules()
    vi.doMock('next/navigation', () => ({ usePathname: () => '/en/browse' }))
    vi.doMock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
    vi.doMock('@/components/primitives/feedback/Skeleton', () => ({
      Skeleton: ({ width, height }: { width?: number; height?: number }) => (
        <div role="presentation" style={{ width, height }} />
      ),
    }))
    const { MobileTabBar } = await import('@/components/layout/MobileTabBar')
    render(<MobileTabBar />)
    expect(screen.getByTestId('tabbar-browse').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('tabbar-home').getAttribute('aria-current')).toBeNull()
  })

  it('/en/search 激活 search tab', async () => {
    vi.resetModules()
    vi.doMock('next/navigation', () => ({ usePathname: () => '/en/search' }))
    vi.doMock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
    vi.doMock('@/components/primitives/feedback/Skeleton', () => ({
      Skeleton: ({ width, height }: { width?: number; height?: number }) => (
        <div role="presentation" style={{ width, height }} />
      ),
    }))
    const { MobileTabBar } = await import('@/components/layout/MobileTabBar')
    render(<MobileTabBar />)
    expect(screen.getByTestId('tabbar-search').getAttribute('aria-current')).toBe('page')
  })
})
