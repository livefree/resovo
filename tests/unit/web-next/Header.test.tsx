import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'

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

  Object.defineProperty(window, 'scrollY', { writable: true, value: 0 })
})

afterEach(() => {
  vi.restoreAllMocks()
})

vi.mock('next/navigation', () => ({
  usePathname:     () => '/en',
  useRouter:       () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/useBrand', () => ({
  useBrand: () => ({ brand: { name: 'Resovo', slug: 'resovo' } }),
}))

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'system', resolvedTheme: 'light', setTheme: vi.fn() }),
}))

vi.mock('@/components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <button type="button">theme</button>,
}))

// ── Nav 固定高度（UI-REBUILD 2026-04-23 修订：移除 scroll-collapse + 高度 72px） ─

describe('Nav 固定高度 72px', () => {
  it('初始高度为 var(--header-height)（token 消费，对齐 HANDOFF-11）', async () => {
    const { Nav } = await import('@/components/layout/Nav')
    render(<Nav />)
    const header = screen.getByTestId('global-nav')
    // HANDOFF-11：高度已 token 化为 var(--header-height)，不再硬编码 '72px'
    expect(header.style.height).toBe('var(--header-height)')
    expect(header.className).not.toContain('h-12')
  })

  it('scrollY > 80px 后高度仍为 var(--header-height)（scroll-collapse 已移除，让 active underline 贴 border 位置稳定）', async () => {
    Object.defineProperty(window, 'scrollY', { writable: true, value: 0 })
    const { Nav } = await import('@/components/layout/Nav')
    render(<Nav />)

    await act(async () => {
      Object.defineProperty(window, 'scrollY', { writable: true, value: 100 })
      window.dispatchEvent(new Event('scroll'))
    })

    // scroll 100px 后高度不变
    const header = screen.getByTestId('global-nav')
    // HANDOFF-11：高度已 token 化为 var(--header-height)，不再硬编码 '72px'
    expect(header.style.height).toBe('var(--header-height)')
    expect(header.className).not.toContain('h-12')
  })
})

// ── Nav.Skeleton ──────────────────────────────────────────────────────────────

describe('Nav.Skeleton', () => {
  it('渲染 data-testid="nav-skeleton"', async () => {
    const { Nav } = await import('@/components/layout/Nav')
    render(<Nav.Skeleton />)
    expect(screen.getByTestId('nav-skeleton')).toBeTruthy()
  })

  it('aria-hidden="true"', async () => {
    const { Nav } = await import('@/components/layout/Nav')
    render(<Nav.Skeleton />)
    expect(screen.getByTestId('nav-skeleton').getAttribute('aria-hidden')).toBe('true')
  })
})

// ── Footer.Skeleton ───────────────────────────────────────────────────────────

describe('Footer.Skeleton', () => {
  it('渲染 data-testid="footer-skeleton"', async () => {
    const { Footer } = await import('@/components/layout/Footer')
    render(<Footer.Skeleton />)
    expect(screen.getByTestId('footer-skeleton')).toBeTruthy()
  })

  it('含 Skeleton 占位块', async () => {
    const { Footer } = await import('@/components/layout/Footer')
    const { container } = render(<Footer.Skeleton />)
    const skeletons = container.querySelectorAll('[role="presentation"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(2)
  })
})
