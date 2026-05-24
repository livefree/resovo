/**
 * data-table-auto-filter.test.tsx — ADR-150 阶段 2 / EP-1 Step 3 单测
 *
 * 范围：18 关键用例（Opus 子代理设计 §6 #9-#35 的关键子集）
 * 三段结构 4 / enum 5 / text 2 / number 2 / date 2 / 取消恢复 3
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { DataTableAutoFilter } from '../../../../../packages/admin-ui/src/components/data-table/data-table-auto-filter'
import type { FilterableColumn, FilterValue, TableSortState } from '../../../../../packages/admin-ui/src/components/data-table/types'

type R = { name: string; count: number }

const NO_SORT: TableSortState = { field: undefined, direction: 'asc' }
const ROWS: readonly R[] = [
  { name: 'alpha', count: 1 },
  { name: 'beta', count: 2 },
  { name: 'gamma', count: 3 },
  { name: 'alpha', count: 4 },
]

const enumCol = (extra: Partial<FilterableColumn<R>> = {}): FilterableColumn<R> => ({
  id: 'name',
  header: '名称',
  accessor: (r) => r.name,
  enableSorting: true,
  filterable: true,
  filterFieldName: 'name',
  filterKind: 'enum',
  ...extra,
})

const textCol: FilterableColumn<R> = {
  id: 'desc',
  header: '描述',
  accessor: (r) => r.name,
  filterable: true,
  filterFieldName: 'desc',
  filterKind: 'text',
}
const numCol: FilterableColumn<R> = {
  id: 'cnt',
  header: '计数',
  accessor: (r) => r.count,
  filterable: true,
  filterFieldName: 'cnt',
  filterKind: 'number',
}
const dateCol: FilterableColumn<R> = {
  id: 'dt',
  header: '日期',
  accessor: (r) => r.name,
  filterable: true,
  filterFieldName: 'dt',
  filterKind: 'date',
}

const baseProps = {
  rows: ROWS,
  currentFilter: undefined,
  onApply: () => {},
  onCancel: () => {},
  currentSort: NO_SORT,
  onSort: () => {},
  onClearSort: () => {},
}

describe('DataTableAutoFilter (ADR-150 阶段 2)', () => {
  // 三段结构 4
  it('#1 enableSorting=true → 段 1 排序渲染', () => {
    render(<DataTableAutoFilter column={enumCol()} {...baseProps} />)
    expect(screen.getByTestId('dt-autofilter-name-sort-asc')).toBeTruthy()
    expect(screen.getByTestId('dt-autofilter-name-sort-desc')).toBeTruthy()
  })

  // sub 1 HOTFIX（2026-05-24）：排序段始终渲染；enableSorting !== true 时按钮 disabled + tooltip
  it('#2 enableSorting=false → 段 1 渲染但按钮 disabled + tooltip', () => {
    render(<DataTableAutoFilter column={enumCol({ enableSorting: false })} {...baseProps} />)
    const asc = screen.getByTestId('dt-autofilter-name-sort-asc') as HTMLButtonElement
    const desc = screen.getByTestId('dt-autofilter-name-sort-desc') as HTMLButtonElement
    expect(asc).toBeTruthy()
    expect(desc).toBeTruthy()
    expect(asc.disabled).toBe(true)
    expect(desc.disabled).toBe(true)
    expect(asc.getAttribute('title')).toBe('本列不支持排序')
    expect(desc.getAttribute('title')).toBe('本列不支持排序')
    expect(asc.getAttribute('aria-disabled')).toBe('true')
  })

  // sub 1 HOTFIX（2026-05-24）：kind radio section 已删除（v2/v3 灰化噪音 + 只有按值可用）
  it('#3 过滤方式 kind radio section 已删除', () => {
    render(<DataTableAutoFilter column={enumCol()} {...baseProps} />)
    expect(screen.queryByText('按条件过滤')).toBeNull()
    expect(screen.queryByText('按颜色过滤')).toBeNull()
    expect(screen.queryByText('按值过滤')).toBeNull()
  })

  it('#4 onHide 缺省 → 段 4 不渲染 / 提供 → 渲染', () => {
    const { rerender } = render(<DataTableAutoFilter column={enumCol()} {...baseProps} />)
    expect(screen.queryByTestId('dt-autofilter-name-hide')).toBeNull()
    rerender(<DataTableAutoFilter column={enumCol()} {...baseProps} onHide={() => {}} />)
    expect(screen.getByTestId('dt-autofilter-name-hide')).toBeTruthy()
  })

  // enum 5
  it('#5 filterOptions 静态 → 渲染列表无 fetcher 调用', () => {
    const fetcher = vi.fn()
    render(<DataTableAutoFilter
      column={enumCol({ filterOptions: [{ value: 'a' }, { value: 'b' }] })}
      {...baseProps}
      distinctFetcher={fetcher}
    />)
    expect(screen.getByTestId('dt-autofilter-name-opt-a')).toBeTruthy()
    expect(screen.getByTestId('dt-autofilter-name-opt-b')).toBeTruthy()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('#6 缺 filterOptions + 有 distinctFetcher + filterDistinctTable → 调 fetcher', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ value: 'fetched' }])
    render(<DataTableAutoFilter
      column={enumCol({ filterDistinctEndpoint: '/x', filterDistinctTable: 't' })}
      {...baseProps}
      distinctFetcher={fetcher}
    />)
    expect(fetcher).toHaveBeenCalledWith('t', 'name', undefined)
  })

  it('#7 enum 页内 distinct 回退 → 从 rows accessor 派生', () => {
    render(<DataTableAutoFilter column={enumCol()} {...baseProps} />)
    expect(screen.getByTestId('dt-autofilter-name-opt-alpha')).toBeTruthy()
    expect(screen.getByTestId('dt-autofilter-name-opt-beta')).toBeTruthy()
    expect(screen.getByTestId('dt-autofilter-name-opt-gamma')).toBeTruthy()
  })

  it('#8 toggle checkbox + 应用 → onApply 传 enum value', () => {
    const onApply = vi.fn()
    render(<DataTableAutoFilter column={enumCol()} {...baseProps} onApply={onApply} />)
    fireEvent.click(screen.getByTestId('dt-autofilter-name-opt-alpha'))
    fireEvent.click(screen.getByTestId('dt-autofilter-name-apply'))
    expect(onApply).toHaveBeenCalledWith({ kind: 'enum', value: ['alpha'] })
  })

  it('#9 搜索框输入 → 列表过滤', () => {
    render(<DataTableAutoFilter column={enumCol()} {...baseProps} />)
    fireEvent.change(screen.getByTestId('dt-autofilter-name-search'), { target: { value: 'alp' } })
    expect(screen.getByTestId('dt-autofilter-name-opt-alpha')).toBeTruthy()
    expect(screen.queryByTestId('dt-autofilter-name-opt-beta')).toBeNull()
  })

  // text 2
  it('#10 text 输入 → pending text / 应用提交', () => {
    const onApply = vi.fn()
    render(<DataTableAutoFilter column={textCol} {...baseProps} onApply={onApply} />)
    fireEvent.change(screen.getByTestId('dt-autofilter-desc-text-input'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByTestId('dt-autofilter-desc-apply'))
    expect(onApply).toHaveBeenCalledWith({ kind: 'text', value: 'hello' })
  })

  it('#11 text 空值 → pending undefined', () => {
    const onApply = vi.fn()
    render(<DataTableAutoFilter column={textCol} {...baseProps} currentFilter={{ kind: 'text', value: 'x' }} onApply={onApply} />)
    fireEvent.change(screen.getByTestId('dt-autofilter-desc-text-input'), { target: { value: '' } })
    fireEvent.click(screen.getByTestId('dt-autofilter-desc-apply'))
    expect(onApply).toHaveBeenCalledWith(undefined)
  })

  // number 2
  it('#12 number range min+max → onApply range', () => {
    const onApply = vi.fn()
    render(<DataTableAutoFilter column={numCol} {...baseProps} onApply={onApply} />)
    fireEvent.change(screen.getByTestId('dt-autofilter-cnt-number-min'), { target: { value: '1' } })
    fireEvent.change(screen.getByTestId('dt-autofilter-cnt-number-max'), { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('dt-autofilter-cnt-apply'))
    expect(onApply).toHaveBeenCalledWith({ kind: 'range', min: 1, max: 10 })
  })

  it('#13 number 仅 min → range min only', () => {
    const onApply = vi.fn()
    render(<DataTableAutoFilter column={numCol} {...baseProps} onApply={onApply} />)
    fireEvent.change(screen.getByTestId('dt-autofilter-cnt-number-min'), { target: { value: '5' } })
    fireEvent.click(screen.getByTestId('dt-autofilter-cnt-apply'))
    expect(onApply).toHaveBeenCalledWith({ kind: 'range', min: 5, max: undefined })
  })

  // date 2
  it('#14 date range from+to → onApply date-range', () => {
    const onApply = vi.fn()
    render(<DataTableAutoFilter column={dateCol} {...baseProps} onApply={onApply} />)
    fireEvent.change(screen.getByTestId('dt-autofilter-dt-date-from'), { target: { value: '2026-05-01' } })
    fireEvent.change(screen.getByTestId('dt-autofilter-dt-date-to'), { target: { value: '2026-05-24' } })
    fireEvent.click(screen.getByTestId('dt-autofilter-dt-apply'))
    expect(onApply).toHaveBeenCalledWith({ kind: 'date-range', from: '2026-05-01', to: '2026-05-24' })
  })

  it('#15 date 仅 from → date-range from only', () => {
    const onApply = vi.fn()
    render(<DataTableAutoFilter column={dateCol} {...baseProps} onApply={onApply} />)
    fireEvent.change(screen.getByTestId('dt-autofilter-dt-date-from'), { target: { value: '2026-01-01' } })
    fireEvent.click(screen.getByTestId('dt-autofilter-dt-apply'))
    expect(onApply).toHaveBeenCalledWith({ kind: 'date-range', from: '2026-01-01', to: undefined })
  })

  // 取消 / 应用 / 排序立即提交
  it('#16 取消按钮 → onCancel / 不调 onApply', () => {
    const onApply = vi.fn()
    const onCancel = vi.fn()
    render(<DataTableAutoFilter column={textCol} {...baseProps} onApply={onApply} onCancel={onCancel} />)
    fireEvent.change(screen.getByTestId('dt-autofilter-desc-text-input'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('dt-autofilter-desc-cancel'))
    expect(onCancel).toHaveBeenCalled()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('#17 段 1 升序 click → onSort 立即触发（不关 popover）', () => {
    const onSort = vi.fn()
    render(<DataTableAutoFilter column={enumCol()} {...baseProps} onSort={onSort} />)
    fireEvent.click(screen.getByTestId('dt-autofilter-name-sort-asc'))
    expect(onSort).toHaveBeenCalledWith('name', 'asc')
  })

  it('#18 currentFilter 初值 → pending 同步 / 已选 checkbox checked', () => {
    render(<DataTableAutoFilter
      column={enumCol()}
      {...baseProps}
      currentFilter={{ kind: 'enum', value: ['alpha'] }}
    />)
    const checkbox = screen.getByTestId('dt-autofilter-name-opt-alpha') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('#19 filterable+filterContent 同传 dev warn / runtime narrow OK', () => {
    // 类型层不强制（aspect of runtime warn / consumers may have legacy filterContent）
    // 本测试仅验证 filterable: true 列正常渲染 popover（不抛错）
    render(<DataTableAutoFilter column={enumCol({ filterOptions: [{ value: 'a' }] })} {...baseProps} />)
    expect(screen.getByTestId('dt-autofilter-name')).toBeTruthy()
  })

  it('#20 清空按钮 → onApply(undefined) + pending 清空', () => {
    const onApply = vi.fn()
    render(<DataTableAutoFilter
      column={enumCol()}
      {...baseProps}
      currentFilter={{ kind: 'enum', value: ['alpha'] }}
      onApply={onApply}
    />)
    fireEvent.click(screen.getByTestId('dt-autofilter-name-clear'))
    expect(onApply).toHaveBeenCalledWith(undefined)
  })
})
