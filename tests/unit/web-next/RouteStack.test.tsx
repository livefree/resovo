import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createRef } from 'react'

// ── matchMedia + animate mocks ────────────────────────────────────────────────

function makeMatchMedia(hoverNone = false, reducedMotion = false) {
  return vi.fn().mockImplementation((query: string) => ({
    matches:
      (query === '(hover: none)' && hoverNone) ||
      (query === '(prefers-reduced-motion: reduce)' && reducedMotion),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: makeMatchMedia(),
  })
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    writable: true,
    value: vi.fn().mockReturnValue({ cancel: vi.fn(), finished: Promise.resolve() }),
  })
  // jsdom lacks innerWidth
  Object.defineProperty(window, 'innerWidth', { writable: true, value: 390 })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Mock next/navigation
const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack }),
}))

// Mock playerStore
vi.mock('@/stores/playerStore', () => ({
  usePlayerStore: vi.fn((selector: (s: { hostMode: string }) => unknown) =>
    selector({ hostMode: 'closed' }),
  ),
}))

beforeEach(() => {
  mockBack.mockClear()
  window.matchMedia = makeMatchMedia() // reset to desktop (hover:hover)
})

// ── useEdgeSwipeBack ──────────────────────────────────────────────────────────

describe('useEdgeSwipeBack', () => {
  it('桌面端（hover:hover）: 触摸事件不触发 back()', async () => {
    window.matchMedia = makeMatchMedia(false) // hover:hover
    const { useEdgeSwipeBack } = await import('@/hooks/useEdgeSwipeBack')
    const ref = createRef<HTMLDivElement>()

    function TestComp() {
      useEdgeSwipeBack(ref as React.RefObject<HTMLDivElement | null>)
      return <div ref={ref}>content</div>
    }

    render(<TestComp />)
    await act(async () => {
      fireEvent.touchStart(ref.current!, {
        touches: [{ clientX: 10, clientY: 400, identifier: 0 }],
      })
      fireEvent.touchMove(ref.current!, {
        touches: [{ clientX: 200, clientY: 400, identifier: 0 }],
      })
      fireEvent.touchEnd(ref.current!, { touches: [] })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockBack).not.toHaveBeenCalled()
  })

  it('触摸设备（hover:none）: 左边缘右滑 > 30% → back()', async () => {
    window.matchMedia = makeMatchMedia(true) // hover:none
    const { useEdgeSwipeBack } = await import('@/hooks/useEdgeSwipeBack')
    const ref = createRef<HTMLDivElement>()

    function TestComp() {
      useEdgeSwipeBack(ref as React.RefObject<HTMLDivElement | null>)
      return <div ref={ref}>content</div>
    }

    render(<TestComp />)
    await act(async () => {
      fireEvent.touchStart(ref.current!, {
        touches: [{ clientX: 10, clientY: 400, identifier: 0 }],
      })
      // dx = 200px, screenWidth = 390 → 200/390 ≈ 51% > 30%
      fireEvent.touchMove(ref.current!, {
        touches: [{ clientX: 210, clientY: 400, identifier: 0 }],
      })
      fireEvent.touchEnd(ref.current!, { touches: [] })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockBack).toHaveBeenCalledOnce()
  })

  it('触摸设备: 滑动距离 < 30% 且速度 < 阈值 → 不触发 back()', async () => {
    window.matchMedia = makeMatchMedia(true)
    const { useEdgeSwipeBack } = await import('@/hooks/useEdgeSwipeBack')
    const ref = createRef<HTMLDivElement>()

    function TestComp() {
      useEdgeSwipeBack(ref as React.RefObject<HTMLDivElement | null>)
      return <div ref={ref}>content</div>
    }

    render(<TestComp />)
    await act(async () => {
      // Simulate slow swipe: start at t=0, end at t=1000ms → velocity = 50/1000 = 0.05 px/ms < 0.5
      let nowValue = 0
      vi.spyOn(performance, 'now').mockImplementation(() => nowValue)
      fireEvent.touchStart(ref.current!, {
        touches: [{ clientX: 10, clientY: 400, identifier: 0 }],
      })
      nowValue = 1000
      // dx = 50px, 50/390 ≈ 12.8% < 30%, velocity 0.05 < 0.5
      fireEvent.touchMove(ref.current!, {
        touches: [{ clientX: 60, clientY: 400, identifier: 0 }],
      })
      nowValue = 1001
      fireEvent.touchEnd(ref.current!, { touches: [] })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockBack).not.toHaveBeenCalled()
  })

  it('向左滑动（负方向 dx）: 不触发 back()', async () => {
    window.matchMedia = makeMatchMedia(true)
    const { useEdgeSwipeBack } = await import('@/hooks/useEdgeSwipeBack')
    const ref = createRef<HTMLDivElement>()

    function TestComp() {
      useEdgeSwipeBack(ref as React.RefObject<HTMLDivElement | null>)
      return <div ref={ref}>content</div>
    }

    render(<TestComp />)
    await act(async () => {
      // startX = 10 (edge zone), end at 0 → dx = -10 (left swipe, not back)
      fireEvent.touchStart(ref.current!, {
        touches: [{ clientX: 10, clientY: 400, identifier: 0 }],
      })
      fireEvent.touchMove(ref.current!, {
        touches: [{ clientX: 0, clientY: 400, identifier: 0 }],
      })
      fireEvent.touchEnd(ref.current!, { touches: [] })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockBack).not.toHaveBeenCalled()
  })

  it('disabled=true: 触摸事件不触发 back()', async () => {
    window.matchMedia = makeMatchMedia(true)
    const { useEdgeSwipeBack } = await import('@/hooks/useEdgeSwipeBack')
    const ref = createRef<HTMLDivElement>()

    function TestComp() {
      useEdgeSwipeBack(ref as React.RefObject<HTMLDivElement | null>, { disabled: true })
      return <div ref={ref}>content</div>
    }

    render(<TestComp />)
    await act(async () => {
      fireEvent.touchStart(ref.current!, {
        touches: [{ clientX: 10, clientY: 400, identifier: 0 }],
      })
      fireEvent.touchMove(ref.current!, {
        touches: [{ clientX: 250, clientY: 400, identifier: 0 }],
      })
      fireEvent.touchEnd(ref.current!, { touches: [] })
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockBack).not.toHaveBeenCalled()
  })
})

// ── RouteStack ────────────────────────────────────────────────────────────────

describe('RouteStack', () => {
  it('渲染子内容', async () => {
    const { RouteStack } = await import('@/components/primitives/route-stack/RouteStack')
    render(<RouteStack><span>子内容</span></RouteStack>)
    expect(screen.getByText('子内容')).toBeTruthy()
  })

  it('useRouteStack 返回 NoopAPI（状态机未实装）', async () => {
    const { RouteStack, useRouteStack } = await import('@/components/primitives/route-stack/RouteStack')

    function Consumer() {
      const api = useRouteStack()
      return <div data-testid="index">{api.state.currentIndex}</div>
    }

    render(<RouteStack><Consumer /></RouteStack>)
    expect(screen.getByTestId('index').textContent).toBe('-1')
  })
})
