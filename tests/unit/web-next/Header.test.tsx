import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

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

vi.mock('@/components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <button type="button">theme</button>,
}))

// ── MegaMenu ──────────────────────────────────────────────────────────────────

describe('MegaMenu', () => {
  it('默认不显示菜单面板', async () => {
    const { MegaMenu } = await import('@/components/layout/MegaMenu')
    render(
      <MegaMenu
        trigger={<button type="button">更多</button>}
        items={[{ key: 'a', label: 'A', href: '/a' }]}
      />,
    )
    expect(screen.queryByTestId('mega-menu-panel')).toBeNull()
  })

  it('mouseenter 后 120ms 展开', async () => {
    vi.useFakeTimers()
    const { MegaMenu } = await import('@/components/layout/MegaMenu')
    const { container } = render(
      <MegaMenu
        trigger={<button type="button">更多</button>}
        items={[{ key: 'movie', label: '电影', href: '/browse?type=movie' }]}
      />,
    )
    const wrapper = container.firstChild as HTMLElement
    fireEvent.mouseEnter(wrapper)

    // Not yet visible
    expect(screen.queryByTestId('mega-menu-panel')).toBeNull()

    await act(async () => { vi.advanceTimersByTime(130) })
    expect(screen.queryByTestId('mega-menu-panel')).toBeTruthy()
    vi.useRealTimers()
  })

  it('mouseleave 后 240ms 收起', async () => {
    vi.useFakeTimers()
    const { MegaMenu } = await import('@/components/layout/MegaMenu')
    const { container } = render(
      <MegaMenu
        trigger={<button type="button">更多</button>}
        items={[{ key: 'movie', label: '电影', href: '/browse?type=movie' }]}
      />,
    )
    const wrapper = container.firstChild as HTMLElement
    fireEvent.mouseEnter(wrapper)
    await act(async () => { vi.advanceTimersByTime(130) })
    expect(screen.queryByTestId('mega-menu-panel')).toBeTruthy()

    fireEvent.mouseLeave(wrapper)
    await act(async () => { vi.advanceTimersByTime(100) })
    // Not closed yet
    expect(screen.queryByTestId('mega-menu-panel')).toBeTruthy()
    await act(async () => { vi.advanceTimersByTime(150) })
    expect(screen.queryByTestId('mega-menu-panel')).toBeNull()
    vi.useRealTimers()
  })

  it('Escape 键立即关闭', async () => {
    vi.useFakeTimers()
    const { MegaMenu } = await import('@/components/layout/MegaMenu')
    const { container } = render(
      <MegaMenu
        trigger={<button type="button">更多</button>}
        items={[{ key: 'a', label: 'A', href: '/a' }]}
      />,
    )
    const wrapper = container.firstChild as HTMLElement
    fireEvent.mouseEnter(wrapper)
    await act(async () => { vi.advanceTimersByTime(130) })
    expect(screen.queryByTestId('mega-menu-panel')).toBeTruthy()

    fireEvent.keyDown(wrapper, { key: 'Escape' })
    expect(screen.queryByTestId('mega-menu-panel')).toBeNull()
    vi.useRealTimers()
  })

  it('ArrowDown 键立即展开并将焦点移到第一个 menuitem', async () => {
    vi.useFakeTimers()
    const { MegaMenu } = await import('@/components/layout/MegaMenu')
    const { container } = render(
      <MegaMenu
        trigger={<button type="button" data-testid="trig">更多</button>}
        items={[
          { key: 'movie', label: '电影', href: '/browse?type=movie' },
          { key: 'anime', label: '动漫', href: '/browse?type=anime' },
        ]}
      />,
    )
    const wrapper = container.firstChild as HTMLElement
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' })
    // Flush React state update then rAF (one frame ≈ 16ms)
    await act(async () => { vi.advanceTimersByTime(16) })
    expect(screen.queryByTestId('mega-menu-panel')).toBeTruthy()
    // Focus must have moved to the first menuitem
    expect(document.activeElement).toBe(screen.getByTestId('mega-menu-item-movie'))
    vi.useRealTimers()
  })

  it('Enter 键立即展开并将焦点移到第一个 menuitem', async () => {
    vi.useFakeTimers()
    const { MegaMenu } = await import('@/components/layout/MegaMenu')
    render(
      <MegaMenu
        trigger={<button type="button">更多</button>}
        items={[
          { key: 'first', label: 'First', href: '/first' },
          { key: 'second', label: 'Second', href: '/second' },
        ]}
      />,
    )
    // The trigger div is the wrapper; fire keyDown on it
    const wrapper = document.querySelector('[aria-haspopup="menu"]')!.parentElement as HTMLElement
    fireEvent.keyDown(wrapper, { key: 'Enter' })
    await act(async () => { vi.advanceTimersByTime(16) })
    expect(screen.queryByTestId('mega-menu-panel')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByTestId('mega-menu-item-first'))
    vi.useRealTimers()
  })

  it('菜单内 Escape 将焦点返回触发按钮', async () => {
    vi.useFakeTimers()
    const { MegaMenu } = await import('@/components/layout/MegaMenu')
    const { container } = render(
      <MegaMenu
        trigger={<button type="button" data-testid="close-trigger">更多</button>}
        items={[{ key: 'a', label: 'A', href: '/a' }]}
      />,
    )
    const wrapper = container.firstChild as HTMLElement
    // Open via hover
    fireEvent.mouseEnter(wrapper)
    await act(async () => { vi.advanceTimersByTime(130) })
    expect(screen.queryByTestId('mega-menu-panel')).toBeTruthy()

    // Focus something inside menu, then press Escape
    const panel = screen.getByTestId('mega-menu-panel')
    fireEvent.keyDown(panel, { key: 'Escape' })
    expect(screen.queryByTestId('mega-menu-panel')).toBeNull()
    // trigger button should be focused
    expect(document.activeElement).toBe(screen.getByTestId('close-trigger'))
    vi.useRealTimers()
  })

  it('active 项 aria 样式正确', async () => {
    vi.useFakeTimers()
    const { MegaMenu } = await import('@/components/layout/MegaMenu')
    const { container } = render(
      <MegaMenu
        trigger={<button type="button">更多</button>}
        items={[
          { key: 'movie', label: '电影', href: '/browse?type=movie', active: true },
          { key: 'anime', label: '动漫', href: '/browse?type=anime', active: false },
        ]}
      />,
    )
    fireEvent.mouseEnter(container.firstChild as HTMLElement)
    await act(async () => { vi.advanceTimersByTime(130) })

    const activeItem = screen.getByTestId('mega-menu-item-movie')
    expect(activeItem.className).toContain('font-semibold')
    vi.useRealTimers()
  })
})

