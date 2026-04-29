/**
 * Pagination v2 单测（CHG-SN-2-15）
 * 覆盖：buildPageWindow 纯函数 / 渲染页码 / 上下翻页 / 首末页 / ellipsis /
 *       边界禁用 / pageSize 切换 / aria / SSR 零 throw
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { Pagination, buildPageWindow } from '../../../../../packages/admin-ui/src/components/pagination/pagination'

// ── buildPageWindow 纯函数 ────────────────────────────────────────

describe('buildPageWindow', () => {
  it('totalPages=0 返回空数组', () => {
    expect(buildPageWindow(1, 0, 2)).toEqual([])
  })

  it('totalPages=1 → [1]', () => {
    expect(buildPageWindow(1, 1, 2)).toEqual([1])
  })

  it('page=3 totalPages=10 window=2 → [1,2,3,4,5]', () => {
    expect(buildPageWindow(3, 10, 2)).toEqual([1, 2, 3, 4, 5])
  })

  it('page=1 window=2 → 从 1 开始，不超前', () => {
    expect(buildPageWindow(1, 10, 2)).toEqual([1, 2, 3])
  })

  it('page=10 totalPages=10 window=2 → 至最后页', () => {
    expect(buildPageWindow(10, 10, 2)).toEqual([8, 9, 10])
  })

  it('page=5 window=1 → [4,5,6]', () => {
    expect(buildPageWindow(5, 10, 1)).toEqual([4, 5, 6])
  })
})

// ── Pagination render ────────────────────────────────────────────

describe('Pagination — 基础渲染', () => {
  it('data-pagination 根节点存在', () => {
    const { container } = render(
      <Pagination page={1} pageSize={20} totalRows={100} onPageChange={vi.fn()} />,
    )
    expect(container.querySelector('[data-pagination]')).toBeTruthy()
  })

  it('渲染上一页 / 下一页按钮', () => {
    render(<Pagination page={2} pageSize={20} totalRows={100} onPageChange={vi.fn()} />)
    expect(screen.getByLabelText('上一页')).toBeTruthy()
    expect(screen.getByLabelText('下一页')).toBeTruthy()
  })

  it('显示 "X–Y / total" 计数', () => {
    render(<Pagination page={1} pageSize={20} totalRows={100} onPageChange={vi.fn()} />)
    expect(screen.getByText('1–20 / 100')).toBeTruthy()
  })

  it('第 2 页计数正确', () => {
    render(<Pagination page={2} pageSize={20} totalRows={100} onPageChange={vi.fn()} />)
    expect(screen.getByText('21–40 / 100')).toBeTruthy()
  })

  it('totalRows=0 显示 "暂无数据"', () => {
    render(<Pagination page={1} pageSize={20} totalRows={0} onPageChange={vi.fn()} />)
    expect(screen.getByText('暂无数据')).toBeTruthy()
  })
})

// ── edge buttons ─────────────────────────────────────────────────

describe('Pagination — 边界禁用', () => {
  it('page=1 时上一页 disabled', () => {
    render(<Pagination page={1} pageSize={20} totalRows={100} onPageChange={vi.fn()} />)
    expect((screen.getByLabelText('上一页') as HTMLButtonElement).disabled).toBe(true)
  })

  it('page=最后页时下一页 disabled', () => {
    render(<Pagination page={5} pageSize={20} totalRows={100} onPageChange={vi.fn()} />)
    expect((screen.getByLabelText('下一页') as HTMLButtonElement).disabled).toBe(true)
  })

  it('page=2 两个按钮都不 disabled', () => {
    render(<Pagination page={2} pageSize={20} totalRows={100} onPageChange={vi.fn()} />)
    expect((screen.getByLabelText('上一页') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByLabelText('下一页') as HTMLButtonElement).disabled).toBe(false)
  })
})

// ── navigation ───────────────────────────────────────────────────

describe('Pagination — 翻页回调', () => {
  it('点击下一页 → onPageChange(page+1)', () => {
    const onChange = vi.fn()
    render(<Pagination page={2} pageSize={20} totalRows={100} onPageChange={onChange} />)
    fireEvent.click(screen.getByLabelText('下一页'))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('点击上一页 → onPageChange(page-1)', () => {
    const onChange = vi.fn()
    render(<Pagination page={3} pageSize={20} totalRows={100} onPageChange={onChange} />)
    fireEvent.click(screen.getByLabelText('上一页'))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('点击具体页码 → onPageChange(该页)', () => {
    const onChange = vi.fn()
    render(<Pagination page={1} pageSize={20} totalRows={100} onPageChange={onChange} />)
    fireEvent.click(screen.getByLabelText('第 3 页'))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('disabled 上一页点击不触发', () => {
    const onChange = vi.fn()
    render(<Pagination page={1} pageSize={20} totalRows={100} onPageChange={onChange} />)
    fireEvent.click(screen.getByLabelText('上一页'))
    expect(onChange).not.toHaveBeenCalled()
  })
})

// ── pageSize ──────────────────────────────────────────────────────

describe('Pagination — pageSize', () => {
  it('无 onPageSizeChange 时不渲染 select', () => {
    const { container } = render(
      <Pagination page={1} pageSize={20} totalRows={100} onPageChange={vi.fn()} />,
    )
    expect(container.querySelector('[data-pagination-pagesize]')).toBeNull()
  })

  it('有 onPageSizeChange 时渲染 select', () => {
    const { container } = render(
      <Pagination page={1} pageSize={20} totalRows={100} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />,
    )
    expect(container.querySelector('[data-pagination-pagesize]')).toBeTruthy()
  })

  it('选择 pageSize → onPageSizeChange 触发', () => {
    const onSizeChange = vi.fn()
    const { container } = render(
      <Pagination page={1} pageSize={20} totalRows={100} onPageChange={vi.fn()} onPageSizeChange={onSizeChange} />,
    )
    const select = container.querySelector('[data-pagination-pagesize]') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '50' } })
    expect(onSizeChange).toHaveBeenCalledWith(50)
  })

  it('自定义 pageSizeOptions 渲染', () => {
    render(
      <Pagination
        page={1} pageSize={10} totalRows={100}
        onPageChange={vi.fn()} onPageSizeChange={vi.fn()}
        pageSizeOptions={[10, 25, 100]}
      />,
    )
    expect(screen.getByText('25 条/页')).toBeTruthy()
  })
})

// ── ellipsis ──────────────────────────────────────────────────────

describe('Pagination — ellipsis', () => {
  it('中间页码时首末显示省略号（window=1）', () => {
    const { container } = render(
      <Pagination page={5} pageSize={20} totalRows={200} onPageChange={vi.fn()} windowSize={1} />,
    )
    const ellipses = container.querySelectorAll('[aria-hidden="true"]')
    expect(ellipses.length).toBeGreaterThanOrEqual(1)
  })
})

// ── aria ─────────────────────────────────────────────────────────

describe('Pagination — a11y', () => {
  it('当前页按钮有 aria-current=page', () => {
    render(<Pagination page={2} pageSize={20} totalRows={100} onPageChange={vi.fn()} />)
    const current = screen.getByLabelText('第 2 页')
    expect(current.getAttribute('aria-current')).toBe('page')
  })

  it('role=navigation + aria-label', () => {
    const { container } = render(
      <Pagination page={1} pageSize={20} totalRows={100} onPageChange={vi.fn()} />,
    )
    const nav = container.querySelector('[role="navigation"]')
    expect(nav?.getAttribute('aria-label')).toBeTruthy()
  })
})

// ── SSR ──────────────────────────────────────────────────────────

describe('Pagination — SSR 零 throw', () => {
  it('renderToString 不 throw', () => {
    expect(() =>
      renderToString(<Pagination page={1} pageSize={20} totalRows={100} onPageChange={vi.fn()} />),
    ).not.toThrow()
  })

  it('renderToString 输出包含页码按钮', () => {
    const html = renderToString(<Pagination page={2} pageSize={20} totalRows={100} onPageChange={vi.fn()} />)
    expect(html).toContain('上一页')
    expect(html).toContain('下一页')
  })
})
