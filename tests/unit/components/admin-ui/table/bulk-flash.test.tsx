/**
 * DataTable bulkActions + flashRowKeys 单测（CHG-DESIGN-02 Step 5/7）
 * 覆盖：
 *   - bulk bar 缺省/空 selection/空 ReactNode → 不渲染
 *   - 选中 ≥1 + bulkActions renderable → 渲染 + 计数 + clear button
 *   - clear button 调 onSelectionChange empty set
 *   - flashRowKeys 命中 → 行 data-flash="true"
 *   - flashRowKeys 不命中 → 无 data-flash
 *   - flashRowKeys 缺省 → 无 data-flash
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { DataTable } from '../../../../../packages/admin-ui/src/components/data-table/data-table'
import type {
  TableColumn,
  TableQuerySnapshot,
  TableSelectionState,
} from '../../../../../packages/admin-ui/src/components/data-table/types'

type Row = { id: string; name: string }
const ROWS: Row[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
  { id: '3', name: 'Gamma' },
]
const COLUMNS: TableColumn<Row>[] = [
  { id: 'name', header: 'Name', accessor: (r) => r.name },
]

function makeSnapshot(): TableQuerySnapshot {
  return {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: undefined, direction: 'asc' },
    filters: new Map(),
    columns: new Map([['name', { visible: true }]]),
    selection: { selectedKeys: new Set(), mode: 'page' },
  }
}

const baseProps = {
  rows: ROWS,
  columns: COLUMNS,
  rowKey: (r: Row) => r.id,
  mode: 'client' as const,
  query: makeSnapshot(),
  onQueryChange: () => {},
}

const SELECTED_1: TableSelectionState = { selectedKeys: new Set(['1']), mode: 'page' }
const SELECTED_2: TableSelectionState = { selectedKeys: new Set(['1', '2']), mode: 'page' }

describe('DataTable — bulkActions 渲染门控', () => {
  it('bulkActions 缺省 → 不渲染 bulk bar（即使 selection 非空）', () => {
    render(
      <DataTable<Row>
        {...baseProps}
        selection={SELECTED_1}
        onSelectionChange={() => {}}
      />,
    )
    expect(document.querySelector('[data-table-bulk]')).toBeNull()
  })

  it('bulkActions 提供 + selection 空 → 不渲染 bar', () => {
    render(
      <DataTable<Row>
        {...baseProps}
        selection={{ selectedKeys: new Set(), mode: 'page' }}
        onSelectionChange={() => {}}
        bulkActions={<button>批准</button>}
      />,
    )
    expect(document.querySelector('[data-table-bulk]')).toBeNull()
  })

  it('selection ≥1 + bulkActions renderable → 渲染 bar + 计数', () => {
    render(
      <DataTable<Row>
        {...baseProps}
        selection={SELECTED_2}
        onSelectionChange={() => {}}
        bulkActions={<button data-testid="approve-btn">批准</button>}
      />,
    )
    const bar = document.querySelector('[data-table-bulk]')
    expect(bar).toBeTruthy()
    // 计数
    const count = document.querySelector('[data-table-bulk-count]')
    expect(count?.textContent).toContain('2')
    // 操作区渲染消费方内容
    expect(screen.getByTestId('approve-btn')).toBeTruthy()
    // clear 按钮存在
    expect(document.querySelector('[data-table-bulk-clear]')).toBeTruthy()
  })

  it.each([
    ['null', null],
    ['false', false],
    ['空数组', [] as React.ReactNode],
    ['全空数组', [null, false] as React.ReactNode],
    ['空 Set', new Set() as unknown as React.ReactNode],
  ])('bulkActions=%s + selection 非空 → 不渲染 bar（合法但渲染为空 ReactNode）', (_label, value) => {
    render(
      <DataTable<Row>
        {...baseProps}
        selection={SELECTED_1}
        onSelectionChange={() => {}}
        bulkActions={value as React.ReactNode}
      />,
    )
    expect(document.querySelector('[data-table-bulk]')).toBeNull()
  })

  it('clear 按钮点击 → onSelectionChange 收到 empty set', () => {
    const onSelectionChange = vi.fn()
    render(
      <DataTable<Row>
        {...baseProps}
        selection={SELECTED_2}
        onSelectionChange={onSelectionChange}
        bulkActions={<button>批准</button>}
      />,
    )
    fireEvent.click(document.querySelector('[data-table-bulk-clear]') as HTMLElement)
    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    const arg = onSelectionChange.mock.calls[0]?.[0]
    expect(arg?.selectedKeys.size).toBe(0)
    expect(arg?.mode).toBe('page')
  })
})

describe('DataTable — flashRowKeys', () => {
  it('flashRowKeys 包含某 key → 该行 data-flash="true"', () => {
    const flashRowKeys = new Set(['2'])
    const { container } = render(
      <DataTable<Row>
        {...baseProps}
        flashRowKeys={flashRowKeys}
      />,
    )
    const rows = container.querySelectorAll('[role="row"]')
    // rows[0] 是表头 row；body 行从 rows[1] 开始
    const rowFlashAttrs = Array.from(rows).map((r) => r.getAttribute('data-flash'))
    // 找到 'Beta' 行验证（即第 2 个数据行）
    const betaRow = Array.from(container.querySelectorAll('[role="row"]')).find((r) =>
      r.textContent?.includes('Beta'),
    )
    expect(betaRow?.getAttribute('data-flash')).toBe('true')
    // 其他数据行没有 data-flash
    const alphaRow = Array.from(container.querySelectorAll('[role="row"]')).find((r) =>
      r.textContent?.includes('Alpha'),
    )
    expect(alphaRow?.getAttribute('data-flash')).toBeNull()
    // 用 rowFlashAttrs 验证至少有一行命中 'true'
    expect(rowFlashAttrs.some((v) => v === 'true')).toBe(true)
  })

  it('flashRowKeys 不命中任何 key → 所有数据行无 data-flash', () => {
    const flashRowKeys = new Set(['不存在'])
    const { container } = render(
      <DataTable<Row>
        {...baseProps}
        flashRowKeys={flashRowKeys}
      />,
    )
    const dataRows = Array.from(container.querySelectorAll('[role="row"]')).filter((r) =>
      ['Alpha', 'Beta', 'Gamma'].some((n) => r.textContent?.includes(n)),
    )
    dataRows.forEach((r) => expect(r.getAttribute('data-flash')).toBeNull())
  })

  it('flashRowKeys 缺省 → 行无 data-flash', () => {
    const { container } = render(<DataTable<Row> {...baseProps} />)
    const dataRows = Array.from(container.querySelectorAll('[role="row"]')).filter((r) =>
      ['Alpha', 'Beta'].some((n) => r.textContent?.includes(n)),
    )
    dataRows.forEach((r) => expect(r.getAttribute('data-flash')).toBeNull())
  })
})