// ── Nav scroll-collapse ───────────────────────────────────────────────────────

describe('Nav scroll-collapse', () => {
  it('初始高度为 h-16', async () => {
    const { Nav } = await import('@/components/layout/Nav')
    render(<Nav />)
    const header = screen.getByTestId('global-nav')
    expect(header.className).toContain('h-16')
    expect(header.className).not.toContain('h-12')
  })

  it('scrollY > 80px 后高度变为 h-12', async () => {
    Object.defineProperty(window, 'scrollY', { writable: true, value: 0 })
    const { Nav } = await import('@/components/layout/Nav')
    render(<Nav />)

    await act(async () => {
      Object.defineProperty(window, 'scrollY', { writable: true, value: 100 })
      window.dispatchEvent(new Event('scroll'))
    })

    await waitFor(() => {
      const header = screen.getByTestId('global-nav')
      expect(header.className).toContain('h-12')
    })
  })

  it('挂载时 scrollY 已超 80px → 直接初始化为 h-12', async () => {
    Object.defineProperty(window, 'scrollY', { writable: true, value: 150 })
    const { Nav } = await import('@/components/layout/Nav')
    render(<Nav />)

    await waitFor(() => {
      const header = screen.getByTestId('global-nav')
      expect(header.className).toContain('h-12')
    })
    // reset
    Object.defineProperty(window, 'scrollY', { writable: true, value: 0 })
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
