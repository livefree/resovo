import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'

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

// ── Skeleton ──────────────────────────────────────────────────────────────────

describe('Skeleton', () => {
  it('shape="rect" 渲染占位块，含 skeleton-shimmer 动画', async () => {
    const { Skeleton } = await import('@/components/primitives/feedback/Skeleton')
    const { container } = render(<Skeleton shape="rect" width={100} height={120} />)
    const el = container.firstChild as HTMLElement
    expect(el).toBeTruthy()
    expect(el.style.animation).toContain('skeleton-shimmer')
    expect(el.style.backgroundSize).toBe('200% 100%')
  })

  it('shape="circle" 含 rounded-full class', async () => {
    const { Skeleton } = await import('@/components/primitives/feedback/Skeleton')
    const { container } = render(<Skeleton shape="circle" width={48} height={48} />)
    expect((container.firstChild as HTMLElement).className).toContain('rounded-full')
  })

  it('shape="text" 含 rounded class', async () => {
    const { Skeleton } = await import('@/components/primitives/feedback/Skeleton')
    const { container } = render(<Skeleton shape="text" height={14} />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('rounded')
    expect(el.className).not.toContain('rounded-full')
  })

  it('delay=300 时 animationDelay 使用 tier-1 var', async () => {
    const { Skeleton } = await import('@/components/primitives/feedback/Skeleton')
    const { container } = render(<Skeleton shape="rect" delay={300} />)
    const el = container.firstChild as HTMLElement
    expect(el.style.animationDelay).toBe('var(--skeleton-delay-tier-1)')
  })

  it('delay=800 时 animationDelay 使用 tier-2 var', async () => {
    const { Skeleton } = await import('@/components/primitives/feedback/Skeleton')
    const { container } = render(<Skeleton shape="rect" delay={800} />)
    const el = container.firstChild as HTMLElement
    expect(el.style.animationDelay).toBe('var(--skeleton-delay-tier-2)')
  })

  it('aria-hidden="true" 且 role="presentation"', async () => {
    const { Skeleton } = await import('@/components/primitives/feedback/Skeleton')
    const { container } = render(<Skeleton />)
    const el = container.firstChild as HTMLElement
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.getAttribute('role')).toBe('presentation')
  })
})

// ── useSkeletonDelay ──────────────────────────────────────────────────────────

describe('useSkeletonDelay', () => {
  it('delayMs=null: loading=true 立即返回 true', async () => {
    const { useSkeletonDelay } = await import('@/hooks/useSkeletonDelay')

    function TestComp() {
      const visible = useSkeletonDelay(true, null)
      return <div data-testid="v">{String(visible)}</div>
    }

    render(<TestComp />)
    expect(screen.getByTestId('v').textContent).toBe('true')
  })

  it('delayMs=null: loading=false 立即返回 false', async () => {
    const { useSkeletonDelay } = await import('@/hooks/useSkeletonDelay')

    function TestComp() {
      const visible = useSkeletonDelay(false, null)
      return <div data-testid="v">{String(visible)}</div>
    }

    render(<TestComp />)
    expect(screen.getByTestId('v').textContent).toBe('false')
  })

  it('delayMs=300: loading=true, < 300ms 返回 false', async () => {
    vi.useFakeTimers()
    const { useSkeletonDelay } = await import('@/hooks/useSkeletonDelay')

    function TestComp() {
      const visible = useSkeletonDelay(true, 300)
      return <div data-testid="v">{String(visible)}</div>
    }

    render(<TestComp />)
    expect(screen.getByTestId('v').textContent).toBe('false')
    vi.useRealTimers()
  })

  it('delayMs=300: loading=true, > 300ms 后返回 true', async () => {
    vi.useFakeTimers()
    const { useSkeletonDelay } = await import('@/hooks/useSkeletonDelay')

    function TestComp() {
      const visible = useSkeletonDelay(true, 300)
      return <div data-testid="v">{String(visible)}</div>
    }

    render(<TestComp />)
    expect(screen.getByTestId('v').textContent).toBe('false')

    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    expect(screen.getByTestId('v').textContent).toBe('true')
    vi.useRealTimers()
  })

  it('loading 变为 false 时立即重置', async () => {
    vi.useFakeTimers()
    const { useSkeletonDelay } = await import('@/hooks/useSkeletonDelay')
    const { rerender } = render(
      (() => {
        function TestComp({ loading }: { loading: boolean }) {
          const visible = useSkeletonDelay(loading, 300)
          return <div data-testid="v">{String(visible)}</div>
        }
        return <TestComp loading={true} />
      })(),
    )

    await act(async () => {
      vi.advanceTimersByTime(350)
    })
    expect(screen.getByTestId('v').textContent).toBe('true')

    const { useSkeletonDelay: useSD2 } = await import('@/hooks/useSkeletonDelay')
    function TestComp2({ loading }: { loading: boolean }) {
      const visible = useSD2(loading, 300)
      return <div data-testid="v">{String(visible)}</div>
    }
    rerender(<TestComp2 loading={false} />)
    expect(screen.getByTestId('v').textContent).toBe('false')
    vi.useRealTimers()
  })

  it('delayMs=800: loading=true, > 800ms 后返回 true', async () => {
    vi.useFakeTimers()
    const { useSkeletonDelay } = await import('@/hooks/useSkeletonDelay')

    function TestComp() {
      const visible = useSkeletonDelay(true, 800)
      return <div data-testid="v">{String(visible)}</div>
    }

    render(<TestComp />)
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(screen.getByTestId('v').textContent).toBe('false')
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(screen.getByTestId('v').textContent).toBe('true')
    vi.useRealTimers()
  })
})

// ── ProgressBar ──────────────────────────────────────────────────────────────

describe('ProgressBar', () => {
  it('value=undefined: indeterminate mode, role=progressbar', async () => {
    const { ProgressBar } = await import('@/components/primitives/feedback/ProgressBar')
    render(<ProgressBar />)
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('value=50: aria-valuenow=50', async () => {
    const { ProgressBar } = await import('@/components/primitives/feedback/ProgressBar')
    render(<ProgressBar value={50} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50')
  })
})

// ── VideoCard.Skeleton ────────────────────────────────────────────────────────

describe('VideoCard.Skeleton', () => {
  it('渲染 data-testid="video-card-skeleton"', async () => {
    vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
    vi.mock('@/stores/playerStore', () => ({
      usePlayerStore: vi.fn((sel: (s: { enter: () => void }) => unknown) =>
        sel({ enter: vi.fn() }),
      ),
    }))
    const { VideoCard } = await import('@/components/video/VideoCard')
    render(<VideoCard.Skeleton />)
    expect(screen.getByTestId('video-card-skeleton')).toBeTruthy()
  })

  it('包含至少 2 个 Skeleton 占位块', async () => {
    const { VideoCard } = await import('@/components/video/VideoCard')
    const { container } = render(<VideoCard.Skeleton />)
    const skeletons = container.querySelectorAll('[aria-hidden="true"][role="presentation"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(2)
  })
})
