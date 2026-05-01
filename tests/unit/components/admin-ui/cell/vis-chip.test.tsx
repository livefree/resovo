/**
 * VisChip 单测（CHG-DESIGN-12 12B）
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { VisChip } from '../../../../../packages/admin-ui/src/components/cell/vis-chip'

afterEach(() => cleanup())

describe('VisChip — 5 派生分支（按优先级，与 packages/types 真源 enum 对齐）', () => {
  it('1. review=rejected + visibility=public → "已拒" danger', () => {
    const { container } = render(<VisChip visibility="public" review="rejected" />)
    const chip = container.querySelector('[data-vis-chip]') as HTMLElement
    expect(chip.getAttribute('data-derived')).toBe('rejected')
    const pill = chip.querySelector('[data-pill]') as HTMLElement
    expect(pill.getAttribute('data-variant')).toBe('danger')
    expect(pill.textContent).toContain('已拒')
  })

  it('1. review=rejected + visibility=hidden → 仍 "已拒" danger（review 优先级高）', () => {
    const { container } = render(<VisChip visibility="hidden" review="rejected" />)
    expect(container.querySelector('[data-derived]')?.getAttribute('data-derived')).toBe('rejected')
  })

  it('2. review=pending_review + visibility=public → "待审" warn', () => {
    const { container } = render(<VisChip visibility="public" review="pending_review" />)
    const chip = container.querySelector('[data-vis-chip]') as HTMLElement
    expect(chip.getAttribute('data-derived')).toBe('pending')
    const pill = chip.querySelector('[data-pill]') as HTMLElement
    expect(pill.getAttribute('data-variant')).toBe('warn')
    expect(pill.textContent).toContain('待审')
  })

  it('3. review=approved + visibility=public → "前台可见" ok', () => {
    const { container } = render(<VisChip visibility="public" review="approved" />)
    const chip = container.querySelector('[data-vis-chip]') as HTMLElement
    expect(chip.getAttribute('data-derived')).toBe('public')
    const pill = chip.querySelector('[data-pill]') as HTMLElement
    expect(pill.getAttribute('data-variant')).toBe('ok')
    expect(pill.textContent).toContain('前台可见')
  })

  it('4. review=approved + visibility=internal → "仅内部" neutral', () => {
    const { container } = render(<VisChip visibility="internal" review="approved" />)
    const chip = container.querySelector('[data-vis-chip]') as HTMLElement
    expect(chip.getAttribute('data-derived')).toBe('internal')
    const pill = chip.querySelector('[data-pill]') as HTMLElement
    expect(pill.getAttribute('data-variant')).toBe('neutral')
    expect(pill.textContent).toContain('仅内部')
  })

  it('5. review=approved + visibility=hidden → "隐藏" danger', () => {
    const { container } = render(<VisChip visibility="hidden" review="approved" />)
    const chip = container.querySelector('[data-vis-chip]') as HTMLElement
    expect(chip.getAttribute('data-derived')).toBe('hidden')
    const pill = chip.querySelector('[data-pill]') as HTMLElement
    expect(pill.getAttribute('data-variant')).toBe('danger')
    expect(pill.textContent).toContain('隐藏')
  })
})

describe('VisChip — a11y 复合语义（区分 已拒 vs 隐藏）', () => {
  it('approved+hidden ariaLabel 含 raw 值（与 rejected 区分）', () => {
    const { container } = render(<VisChip visibility="hidden" review="approved" />)
    const pill = container.querySelector('[data-pill]')!
    const label = pill.getAttribute('aria-label')!
    expect(label).toContain('隐藏')
    expect(label).toContain('visibility=hidden')
    expect(label).toContain('review=approved')
  })

  it('rejected+hidden ariaLabel 含 raw 值（与 approved+hidden 区分）', () => {
    const { container } = render(<VisChip visibility="hidden" review="rejected" />)
    const pill = container.querySelector('[data-pill]')!
    const label = pill.getAttribute('aria-label')!
    expect(label).toContain('已拒')
    expect(label).toContain('review=rejected')
  })
})

describe('VisChip — data attribute / 测试钩子', () => {
  it('data-visibility / data-review / data-derived 完整', () => {
    const { container } = render(<VisChip visibility="public" review="approved" />)
    const chip = container.querySelector('[data-vis-chip]')!
    expect(chip.getAttribute('data-visibility')).toBe('public')
    expect(chip.getAttribute('data-review')).toBe('approved')
    expect(chip.getAttribute('data-derived')).toBe('public')
  })

  it('testId → data-testid', () => {
    const { container } = render(<VisChip visibility="public" review="approved" testId="vc-1" />)
    expect(container.querySelector('[data-testid="vc-1"]')).toBeTruthy()
  })
})
