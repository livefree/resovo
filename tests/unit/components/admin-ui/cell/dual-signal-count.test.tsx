/**
 * dual-signal-count.test.tsx — CHG-360-C / ADR-159 X/Y 聚合显示守卫
 *
 * 覆盖（≥ 6 case / arch-reviewer Y6 要求）：
 *   1. 基础挂载 + role=group + aria-label
 *   2. 4 state 颜色映射（ok 绿 / partial 黄 / all_dead 红 / pending 灰）
 *   3. X/Y 格式 zero-pad 2 位（"02/03"）
 *   4. total >= 10 不 zero-pad（"12/15"）
 *   5. total=0 显示 "—"（pending 占位）
 *   6. a11y aria-label 显式中文语义（不只读数字）
 */

import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { DualSignalCount } from '../../../../../packages/admin-ui/src/components/cell/dual-signal-count'
import type { DualSignalAggregate } from '@resovo/types'

afterEach(() => cleanup())

const ok: DualSignalAggregate = { total: 3, ok: 3, state: 'ok' }
const partial: DualSignalAggregate = { total: 3, ok: 2, state: 'partial' }
const allDead: DualSignalAggregate = { total: 3, ok: 0, state: 'all_dead' }
const pending: DualSignalAggregate = { total: 0, ok: 0, state: 'pending' }

describe('DualSignalCount — 基础渲染', () => {
  it('1. 挂载 data-dual-signal-count + role=group + aria-label', () => {
    const { container } = render(<DualSignalCount probe={ok} render={ok} />)
    const root = container.querySelector('[data-dual-signal-count]')
    expect(root).toBeTruthy()
    expect(root?.getAttribute('role')).toBe('group')
    expect(root?.getAttribute('aria-label')).toBe('探测/播放聚合信号')
    expect(container.querySelector('[data-dual-signal-count-row="probe"]')).toBeTruthy()
    expect(container.querySelector('[data-dual-signal-count-row="render"]')).toBeTruthy()
  })
})

describe('DualSignalCount — 4 state 颜色映射 + 文本', () => {
  const cases: Array<[DualSignalAggregate, string, string]> = [
    [ok, '可用', '--state-success-fg'],
    [partial, '可用', '--state-warning-fg'],
    [allDead, '失效', '--state-error-fg'],
    [pending, '暂无数据', '--fg-muted'],
  ]
  for (const [agg, ariaSubstring, color] of cases) {
    it(`2. state=${agg.state} → tone color ${color}`, () => {
      const { container } = render(<DualSignalCount probe={agg} render={ok} />)
      const probeRow = container.querySelector('[data-dual-signal-count-row="probe"]') as HTMLElement
      expect(probeRow.getAttribute('data-state')).toBe(agg.state)
      // aria-label 含中文显式语义
      const ariaLabel = probeRow.getAttribute('aria-label') ?? ''
      expect(ariaLabel).toContain(ariaSubstring)
      // dot 染色
      const dot = probeRow.querySelector('span[aria-hidden="true"]') as HTMLElement
      expect(dot.style.background).toContain(color)
    })
  }
})

describe('DualSignalCount — X/Y 格式 (Y4 zero-pad)', () => {
  it('3. total < 10 → zero-pad 2 位 ("02/03")', () => {
    const { container } = render(<DualSignalCount probe={partial} render={ok} />)
    const probeRow = container.querySelector('[data-dual-signal-count-row="probe"]') as HTMLElement
    expect(probeRow.textContent).toContain('02/03')
  })

  it('4. total >= 10 → 不 zero-pad ("12/15")', () => {
    const big: DualSignalAggregate = { total: 15, ok: 12, state: 'partial' }
    const { container } = render(<DualSignalCount probe={big} render={ok} />)
    const probeRow = container.querySelector('[data-dual-signal-count-row="probe"]') as HTMLElement
    expect(probeRow.textContent).toContain('12/15')
  })

  it('5. total=0 (pending) → 显示 "—"', () => {
    const { container } = render(<DualSignalCount probe={pending} render={ok} />)
    const probeRow = container.querySelector('[data-dual-signal-count-row="probe"]') as HTMLElement
    expect(probeRow.textContent).toContain('—')
  })

  it('5b. all_dead → "0/3" 显示完整 zero-pad', () => {
    const { container } = render(<DualSignalCount probe={allDead} render={ok} />)
    const probeRow = container.querySelector('[data-dual-signal-count-row="probe"]') as HTMLElement
    expect(probeRow.textContent).toContain('00/03')
  })
})

describe('DualSignalCount — a11y aria-label 显式中文语义 (Y7)', () => {
  it('6. partial → "链接探测：3 项中 2 项可用"', () => {
    const { container } = render(<DualSignalCount probe={partial} render={partial} />)
    const probeRow = container.querySelector('[data-dual-signal-count-row="probe"]') as HTMLElement
    expect(probeRow.getAttribute('aria-label')).toBe('链接探测：3 项中 2 项可用')
    const renderRow = container.querySelector('[data-dual-signal-count-row="render"]') as HTMLElement
    expect(renderRow.getAttribute('aria-label')).toBe('实际播放：3 项中 2 项可用')
  })

  it('6b. ok / all_dead / pending 各自显式语义', () => {
    const { container: c1 } = render(<DualSignalCount probe={ok} render={ok} />)
    expect(c1.querySelector('[data-dual-signal-count-row="probe"]')?.getAttribute('aria-label'))
      .toBe('链接探测：3 项均可用')
    const { container: c2 } = render(<DualSignalCount probe={allDead} render={allDead} />)
    expect(c2.querySelector('[data-dual-signal-count-row="probe"]')?.getAttribute('aria-label'))
      .toBe('链接探测：3 项均失效')
    const { container: c3 } = render(<DualSignalCount probe={pending} render={pending} />)
    expect(c3.querySelector('[data-dual-signal-count-row="probe"]')?.getAttribute('aria-label'))
      .toBe('链接探测：暂无数据')
  })
})

describe('DualSignalCount — minPillWidth 透传', () => {
  it('默认 62px / 可覆盖', () => {
    const { container } = render(<DualSignalCount probe={ok} render={ok} minPillWidth={80} />)
    const probeRow = container.querySelector('[data-dual-signal-count-row="probe"]') as HTMLElement
    expect(probeRow.style.minWidth).toBe('80px')
  })
})
