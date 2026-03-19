/**
 * tests/unit/components/admin/StatusBadge.test.tsx
 * CHG-24: StatusBadge 各状态渲染正确
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

  it('active 和 published 使用绿色圆点（#22c55e → rgb(34, 197, 94)）', () => {
    const { container: c1 } = render(<StatusBadge status="active" />)
    const dot1 = c1.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(dot1.style.background).toContain('34, 197, 94')  // JSDOM 转为 rgb

    const { container: c2 } = render(<StatusBadge status="published" />)
    const dot2 = c2.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(dot2.style.background).toContain('34, 197, 94')
  })

  it('banned 使用红色圆点（#ef4444 → rgb(239, 68, 68)）', () => {
    const { container } = render(<StatusBadge status="banned" />)
    const dot = container.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(dot.style.background).toContain('239, 68, 68')
  })

  it('pending 使用黄色圆点（#f59e0b → rgb(245, 158, 11)）', () => {
    const { container } = render(<StatusBadge status="pending" />)
    const dot = container.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(dot.style.background).toContain('245, 158, 11')
  })
})
