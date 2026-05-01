/**
 * DualSignal 单测（CHG-DESIGN-12 12B）
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { DualSignal } from '../../../../../packages/admin-ui/src/components/cell/dual-signal'

afterEach(() => cleanup())

describe('DualSignal — 基础渲染', () => {
  it('挂载 data-dual-signal + role=group + ariaLabel', () => {
    const { container } = render(<DualSignal probe="ok" render="ok" />)
    const root = container.querySelector('[data-dual-signal]')
    expect(root).toBeTruthy()
    expect(root?.getAttribute('role')).toBe('group')
    expect(root?.getAttribute('aria-label')).toBe('探测/播放双信号')
  })

  it('内部双行：probe + render', () => {
    const { container } = render(<DualSignal probe="ok" render="dead" />)
    expect(container.querySelector('[data-dual-signal-row="probe"]')).toBeTruthy()
    expect(container.querySelector('[data-dual-signal-row="render"]')).toBeTruthy()
  })
})

describe('DualSignal — 4 状态文案 + dot 染色', () => {
  const cases: Array<['ok' | 'partial' | 'dead' | 'unknown', string, string]> = [
    ['ok', '可用', '--state-success-fg'],
    ['partial', '部分', '--state-warning-fg'],
    ['dead', '失效', '--state-error-fg'],
    ['unknown', '未测', '--fg-muted'],
  ]
  for (const [state, label, color] of cases) {
    it(`probe=${state} → 文案="${label}" + dot ${color}`, () => {
      const { container } = render(<DualSignal probe={state} render="ok" />)
      const probeRow = container.querySelector('[data-dual-signal-row="probe"]') as HTMLElement
      expect(probeRow.getAttribute('data-state')).toBe(state)
      expect(probeRow.textContent).toContain(label)
      const dot = probeRow.querySelector('span[aria-hidden="true"]') as HTMLElement
      expect(dot.style.background).toContain(color)
    })
  }
})

describe('DualSignal — probe / render 各自独立染色 + 标签', () => {
  it('probe 行：bg dual-signal-probe-soft + 探标签 dual-signal-probe', () => {
    const { container } = render(<DualSignal probe="ok" render="ok" />)
    const probeRow = container.querySelector('[data-dual-signal-row="probe"]') as HTMLElement
    expect(probeRow.style.background).toContain('--dual-signal-probe-soft')
    // 探 / 播 标签独立 span
    expect(probeRow.textContent).toContain('探')
  })

  it('render 行：bg dual-signal-render-soft + 播标签 dual-signal-render', () => {
    const { container } = render(<DualSignal probe="ok" render="ok" />)
    const renderRow = container.querySelector('[data-dual-signal-row="render"]') as HTMLElement
    expect(renderRow.style.background).toContain('--dual-signal-render-soft')
    expect(renderRow.textContent).toContain('播')
  })

  it('probe + render 状态独立组合（如 probe=ok / render=dead）', () => {
    const { container } = render(<DualSignal probe="ok" render="dead" />)
    const probe = container.querySelector('[data-dual-signal-row="probe"]') as HTMLElement
    const renderRow = container.querySelector('[data-dual-signal-row="render"]') as HTMLElement
    expect(probe.getAttribute('data-state')).toBe('ok')
    expect(renderRow.getAttribute('data-state')).toBe('dead')
    expect(probe.textContent).toContain('可用')
    expect(renderRow.textContent).toContain('失效')
  })
})

describe('DualSignal — a11y / 测试钩子', () => {
  it('每个 row 独立 aria-label + role=status', () => {
    const { container } = render(<DualSignal probe="ok" render="dead" />)
    const probeRow = container.querySelector('[data-dual-signal-row="probe"]')!
    const renderRow = container.querySelector('[data-dual-signal-row="render"]')!
    expect(probeRow.getAttribute('role')).toBe('status')
    expect(probeRow.getAttribute('aria-label')).toBe('链接探测：可用')
    expect(renderRow.getAttribute('aria-label')).toBe('实际播放：失效')
  })

  it('minPillWidth 默认 62px', () => {
    const { container } = render(<DualSignal probe="ok" render="ok" />)
    const probe = container.querySelector('[data-dual-signal-row="probe"]') as HTMLElement
    expect(probe.style.minWidth).toBe('62px')
  })

  it('minPillWidth 自定义', () => {
    const { container } = render(<DualSignal probe="ok" render="ok" minPillWidth={80} />)
    const probe = container.querySelector('[data-dual-signal-row="probe"]') as HTMLElement
    expect(probe.style.minWidth).toBe('80px')
  })

  it('testId → data-testid', () => {
    const { container } = render(<DualSignal probe="ok" render="ok" testId="ds-row-1" />)
    expect(container.querySelector('[data-testid="ds-row-1"]')).toBeTruthy()
  })
})
