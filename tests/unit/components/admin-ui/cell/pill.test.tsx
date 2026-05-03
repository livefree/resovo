/**
 * Pill 单测（CHG-DESIGN-12 12B）
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { Pill } from '../../../../../packages/admin-ui/src/components/cell/pill'

afterEach(() => cleanup())

describe('Pill — 基础渲染', () => {
  it('挂载 data-pill + data-variant 默认 neutral', () => {
    const { container } = render(<Pill>Hello</Pill>)
    const root = container.querySelector('[data-pill]')
    expect(root).toBeTruthy()
    expect(root?.getAttribute('data-variant')).toBe('neutral')
  })

  it('children 文本渲染', () => {
    const { container } = render(<Pill>已通过</Pill>)
    expect(container.querySelector('[data-pill-content]')?.textContent).toBe('已通过')
  })

  it('必含 6px dot（设计稿硬约束）', () => {
    const { container } = render(<Pill>L</Pill>)
    const dot = container.querySelector('[data-pill-dot]') as HTMLElement
    expect(dot).toBeTruthy()
    expect(dot.style.width).toBe('6px')
    expect(dot.style.height).toBe('6px')
    expect(dot.style.borderRadius).toBe('50%')
  })

  it('role=status 隐式状态指示器', () => {
    const { container } = render(<Pill>L</Pill>)
    expect(container.querySelector('[data-pill]')?.getAttribute('role')).toBe('status')
  })
})

describe('Pill — 8 variant 染色', () => {
  const cases: Array<['neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'probe' | 'render', string, string]> = [
    ['neutral', '--bg-surface-row', '--fg-muted'],
    ['ok', '--state-success-bg', '--state-success-fg'],
    ['warn', '--state-warning-bg', '--state-warning-fg'],
    ['danger', '--state-error-bg', '--state-error-fg'],
    ['info', '--state-info-bg', '--state-info-fg'],
    ['accent', '--admin-accent-soft', '--admin-accent-on-soft'],
    ['probe', '--dual-signal-probe-soft', '--dual-signal-probe'],
    ['render', '--dual-signal-render-soft', '--dual-signal-render'],
  ]

  for (const [variant, bgToken, fgToken] of cases) {
    it(`variant=${variant} → bg=${bgToken} fg=${fgToken} + dot 染 fg`, () => {
      const { container } = render(<Pill variant={variant}>L</Pill>)
      const root = container.querySelector('[data-pill]') as HTMLElement
      const dot = container.querySelector('[data-pill-dot]') as HTMLElement
      expect(root.style.background).toContain(bgToken)
      expect(root.style.color).toContain(fgToken)
      expect(dot.style.background).toContain(fgToken)
      expect(root.getAttribute('data-variant')).toBe(variant)
    })
  }
})

describe('Pill — a11y aria-label', () => {
  it('children 是 string → ariaLabel 默认 = children', () => {
    const { container } = render(<Pill>已通过</Pill>)
    expect(container.querySelector('[data-pill]')?.getAttribute('aria-label')).toBe('已通过')
  })

  it('children 是 number → ariaLabel = String(children)', () => {
    const { container } = render(<Pill>{42}</Pill>)
    expect(container.querySelector('[data-pill]')?.getAttribute('aria-label')).toBe('42')
  })

  it('显式 ariaLabel → 直接使用', () => {
    const { container } = render(<Pill ariaLabel="自定义">X</Pill>)
    expect(container.querySelector('[data-pill]')?.getAttribute('aria-label')).toBe('自定义')
  })
})

describe('Pill — dev warn for non-string children', () => {
  it('children 是 ReactNode + ariaLabel 缺失 → console.warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<Pill><span>complex</span></Pill>)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/non-primitive ReactNode/)
    warn.mockRestore()
  })

  it('children 是 ReactNode + ariaLabel 显式传 → 不 warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<Pill ariaLabel="复合"><span>complex</span></Pill>)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('Pill — 测试钩子', () => {
  it('testId → data-testid', () => {
    const { container } = render(<Pill testId="pill-review">L</Pill>)
    expect(container.querySelector('[data-testid="pill-review"]')).toBeTruthy()
  })
})
