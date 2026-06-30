import { describe, it, expect } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import { SlidingUnderline, useUnderlineRegistry } from '@/components/primitives/sliding-underline'

// 注：ResizeObserver 由 tests/helpers/setup.ts 全局 polyfill；jsdom 不做 layout（offsetWidth/offsetLeft
// 恒为 0），几何/滑动断言留 Playwright（49-E-B/C 实测）。

describe('SlidingUnderline', () => {
  it('渲染带 .sliding-underline 类 + testId 的 span', () => {
    const registry = new Map<string, HTMLElement | null>([['home', document.createElement('a')]])
    render(<SlidingUnderline activeKey="home" registry={registry} testId="nav-underline" />)
    const span = screen.getByTestId('nav-underline')
    expect(span.className).toContain('sliding-underline')
    expect(span.getAttribute('aria-hidden')).toBe('true')
  })

  it('activeKey=null：下划线隐藏（opacity 0 / width 0）', () => {
    render(<SlidingUnderline activeKey={null} registry={new Map()} testId="u" />)
    const span = screen.getByTestId('u')
    expect(span.style.opacity).toBe('0')
    expect(span.style.width).toBe('0px')
  })

  it('activeKey 命中注册项：测量后可见（opacity 1）', () => {
    const el = document.createElement('a')
    const registry = new Map<string, HTMLElement | null>([['browse', el]])
    render(<SlidingUnderline activeKey="browse" registry={registry} testId="u" />)
    // 命中元素 → 测量（jsdom 几何为 0 但 geo 非 null）→ opacity 1
    expect(screen.getByTestId('u').style.opacity).toBe('1')
  })

  it('activeKey 未命中注册项：保持隐藏（不崩溃）', () => {
    render(<SlidingUnderline activeKey="missing" registry={new Map()} testId="u" />)
    expect(screen.getByTestId('u').style.opacity).toBe('0')
  })
})

describe('useUnderlineRegistry', () => {
  it('register(key) 返回稳定的 per-key ref 回调（同 key 同实例、异 key 异实例）', () => {
    const { result } = renderHook(() => useUnderlineRegistry())
    const cbA1 = result.current.register('a')
    const cbA2 = result.current.register('a')
    const cbB = result.current.register('b')
    expect(cbA1).toBe(cbA2)
    expect(cbB).not.toBe(cbA1)
  })

  it('注册 element 写入 registry；传 null 移除条目', () => {
    const { result } = renderHook(() => useUnderlineRegistry())
    const el = document.createElement('a')

    act(() => {
      result.current.register('a')(el)
    })
    expect(result.current.registry.get('a')).toBe(el)

    act(() => {
      result.current.register('a')(null)
    })
    expect(result.current.registry.has('a')).toBe(false)
  })
})
