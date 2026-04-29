/**
 * FilterChip + FilterChipBar 单测（CHG-SN-2-14）
 * 覆盖：渲染 label:value / onClear 触发 / FilterChipBar 批量 / onClearAll / 空列表不渲染 / SSR
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { FilterChip, FilterChipBar } from '../../../../../packages/admin-ui/src/components/data-table/filter-chip'
import type { FilterChipProps } from '../../../../../packages/admin-ui/src/components/data-table/filter-chip'

const CHIP: FilterChipProps = { id: 'status', label: 'Status', value: 'approved', onClear: vi.fn() }

// ── FilterChip ───────────────────────────────────────────────────

describe('FilterChip — 渲染', () => {
  it('显示 label 和 value', () => {
    render(<FilterChip {...CHIP} />)
    expect(screen.getByText('Status:')).toBeTruthy()
    expect(screen.getByText('approved')).toBeTruthy()
  })

  it('有 data-filter-id 属性', () => {
    const { container } = render(<FilterChip {...CHIP} />)
    expect(container.querySelector('[data-filter-id="status"]')).toBeTruthy()
  })

  it('aria-label 包含 label 和 value', () => {
    const { container } = render(<FilterChip {...CHIP} />)
    const chip = container.querySelector('[data-filter-chip]')
    expect(chip?.getAttribute('aria-label')).toContain('Status')
    expect(chip?.getAttribute('aria-label')).toContain('approved')
  })
})

describe('FilterChip — onClear', () => {
  it('点击 × 触发 onClear', () => {
    const onClear = vi.fn()
    render(<FilterChip id="status" label="Status" value="approved" onClear={onClear} />)
    fireEvent.click(screen.getByRole('button', { name: /清除筛选/ }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('清除按钮有 aria-label', () => {
    render(<FilterChip {...CHIP} />)
    const btn = screen.getByRole('button', { name: /清除筛选 Status/ })
    expect(btn).toBeTruthy()
  })
})

// ── FilterChipBar ────────────────────────────────────────────────

describe('FilterChipBar — 渲染', () => {
  it('渲染所有 chip', () => {
    const items: FilterChipProps[] = [
      { id: 'status', label: 'Status', value: 'approved', onClear: vi.fn() },
      { id: 'type', label: 'Type', value: 'video', onClear: vi.fn() },
    ]
    render(<FilterChipBar items={items} />)
    expect(screen.getByText('approved')).toBeTruthy()
    expect(screen.getByText('video')).toBeTruthy()
  })

  it('空列表时不渲染（返回 null）', () => {
    const { container } = render(<FilterChipBar items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('有 onClearAll 时渲染"清除全部"按钮', () => {
    const items: FilterChipProps[] = [
      { id: 'status', label: 'Status', value: 'approved', onClear: vi.fn() },
    ]
    render(<FilterChipBar items={items} onClearAll={vi.fn()} />)
    expect(screen.getByText('清除全部')).toBeTruthy()
  })

  it('无 onClearAll 时不渲染"清除全部"按钮', () => {
    const items: FilterChipProps[] = [
      { id: 'status', label: 'Status', value: 'approved', onClear: vi.fn() },
    ]
    render(<FilterChipBar items={items} />)
    expect(screen.queryByText('清除全部')).toBeNull()
  })
})

describe('FilterChipBar — onClearAll', () => {
  it('点击"清除全部"触发 onClearAll', () => {
    const onClearAll = vi.fn()
    const items: FilterChipProps[] = [
      { id: 'status', label: 'Status', value: 'approved', onClear: vi.fn() },
    ]
    render(<FilterChipBar items={items} onClearAll={onClearAll} />)
    fireEvent.click(screen.getByText('清除全部'))
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })

  it('每个 chip 的 onClear 独立触发', () => {
    const onClear1 = vi.fn()
    const onClear2 = vi.fn()
    const items: FilterChipProps[] = [
      { id: 'status', label: 'Status', value: 'approved', onClear: onClear1 },
      { id: 'type', label: 'Type', value: 'video', onClear: onClear2 },
    ]
    render(<FilterChipBar items={items} />)
    const btns = screen.getAllByRole('button', { name: /清除筛选/ })
    fireEvent.click(btns[0])
    expect(onClear1).toHaveBeenCalledTimes(1)
    expect(onClear2).not.toHaveBeenCalled()
  })
})

// ── SSR ──────────────────────────────────────────────────────────

describe('FilterChip / FilterChipBar — SSR', () => {
  it('FilterChip renderToString 不 throw', () => {
    expect(() => renderToString(<FilterChip {...CHIP} />)).not.toThrow()
  })

  it('FilterChipBar renderToString 不 throw', () => {
    const items: FilterChipProps[] = [
      { id: 'status', label: 'Status', value: 'approved', onClear: vi.fn() },
    ]
    expect(() => renderToString(<FilterChipBar items={items} onClearAll={vi.fn()} />)).not.toThrow()
  })

  it('FilterChipBar 空列表 renderToString 输出空字符串', () => {
    const html = renderToString(<FilterChipBar items={[]} />)
    expect(html).toBe('')
  })
})
