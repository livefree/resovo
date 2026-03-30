/**
 * tests/unit/components/admin/StatusBadge.test.tsx
 * CHG-24: StatusBadge 各状态渲染正确
 * CHG-316: 断言改为 CSS 变量（不再 hardcode hex 颜色值）
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge, type BadgeStatus } from '@/components/admin/StatusBadge'

const STATUSES: BadgeStatus[] = ['active', 'inactive', 'pending', 'banned', 'published', 'draft']

describe('StatusBadge', () => {
  it.each(STATUSES)('渲染 %s 状态 badge', (status) => {
    render(<StatusBadge status={status} />)
    expect(screen.getByTestId(`status-badge-${status}`)).toBeTruthy()
  })

  it('active 和 published 使用 success 语义颜色圆点', () => {
    const { container: c1 } = render(<StatusBadge status="active" />)
    const dot1 = c1.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(dot1.style.background).toBe('var(--status-success)')

    const { container: c2 } = render(<StatusBadge status="published" />)
    const dot2 = c2.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(dot2.style.background).toBe('var(--status-success)')
  })

  it('banned 使用 danger 语义颜色圆点', () => {
    const { container } = render(<StatusBadge status="banned" />)
    const dot = container.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(dot.style.background).toBe('var(--status-danger)')
  })

  it('pending 使用 warning 语义颜色圆点', () => {
    const { container } = render(<StatusBadge status="pending" />)
    const dot = container.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(dot.style.background).toBe('var(--status-warning)')
  })

  it('inactive 和 draft 使用 neutral 语义颜色圆点', () => {
    const { container: c1 } = render(<StatusBadge status="inactive" />)
    const dot1 = c1.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(dot1.style.background).toBe('var(--status-neutral)')

    const { container: c2 } = render(<StatusBadge status="draft" />)
    const dot2 = c2.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(dot2.style.background).toBe('var(--status-neutral)')
  })
})
