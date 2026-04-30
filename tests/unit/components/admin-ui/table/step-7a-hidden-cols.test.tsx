/**
 * DataTable 隐藏列 chip + HiddenColumnsMenu 单测（CHG-DESIGN-02 Step 7A）
 * 覆盖：
 *   - 无隐藏列 → chip 不渲染
 *   - 隐藏 N 列（非 pinned）→ chip 文案 "已隐藏 N 列"
 *   - chip click → popover 开启 (aria-expanded="true")
 *   - popover 列出所有列；勾选恢复隐藏列 → onQueryChange columns patch
 *   - pinned 列在 popover 中显示 disabled + "已锁定" 标签
 *   - toolbar.hideHiddenColumnsChip=true → 即使有隐藏列也不渲染 chip
 *   - column-visibility.ts 工具：setColumnVisibility / countHiddenColumns / isColumnVisible
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { DataTable } from '../../../../../packages/admin-ui/src/components/data-table/data-table'
import {
  setColumnVisibility,
  countHiddenColumns,
  isColumnVisible,
  getHidableColumns,
} from '../../../../../packages/admin-ui/src/components/data-table/column-visibility'
import type {
  TableColumn,
  TableQuerySnapshot,
  TableQueryPatch,
  ColumnPreference,
  ColumnDescriptor,
} from '../../../../../packages/admin-ui/src/components/data-table/types'

type Row = { id: string; name: string; type: string; year: number }
const ROWS: Row[] = [
  { id: '1', name: 'Alpha', type: 'movie', year: 2024 },
  { id: '2', name: 'Beta', type: 'series', year: 2023 },
]
const COLUMNS: TableColumn<Row>[] = [
  { id: 'name', header: '名称', accessor: (r) => r.name, pinned: true },
  { id: 'type', header: '类型', accessor: (r) => r.type },
  { id: 'year', header: '年份', accessor: (r) => r.year },
]

function snapshot(cols: ReadonlyMap<string, ColumnPreference>): TableQuerySnapshot {
  return {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: undefined, direction: 'asc' },
    filters: new Map(),
    columns: cols,
    selection: { selectedKeys: new Set(), mode: 'page' },
  }
}

const ALL_VISIBLE = new Map([
  ['name', { visible: true }],
  ['type', { visible: true }],
  ['year', { visible: true }],
])

const ONE_HIDDEN = new Map([
  ['name', { visible: true }],
  ['type', { visible: false }],
  ['year', { visible: true }],
])

const TWO_HIDDEN = new Map([
  ['name', { visible: true }],
  ['type', { visible: false }],
  ['year', { visible: false }],
])

describe('DataTable Step 7A — 隐藏列 chip + popover', () => {
  it('无隐藏列 → chip 不渲染', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot(ALL_VISIBLE)}
        onQueryChange={() => {}}
      />,
    )
    expect(screen.queryByTestId('hidden-columns-chip')).toBeNull()
  })

  it('隐藏 1 列 → chip 文案 "已隐藏 1 列"', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot(ONE_HIDDEN)}
        onQueryChange={() => {}}
      />,
    )
    const chip = screen.getByTestId('hidden-columns-chip')
    expect(chip.textContent).toContain('已隐藏')
    expect(chip.textContent).toContain('1')
  })

  it('隐藏 2 列 → chip 文案 "已隐藏 2 列"', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot(TWO_HIDDEN)}
        onQueryChange={() => {}}
      />,
    )
    const chip = screen.getByTestId('hidden-columns-chip')
    expect(chip.textContent).toContain('2')
  })

  it('chip click → popover 开启 + 列出所有列 + pinned 显示锁定 + 勾选恢复', () => {
    const onQueryChange = vi.fn<(p: TableQueryPatch) => void>()
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot(ONE_HIDDEN)}
        onQueryChange={onQueryChange}
      />,
    )
    const chip = screen.getByTestId('hidden-columns-chip')
    fireEvent.click(chip)
    expect(chip.getAttribute('aria-expanded')).toBe('true')
    // pinned 列显示锁定
    const nameItem = screen.getByTestId('hidden-columns-item-name')
    expect(nameItem.textContent).toContain('已锁定')
    expect(nameItem.hasAttribute('disabled')).toBe(true)
    // 勾选恢复隐藏列
    const typeItem = screen.getByTestId('hidden-columns-item-type')
    fireEvent.click(typeItem)
    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: expect.any(Map),
      }),
    )
    const patchedCols = onQueryChange.mock.calls[0][0].columns
    expect(patchedCols.get('type')).toEqual({ visible: true })
  })

  it('toolbar.hideHiddenColumnsChip=true → 不渲染 chip（即使有隐藏列）', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot(ONE_HIDDEN)}
        onQueryChange={() => {}}
        toolbar={{ hideHiddenColumnsChip: true }}
      />,
    )
    expect(screen.queryByTestId('hidden-columns-chip')).toBeNull()
  })
})

describe('column-visibility.ts 工具', () => {
  it('setColumnVisibility 返回新 Map，不变更原 Map', () => {
    const orig = ALL_VISIBLE
    const next = setColumnVisibility(orig, 'type', false)
    expect(orig.get('type')?.visible).toBe(true)
    expect(next.get('type')?.visible).toBe(false)
    expect(next).not.toBe(orig)
  })

  it('setColumnVisibility 保留 width', () => {
    const initial = new Map([['type', { visible: true, width: 200 }]])
    const next = setColumnVisibility(initial, 'type', false)
    expect(next.get('type')).toEqual({ visible: false, width: 200 })
  })

  it('isColumnVisible: pinned 恒可见', () => {
    const pinnedCol: ColumnDescriptor = { id: 'a', header: 'A', pinned: true }
    expect(isColumnVisible(pinnedCol, new Map([['a', { visible: false }]]))).toBe(true)
  })

  it('isColumnVisible: 未在 colMap 时取 defaultVisible（缺省 true）', () => {
    const a: ColumnDescriptor = { id: 'a', header: 'A' }
    const b: ColumnDescriptor = { id: 'b', header: 'B', defaultVisible: false }
    expect(isColumnVisible(a, new Map())).toBe(true)
    expect(isColumnVisible(b, new Map())).toBe(false)
  })

  it('countHiddenColumns: 不计 pinned', () => {
    expect(countHiddenColumns(COLUMNS, ALL_VISIBLE)).toBe(0)
    expect(countHiddenColumns(COLUMNS, ONE_HIDDEN)).toBe(1)
    expect(countHiddenColumns(COLUMNS, TWO_HIDDEN)).toBe(2)
  })

  it('getHidableColumns: 排除 pinned', () => {
    const hidable = getHidableColumns(COLUMNS)
    expect(hidable.map((c) => c.id)).toEqual(['type', 'year'])
  })
})
