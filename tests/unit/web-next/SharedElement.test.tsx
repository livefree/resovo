import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { createRef } from 'react'

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

  // Mock Web Animations API
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    writable: true,
    value: vi.fn().mockReturnValue({
      cancel: vi.fn(),
      onfinish: null,
      finished: Promise.resolve(),
    }),
  })
})

// Reset window registry between tests
beforeEach(() => {
  const w = window as Window & { __resovoSharedElementMap?: Map<string, unknown> }
  if (w.__resovoSharedElementMap) w.__resovoSharedElementMap.clear()
})

// ── registry ──────────────────────────────────────────────────────────────────

describe('registry', () => {
  it('consumeSnapshot: 超过 500ms 的 snapshot 返回 null', async () => {
    const { captureSnapshot, consumeSnapshot, registry } = await import(
      '@/components/primitives/shared-element/registry'
    )
    const el = document.createElement('div')
    el.getBoundingClientRect = () =>
      ({ left: 10, top: 20, width: 100, height: 150 } as DOMRect)
    Object.defineProperty(el, 'isConnected', { get: () => true })
    registry.register('test:1:cover', el, 'cover')

    // 覆盖 capturedAt 为过期时间
    vi.spyOn(performance, 'now').mockReturnValueOnce(0)
    captureSnapshot('test:1:cover')
    vi.spyOn(performance, 'now').mockReturnValueOnce(600)

    const result = consumeSnapshot('test:1:cover')
    expect(result).toBeNull()
  })

  it('consumeSnapshot: 500ms 内的 snapshot 返回并清除', async () => {
    const { captureSnapshot, consumeSnapshot, registry } = await import(
      '@/components/primitives/shared-element/registry'
    )
    const el = document.createElement('div')
    el.getBoundingClientRect = () =>
      ({ left: 5, top: 15, width: 80, height: 120 } as DOMRect)
    Object.defineProperty(el, 'isConnected', { get: () => true })
    registry.register('test:2:cover', el, 'cover')

    vi.spyOn(performance, 'now').mockReturnValue(1000)
    captureSnapshot('test:2:cover')

    const snap = consumeSnapshot('test:2:cover')
    expect(snap).not.toBeNull()
    expect(snap!.rect.left).toBe(5)

    // Second consume returns null (cleared)
    const snap2 = consumeSnapshot('test:2:cover')
    expect(snap2).toBeNull()
  })

  it('captureSnapshot: 未连接的元素不写入 snapshot', async () => {
    const { captureSnapshot, consumeSnapshot, registry } = await import(
      '@/components/primitives/shared-element/registry'
    )
    const el = document.createElement('div')
    Object.defineProperty(el, 'isConnected', { get: () => false })
    registry.register('test:3:cover', el, 'cover')

    captureSnapshot('test:3:cover')
    expect(consumeSnapshot('test:3:cover')).toBeNull()
  })

  it('Registry 不超过 64 条记录', async () => {
    const { registry } = await import('@/components/primitives/shared-element/registry')
    for (let i = 0; i < 70; i++) {
      const el = document.createElement('div')
      registry.register(`test:entry-${i}:cover`, el, 'cover')
    }
    const w = window as Window & { __resovoSharedElementMap?: Map<string, unknown> }
    expect(w.__resovoSharedElementMap!.size).toBeLessThanOrEqual(64)
  })
})

// ── SharedElement component ───────────────────────────────────────────────────

describe('SharedElement', () => {
  it('渲染 data-shared-element-id 属性', async () => {
    const { SharedElement } = await import('@/components/primitives/shared-element/SharedElement')
    render(<SharedElement id="movie:1:cover">内容</SharedElement>)
    expect(screen.getByText('内容').closest('[data-shared-element-id]')).toBeTruthy()
  })

  it('forwardRef getRect 可调用', async () => {
    const { SharedElement } = await import('@/components/primitives/shared-element/SharedElement')
    const ref = createRef<import('@/components/primitives/shared-element/types').SharedElementRef>()
    render(<SharedElement id="movie:2:cover" ref={ref}>x</SharedElement>)
    expect(typeof ref.current?.getRect).toBe('function')
  })
})

// ── SharedElementLink ─────────────────────────────────────────────────────────

describe('SharedElementLink', () => {
  it('渲染为 <a> 标签', async () => {
    vi.mock('next/link', () => ({
      default: ({
        href,
        children,
        ...rest
      }: {
        href: string
        children: React.ReactNode
        [k: string]: unknown
      }) => <a href={href} {...rest}>{children}</a>,
    }))
    const { SharedElementLink } = await import(
      '@/components/primitives/shared-element/SharedElementLink'
    )
    render(<SharedElementLink sharedId="movie:1:cover" href="/movie/1">封面</SharedElementLink>)
    const link = screen.getByText('封面').closest('a')
    expect(link).toBeTruthy()
    expect(link!.getAttribute('href')).toBe('/movie/1')
  })
})

// ── useFLIP ───────────────────────────────────────────────────────────────────

describe('useFLIP', () => {
  it('无 snapshot 时不调用 animate', async () => {
    const { useFLIP } = await import('@/hooks/useFLIP')
    const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate')
    animateSpy.mockClear()

    function TestComp() {
      const ref = createRef<HTMLDivElement>()
      useFLIP('no-snapshot-id', ref as React.RefObject<HTMLElement | null>)
      return <div ref={ref}>test</div>
    }

    render(<TestComp />)
    expect(animateSpy).not.toHaveBeenCalled()
  })
})
