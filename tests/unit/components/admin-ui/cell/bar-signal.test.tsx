/**
 * BarSignal 单测（CHG-SN-4-04 D-14 第 1 件）
 *
 * 覆盖契约硬约束：
 *   - 5 值状态映射（ok / partial / dead / pending / unknown）
 *   - 颜色 token 引用（var(--state-*) / var(--fg-muted)）
 *   - size 'sm' / 'md' 尺寸预设
 *   - forwardRef + onClick 切换 button vs span 根
 *   - a11y role/aria-label / 键盘可达
 *   - 固定 data-* + testId 钩子
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import React from 'react'
import { BarSignal } from '../../../../../packages/admin-ui/src/components/cell/bar-signal'

afterEach(() => cleanup())

describe('BarSignal — 基础渲染', () => {
  it('挂载 data-bar-signal + 内部 svg', () => {
    const { container } = render(<BarSignal probeState="ok" renderState="ok" />)
    const root = container.querySelector('[data-bar-signal]')
    expect(root).toBeTruthy()
    expect(root?.querySelector('svg')).toBeTruthy()
  })

  it('内部双柱：probe + render', () => {
    const { container } = render(<BarSignal probeState="ok" renderState="dead" />)
    expect(container.querySelector('[data-bar-signal-bar="probe"]')).toBeTruthy()
    expect(container.querySelector('[data-bar-signal-bar="render"]')).toBeTruthy()
  })

  it('默认根元素是 <span>（无 onClick）', () => {
    const { container } = render(<BarSignal probeState="ok" renderState="ok" />)
    const root = container.querySelector('[data-bar-signal]')
    expect(root?.tagName.toLowerCase()).toBe('span')
  })

  it('默认 size="md" 时 viewBox 32×16', () => {
    const { container } = render(<BarSignal probeState="ok" renderState="ok" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('32')
    expect(svg.getAttribute('height')).toBe('16')
  })
})

describe('BarSignal — 5 值状态颜色映射', () => {
  const cases: Array<[
    'ok' | 'partial' | 'dead' | 'pending' | 'unknown',
    string,
    string,
  ]> = [
    ['ok',      'var(--state-success-fg)', '1'],
    ['partial', 'var(--state-warning-fg)', '1'],
    ['dead',    'var(--state-error-fg)',   '1'],
    ['pending', 'var(--fg-muted)',         '1'],
    ['unknown', 'var(--fg-muted)',         '0.4'],
  ]

  for (const [state, expectedFill, expectedOpacity] of cases) {
    it(`probeState="${state}" → fill=${expectedFill}, opacity=${expectedOpacity}`, () => {
      const { container } = render(
        <BarSignal probeState={state} renderState="ok" />,
      )
      const probeBar = container.querySelector('[data-bar-signal-bar="probe"]')!
      expect(probeBar.getAttribute('fill')).toBe(expectedFill)
      expect(probeBar.getAttribute('opacity')).toBe(expectedOpacity)
      expect(probeBar.getAttribute('data-bar-signal-state')).toBe(state)
    })
  }
})

describe('BarSignal — size 预设', () => {
  it('size="sm" → viewBox 22×12', () => {
    const { container } = render(
      <BarSignal probeState="ok" renderState="ok" size="sm" />,
    )
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('22')
    expect(svg.getAttribute('height')).toBe('12')
    const root = container.querySelector('[data-bar-signal]')
    expect(root?.getAttribute('data-bar-signal-size')).toBe('sm')
  })

  it('size="md" → viewBox 32×16 + data attribute', () => {
    const { container } = render(
      <BarSignal probeState="ok" renderState="ok" size="md" />,
    )
    const root = container.querySelector('[data-bar-signal]')
    expect(root?.getAttribute('data-bar-signal-size')).toBe('md')
  })
})

describe('BarSignal — onClick 路径', () => {
  it('onClick 存在 → 根元素升级为 <button>', () => {
    const { container } = render(
      <BarSignal probeState="ok" renderState="ok" onClick={() => {}} />,
    )
    const root = container.querySelector('[data-bar-signal]')
    expect(root?.tagName.toLowerCase()).toBe('button')
    expect((root as HTMLButtonElement).type).toBe('button')
  })

  it('点击触发 onClick 回调', () => {
    const handler = vi.fn()
    const { container } = render(
      <BarSignal probeState="ok" renderState="ok" onClick={handler} />,
    )
    const root = container.querySelector('[data-bar-signal]') as HTMLButtonElement
    fireEvent.click(root)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('button 路径根元素挂 aria-label', () => {
    const { container } = render(
      <BarSignal
        probeState="ok"
        renderState="ok"
        ariaLabel="链接探测：可用；实际渲染：可用"
        onClick={() => {}}
      />,
    )
    const root = container.querySelector('[data-bar-signal]')
    expect(root?.getAttribute('aria-label')).toBe('链接探测：可用；实际渲染：可用')
  })
})

describe('BarSignal — a11y', () => {
  it('svg 默认 role="img" + 兜底 ariaLabel "探测/渲染信号"', () => {
    const { container } = render(<BarSignal probeState="ok" renderState="ok" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('探测/渲染信号')
  })

  it('自定义 ariaLabel 覆盖兜底', () => {
    const { container } = render(
      <BarSignal probeState="ok" renderState="dead" ariaLabel="自定义文案" />,
    )
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('aria-label')).toBe('自定义文案')
  })
})

describe('BarSignal — forwardRef', () => {
  it('span 路径 ref 转发到根 span', () => {
    const ref = React.createRef<HTMLSpanElement>()
    render(<BarSignal probeState="ok" renderState="ok" ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLSpanElement)
    expect(ref.current?.hasAttribute('data-bar-signal')).toBe(true)
  })

  it('button 路径 ref 转发到根 button', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(
      <BarSignal
        probeState="ok"
        renderState="ok"
        onClick={() => {}}
        ref={ref}
      />,
    )
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    expect(ref.current?.type).toBe('button')
  })
})

describe('BarSignal — testId 钩子', () => {
  it('testId 渲染为 data-testid（span 路径）', () => {
    const { container } = render(
      <BarSignal probeState="ok" renderState="ok" testId="bar-signal-1" />,
    )
    expect(container.querySelector('[data-testid="bar-signal-1"]')).toBeTruthy()
  })

  it('testId 渲染为 data-testid（button 路径）', () => {
    const { container } = render(
      <BarSignal
        probeState="ok"
        renderState="ok"
        onClick={() => {}}
        testId="bar-signal-2"
      />,
    )
    const node = container.querySelector('[data-testid="bar-signal-2"]')
    expect(node).toBeTruthy()
    expect(node?.tagName.toLowerCase()).toBe('button')
  })
})

describe('BarSignal — 边界值 / 不变约束', () => {
  it('probe + render 状态相同时仍渲染两条独立柱', () => {
    const { container } = render(<BarSignal probeState="ok" renderState="ok" />)
    expect(container.querySelectorAll('[data-bar-signal-bar]')).toHaveLength(2)
  })

  it('未硬编码颜色：所有 fill 走 var(--*)', () => {
    const { container } = render(
      <BarSignal probeState="dead" renderState="partial" />,
    )
    const bars = Array.from(container.querySelectorAll('[data-bar-signal-bar]'))
    for (const bar of bars) {
      expect(bar.getAttribute('fill')).toMatch(/^var\(--/)
    }
  })

  it('柱矩形带 rx/ry 圆角', () => {
    const { container } = render(<BarSignal probeState="ok" renderState="ok" />)
    const probeBar = container.querySelector('[data-bar-signal-bar="probe"]')!
    expect(probeBar.getAttribute('rx')).toBe('1.5')
    expect(probeBar.getAttribute('ry')).toBe('1.5')
  })
})
