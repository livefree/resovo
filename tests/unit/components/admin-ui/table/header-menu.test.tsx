/**
 * HeaderMenu 单测（CHG-DESIGN-02 Step 3/7）
 * 覆盖：enableHeaderMenu=false 默认行为（点击表头排序）/ true 弹出 popover /
 *       popover 内升降序 / 清除排序 / 隐藏列 / pinned 列不可隐藏 / ESC 关闭 /
 *       filterContent 渲染。
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { DataTable } from '../../../../../packages/admin-ui/src/components/data-table/data-table'
import type { TableColumn, TableQuerySnapshot, TableQueryPatch } from '../../../../../packages/admin-ui/src/components/data-table/types'

type Row = { id: string; name: string; score: number }

const ROWS: Row[] = [
  { id: '1', name: 'Alpha', score: 90 },
  { id: '2', name: 'Beta', score: 70 },
]

const COLUMNS: TableColumn<Row>[] = [
  { id: 'name', header: 'Name', accessor: (r) => r.name, enableSorting: true },
  { id: 'score', header: 'Score', accessor: (r) => r.score, enableSorting: true },
  { id: 'pinned', header: 'Pinned', accessor: () => '', pinned: true },
]

function makeSnapshot(overrides: Partial<TableQuerySnapshot> = {}): TableQuerySnapshot {
  return {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: undefined, direction: 'asc' },
    filters: new Map(),
    columns: new Map(COLUMNS.map((c) => [c.id, { visible: true }])),
    selection: { selectedKeys: new Set(), mode: 'page' },
    ...overrides,
  }
}

describe('DataTable — enableHeaderMenu=false（默认）', () => {
  it('点击表头直接触发排序（不弹出 popover）', () => {
    const onQueryChange = vi.fn<[TableQueryPatch], void>()
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={onQueryChange}
      />,
    )
    const nameHeader = screen.getByRole('columnheader', { name: /Name/ })
    fireEvent.click(nameHeader)
    expect(onQueryChange).toHaveBeenCalledWith({ sort: { field: 'name', direction: 'asc' } })
    expect(document.querySelector('[data-header-menu]')).toBeNull()
  })
})

describe('DataTable — enableHeaderMenu=true 弹出 popover', () => {
  it('点击表头打开 menu，包含升序 / 降序 / 隐藏此列', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        enableHeaderMenu
      />,
    )
    const nameHeader = screen.getByRole('columnheader', { name: /Name/ })
    fireEvent.click(nameHeader)
    const menu = document.querySelector('[data-header-menu]')
    expect(menu).toBeTruthy()
    expect(screen.getByText('升序')).toBeTruthy()
    expect(screen.getByText('降序')).toBeTruthy()
    expect(screen.getByText('隐藏此列')).toBeTruthy()
  })

  it('升序按钮调用 onQueryChange + 关闭 menu', () => {
    const onQueryChange = vi.fn<[TableQueryPatch], void>()
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={onQueryChange}
        enableHeaderMenu
      />,
    )
    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }))
    fireEvent.click(screen.getByText('升序'))
    expect(onQueryChange).toHaveBeenCalledWith({ sort: { field: 'name', direction: 'asc' } })
    expect(document.querySelector('[data-header-menu]')).toBeNull()
  })

  it('已排序时显示"清除排序"，点击调用 onQueryChange 清除', () => {
    const onQueryChange = vi.fn<[TableQueryPatch], void>()
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ sort: { field: 'name', direction: 'asc' } })}
        onQueryChange={onQueryChange}
        enableHeaderMenu
      />,
    )
    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }))
    const clearBtn = screen.getByText('清除排序')
    expect(clearBtn).toBeTruthy()
    fireEvent.click(clearBtn)
    expect(onQueryChange).toHaveBeenCalledWith({ sort: { field: undefined, direction: 'asc' } })
  })

  it('隐藏此列：在 columns map 写入 visible: false', () => {
    const onQueryChange = vi.fn<[TableQueryPatch], void>()
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={onQueryChange}
        enableHeaderMenu
      />,
    )
    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }))
    fireEvent.click(screen.getByText('隐藏此列'))
    expect(onQueryChange).toHaveBeenCalledTimes(1)
    const patch = onQueryChange.mock.calls[0]?.[0]
    expect(patch?.columns).toBeTruthy()
    expect(patch?.columns?.get('name')?.visible).toBe(false)
  })

  it('pinned 列不显示"隐藏此列"按钮', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        enableHeaderMenu
      />,
    )
    fireEvent.click(screen.getByRole('columnheader', { name: /Pinned/ }))
    expect(document.querySelector('[data-header-menu]')).toBeTruthy()
    expect(screen.queryByText('隐藏此列')).toBeNull()
  })

  it('ESC 关闭 menu', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        enableHeaderMenu
      />,
    )
    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }))
    expect(document.querySelector('[data-header-menu]')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[data-header-menu]')).toBeNull()
  })

  it('column.columnMenu.filterContent 提供时 popover 内渲染', () => {
    const cols: TableColumn<Row>[] = [
      {
        id: 'name',
        header: 'Name',
        accessor: (r) => r.name,
        enableSorting: true,
        columnMenu: { filterContent: <div data-testid="filter-slot">过滤插槽</div> },
      },
    ]
    const snapshot = makeSnapshot({
      columns: new Map(cols.map((c) => [c.id, { visible: true }])),
    })
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={cols}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot}
        onQueryChange={() => {}}
        enableHeaderMenu
      />,
    )
    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }))
    expect(screen.getByTestId('filter-slot')).toBeTruthy()
  })
})
