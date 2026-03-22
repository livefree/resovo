/**
 * tests/unit/components/admin/Pagination.test.tsx
 * CHG-24: Pagination 分页逻辑、按钮状态、回调
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from '@/components/admin/Pagination'

describe('Pagination', () => {
  it('显示页数信息', () => {
    render(<Pagination page={1} total={50} pageSize={10} onChange={vi.fn()} />)
    const text = screen.getByTestId('pagination').textContent ?? ''
    expect(text).toContain('50')
    expect(text).toContain('第 1')
    expect(text).toContain('5 页')
  })

  it('第一页时"上一页"禁用', () => {
    render(<Pagination page={1} total={50} pageSize={10} onChange={vi.fn()} />)
    const prev = screen.getByTestId('pagination-prev') as HTMLButtonElement
    expect(prev.disabled).toBe(true)
  })

  it('最后一页时"下一页"禁用', () => {
    render(<Pagination page={5} total={50} pageSize={10} onChange={vi.fn()} />)
    const next = screen.getByTestId('pagination-next') as HTMLButtonElement
    expect(next.disabled).toBe(true)
  })

  it('中间页两个按钮均可用', () => {
    render(<Pagination page={3} total={50} pageSize={10} onChange={vi.fn()} />)
    const prev = screen.getByTestId('pagination-prev') as HTMLButtonElement
    const next = screen.getByTestId('pagination-next') as HTMLButtonElement
    expect(prev.disabled).toBe(false)
    expect(next.disabled).toBe(false)
  })

  it('点击"上一页"调用 onChange(page-1)', () => {
    const onChange = vi.fn()
    render(<Pagination page={3} total={50} pageSize={10} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('pagination-prev'))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('点击"下一页"调用 onChange(page+1)', () => {
    const onChange = vi.fn()
    render(<Pagination page={3} total={50} pageSize={10} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('pagination-next'))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('total=0 时总页数为 1', () => {
    render(<Pagination page={1} total={0} pageSize={10} onChange={vi.fn()} />)
    expect(screen.getByTestId('pagination').textContent).toContain('1 页')
  })
})
