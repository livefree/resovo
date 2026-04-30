/**
 * DataTable filter chips slot + 6 种 FilterValue 默认 formatter 单测（CHG-DESIGN-02 Step 7A）
 * 覆盖：
 *   - 无 filters → 不渲染 chips 容器
 *   - 6 种 FilterValue.kind 默认 formatter 文案（text / number / bool / enum / range / date-range）
 *   - column.renderFilterChip 完全接管（返回 null 跳过；返回 ReactNode 替换默认）
 *   - chip × 调 onQueryChange({ filters: nextMap-without-this-col })
 *   - toolbar.hideFilterChips=true → 不渲染 chips（即使有 active filter）
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { DataTable } from '../../../../../packages/admin-ui/src/components/data-table/data-table'
import { formatFilterValue } from '../../../../../packages/admin-ui/src/components/data-table/filter-chips'
import type {
  TableColumn,
  TableQuerySnapshot,
  TableQueryPatch,
  FilterValue,
} from '../../../../../packages/admin-ui/src/components/data-table/types'

type Row = { id: string; name: string; year: number }
const ROWS: Row[] = [{ id: '1', name: 'Alpha', year: 2024 }]
const COLUMNS: TableColumn<Row>[] = [
  { id: 'name', header: '名称', accessor: (r) => r.name },
  { id: 'year', header: '年份', accessor: (r) => r.year },
]

function snapshot(filters: ReadonlyMap<string, FilterValue>): TableQuerySnapshot {
  return {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: undefined, direction: 'asc' },
    filters,
    columns: new Map([['name', { visible: true }], ['year', { visible: true }]]),
    selection: { selectedKeys: new Set(), mode: 'page' },
  }
}

describe('DataTable Step 7A — filter chips', () => {
  it('无 filters → 不渲染容器', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot(new Map())}
        onQueryChange={() => {}}
      />,
    )
    expect(document.querySelector('[data-table-filter-chips]')).toBeNull()
  })

  it('单 active filter → 渲染容器 + label/value 拼接', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot(new Map([['name', { kind: 'text', value: 'alp' }]]))}
        onQueryChange={() => {}}
      />,
    )
    expect(document.querySelector('[data-table-filter-chips]')).not.toBeNull()
    const chip = screen.getByTestId('filter-chip-name')
    expect(chip.textContent).toContain('名称')
    expect(chip.textContent).toContain('alp')
  })

  it('chip × → 调 onQueryChange 删除该列 filter', () => {
    const onQueryChange = vi.fn<(p: TableQueryPatch) => void>()
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot(new Map<string, FilterValue>([
          ['name', { kind: 'text', value: 'a' }],
          ['year', { kind: 'number', value: 2024 }],
        ]))}
        onQueryChange={onQueryChange}
      />,
    )
    const clearBtn = screen.getByTestId('filter-chip-name')
      .querySelector('[data-table-filter-chip-clear]') as HTMLButtonElement
    fireEvent.click(clearBtn)
    const patch = onQueryChange.mock.calls[0][0]
    expect(patch.filters?.has('name')).toBe(false)
    expect(patch.filters?.has('year')).toBe(true)
  })

  it('column.renderFilterChip 完全接管（返回 ReactNode 替换默认）', () => {
    const customCols: TableColumn<Row>[] = [
      {
        id: 'name',
        header: '名称',
        accessor: (r) => r.name,
        renderFilterChip: (ctx) => (
          <span data-testid="custom-chip">CUSTOM:{ctx.column.id}:{(ctx.filter as { kind: 'text'; value: string }).value}</span>
        ),
      },
    ]
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={customCols}
        rowKey={(r) => r.id}
        mode="client"
        query={{
          ...snapshot(new Map([['name', { kind: 'text', value: 'XX' }]])),
          columns: new Map([['name', { visible: true }]]),
        }}
        onQueryChange={() => {}}
      />,
    )
    expect(screen.getByTestId('custom-chip').textContent).toBe('CUSTOM:name:XX')
  })

  it('column.renderFilterChip 返回 null → 跳过该 chip', () => {
    const customCols: TableColumn<Row>[] = [
      {
        id: 'name',
        header: '名称',
        accessor: (r) => r.name,
        renderFilterChip: () => null,
      },
    ]
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={customCols}
        rowKey={(r) => r.id}
        mode="client"
        query={{
          ...snapshot(new Map([['name', { kind: 'text', value: 'XX' }]])),
          columns: new Map([['name', { visible: true }]]),
        }}
        onQueryChange={() => {}}
      />,
    )
    expect(document.querySelector('[data-table-filter-chips]')).toBeNull()
  })

  it('toolbar.hideFilterChips=true → 不渲染（即使有 active filter）', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot(new Map([['name', { kind: 'text', value: 'a' }]]))}
        onQueryChange={() => {}}
        toolbar={{ hideFilterChips: true }}
      />,
    )
    expect(document.querySelector('[data-table-filter-chips]')).toBeNull()
  })
})

describe('formatFilterValue — 6 种 FilterValue.kind 默认 formatter', () => {
  it('text', () => {
    expect(formatFilterValue({ kind: 'text', value: 'hello' })).toBe('hello')
  })

  it('number', () => {
    expect(formatFilterValue({ kind: 'number', value: 42 })).toBe('42')
  })

  it('bool', () => {
    expect(formatFilterValue({ kind: 'bool', value: true })).toBe('是')
    expect(formatFilterValue({ kind: 'bool', value: false })).toBe('否')
  })

  it('enum: ≤3 项全列', () => {
    expect(formatFilterValue({ kind: 'enum', value: ['a', 'b', 'c'] })).toBe('a, b, c')
    expect(formatFilterValue({ kind: 'enum', value: [] })).toBe('（空）')
  })

  it('enum: >3 项截断 + "及 N 项"', () => {
    expect(formatFilterValue({ kind: 'enum', value: ['a', 'b', 'c', 'd', 'e'] })).toBe('a, b, c…及 2 项')
  })

  it('range: 包含 ±∞ 占位', () => {
    expect(formatFilterValue({ kind: 'range', min: 10, max: 20 })).toBe('10 – 20')
    expect(formatFilterValue({ kind: 'range', min: 10 })).toBe('10 – +∞')
    expect(formatFilterValue({ kind: 'range', max: 20 })).toBe('−∞ – 20')
    expect(formatFilterValue({ kind: 'range' })).toBe('−∞ – +∞')
  })

  it('date-range: 用 ~ 分隔 + * 占位', () => {
    expect(formatFilterValue({ kind: 'date-range', from: '2026-01-01', to: '2026-12-31' }))
      .toBe('2026-01-01 ~ 2026-12-31')
    expect(formatFilterValue({ kind: 'date-range', from: '2026-01-01' })).toBe('2026-01-01 ~ *')
    expect(formatFilterValue({ kind: 'date-range', to: '2026-12-31' })).toBe('* ~ 2026-12-31')
  })

  it('禁止 raw String(filter) 输出 [object Object]', () => {
    // enum / range / date-range 是对象，确保 formatter 都不会把它们 stringify
    expect(formatFilterValue({ kind: 'enum', value: ['a'] })).not.toContain('[object')
    expect(formatFilterValue({ kind: 'range', min: 1, max: 2 })).not.toContain('[object')
    expect(formatFilterValue({ kind: 'date-range', from: 'x' })).not.toContain('[object')
  })
})
