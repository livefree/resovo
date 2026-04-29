/**
 * DataTable v2 单测（CHG-SN-2-13）
 * 覆盖：client mode（filter/sort/paginate）/ server mode 渲染 / 排序点击 / 选区 /
 *       loading/error/empty 状态 / SSR 零 throw / data-testid 传递
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { DataTable } from '../../../../../packages/admin-ui/src/components/data-table/data-table'
import type { TableColumn, TableQuerySnapshot, TableQueryPatch, TableSelectionState } from '../../../../../packages/admin-ui/src/components/data-table/types'

// ── test data ────────────────────────────────────────────────────

type Row = { id: string; name: string; score: number; active: boolean }

const ROWS: Row[] = [
  { id: '1', name: 'Alpha', score: 90, active: true },
  { id: '2', name: 'Beta', score: 70, active: false },
  { id: '3', name: 'Gamma', score: 80, active: true },
]

const COLUMNS: TableColumn<Row>[] = [
  { id: 'name', header: 'Name', accessor: (r) => r.name, enableSorting: true },
  { id: 'score', header: 'Score', accessor: (r) => r.score, enableSorting: true },
  { id: 'active', header: 'Active', accessor: (r) => r.active },
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

// ── client mode — basic render ───────────────────────────────────

describe('DataTable — client mode render', () => {
  it('渲染所有行', () => {
    const { container } = render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        data-testid="dt"
      />,
    )
    expect(container.querySelectorAll('[role="row"]').length).toBe(4) // 1 header + 3 body
  })

  it('data-testid 传递到根节点', () => {
    const { container } = render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        data-testid="my-table"
      />,
    )
    expect(container.querySelector('[data-testid="my-table"]')).toBeTruthy()
  })

  it('列头渲染正确', () => {
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
      />,
    )
    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('Score')).toBeTruthy()
  })
})

// ── client mode — sort ───────────────────────────────────────────

describe('DataTable — client mode sort', () => {
  it('client mode：sort asc 按升序渲染', () => {
    const { container } = render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ sort: { field: 'score', direction: 'asc' } })}
        onQueryChange={() => {}}
      />,
    )
    const cells = container.querySelectorAll('[role="cell"]')
    // score cells should be in ascending order: 70, 80, 90
    const scoreTexts = Array.from(cells)
      .map((el) => el.textContent)
      .filter((t) => ['70', '80', '90'].includes(t ?? ''))
    expect(scoreTexts).toEqual(['70', '80', '90'])
  })

  it('client mode：sort desc 按降序渲染', () => {
    const { container } = render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ sort: { field: 'score', direction: 'desc' } })}
        onQueryChange={() => {}}
      />,
    )
    const cells = container.querySelectorAll('[role="cell"]')
    const scoreTexts = Array.from(cells)
      .map((el) => el.textContent)
      .filter((t) => ['70', '80', '90'].includes(t ?? ''))
    expect(scoreTexts).toEqual(['90', '80', '70'])
  })

  it('点击可排序列头调用 onQueryChange with sort patch', () => {
    const patches: TableQueryPatch[] = []
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByText('Name'))
    expect(patches).toHaveLength(1)
    expect(patches[0].sort?.field).toBe('name')
    expect(patches[0].sort?.direction).toBe('asc')
  })

  it('再次点击同一列：asc → desc', () => {
    const patches: TableQueryPatch[] = []
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ sort: { field: 'name', direction: 'asc' } })}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByText('Name'))
    expect(patches[0].sort?.direction).toBe('desc')
  })

  it('desc 再次点击：清除 sort（field=undefined）', () => {
    const patches: TableQueryPatch[] = []
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ sort: { field: 'name', direction: 'desc' } })}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByText('Name'))
    expect(patches[0].sort?.field).toBeUndefined()
  })
})

// ── client mode — filter ─────────────────────────────────────────

describe('DataTable — client mode filter', () => {
  it('text filter 过滤行', () => {
    const { container } = render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ filters: new Map([['name', { kind: 'text', value: 'Alpha' }]]) })}
        onQueryChange={() => {}}
      />,
    )
    const rows = container.querySelectorAll('[role="rowgroup"]:last-child [role="row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Alpha')
  })

  it('enum filter 过滤多值', () => {
    const { container } = render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ filters: new Map([['name', { kind: 'enum', value: ['Alpha', 'Gamma'] }]]) })}
        onQueryChange={() => {}}
      />,
    )
    const rows = container.querySelectorAll('[role="rowgroup"]:last-child [role="row"]')
    expect(rows).toHaveLength(2)
  })
})

// ── client mode — pagination ─────────────────────────────────────

describe('DataTable — client mode pagination', () => {
  it('pageSize=2 时仅渲染 2 行', () => {
    const { container } = render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ pagination: { page: 1, pageSize: 2 } })}
        onQueryChange={() => {}}
      />,
    )
    const rows = container.querySelectorAll('[role="rowgroup"]:last-child [role="row"]')
    expect(rows).toHaveLength(2)
  })

  it('page=2 pageSize=2 渲染第 2 页', () => {
    const { container } = render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ pagination: { page: 2, pageSize: 2 } })}
        onQueryChange={() => {}}
      />,
    )
    const rows = container.querySelectorAll('[role="rowgroup"]:last-child [role="row"]')
    expect(rows).toHaveLength(1) // 3 rows total, page 2 has 1
  })
})

// ── server mode ──────────────────────────────────────────────────

describe('DataTable — server mode', () => {
  it('server mode：直接渲染传入的 rows（不做客户端 sort）', () => {
    const sortedByScore = [...ROWS].sort((a, b) => a.score - b.score)
    const { container } = render(
      <DataTable
        rows={sortedByScore}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="server"
        totalRows={100}
        query={makeSnapshot({ sort: { field: 'score', direction: 'asc' } })}
        onQueryChange={() => {}}
      />,
    )
    const rows = container.querySelectorAll('[role="rowgroup"]:last-child [role="row"]')
    expect(rows).toHaveLength(3)
  })
})

// ── loading / error / empty ──────────────────────────────────────

describe('DataTable — loading / error / empty states', () => {
  it('loading=true 显示加载提示', () => {
    render(
      <DataTable
        rows={[]}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        loading
      />,
    )
    expect(screen.getByText('加载中…')).toBeTruthy()
  })

  it('error 显示错误消息', () => {
    render(
      <DataTable
        rows={[]}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        error={new Error('请求失败')}
      />,
    )
    expect(screen.getByText('请求失败')).toBeTruthy()
  })

  it('rows 为空时显示默认 emptyState', () => {
    render(
      <DataTable
        rows={[]}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
      />,
    )
    expect(screen.getByText('暂无数据')).toBeTruthy()
  })

  it('自定义 emptyState', () => {
    render(
      <DataTable
        rows={[]}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        emptyState={<span>自定义空态</span>}
      />,
    )
    expect(screen.getByText('自定义空态')).toBeTruthy()
  })
})

// ── selection ────────────────────────────────────────────────────

describe('DataTable — selection', () => {
  it('selection undefined 时不渲染 checkbox 列', () => {
    const { container } = render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
      />,
    )
    expect(container.querySelector('input[type="checkbox"]')).toBeNull()
  })

  it('selection 提供时渲染 checkbox', () => {
    const sel: TableSelectionState = { selectedKeys: new Set(), mode: 'page' }
    const { container } = render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        selection={sel}
        onSelectionChange={() => {}}
      />,
    )
    // header checkbox + 3 row checkboxes
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(4)
  })

  it('点击行 checkbox 触发 onSelectionChange', () => {
    const changes: TableSelectionState[] = []
    const sel: TableSelectionState = { selectedKeys: new Set(), mode: 'page' }
    const { container } = render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        selection={sel}
        onSelectionChange={(s) => changes.push(s)}
      />,
    )
    const rowCheckboxes = container.querySelectorAll('input[type="checkbox"]')
    fireEvent.click(rowCheckboxes[1]) // first row checkbox (index 0 is header)
    expect(changes).toHaveLength(1)
    expect(changes[0].selectedKeys.has('1')).toBe(true)
  })
})

// ── column visibility ────────────────────────────────────────────

describe('DataTable — column visibility', () => {
  it('visible=false 的列不渲染', () => {
    const colMap = new Map([
      ['name', { visible: true }],
      ['score', { visible: false }],
      ['active', { visible: true }],
    ])
    const { container } = render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ columns: colMap })}
        onQueryChange={() => {}}
      />,
    )
    expect(screen.queryByText('Score')).toBeNull()
    const cells = container.querySelectorAll('[role="cell"]')
    // 3 rows × 2 visible columns = 6 cells
    expect(cells).toHaveLength(6)
  })

  it('pinned=true 的列即便 visible=false 也渲染', () => {
    const pinnedColumns: TableColumn<Row>[] = [
      { id: 'name', header: 'Name', accessor: (r) => r.name, pinned: true },
      { id: 'score', header: 'Score', accessor: (r) => r.score },
    ]
    const colMap = new Map([
      ['name', { visible: false }],
      ['score', { visible: true }],
    ])
    render(
      <DataTable
        rows={ROWS}
        columns={pinnedColumns}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ columns: colMap })}
        onQueryChange={() => {}}
      />,
    )
    expect(screen.getByText('Name')).toBeTruthy()
  })
})

// ── SSR 零 throw ─────────────────────────────────────────────────

describe('DataTable — SSR 零 throw', () => {
  it('renderToString 不 throw（loading）', () => {
    expect(() =>
      renderToString(
        <DataTable
          rows={[]}
          columns={COLUMNS}
          rowKey={(r) => r.id}
          mode="client"
          query={makeSnapshot()}
          onQueryChange={() => {}}
          loading
        />,
      ),
    ).not.toThrow()
  })

  it('renderToString 不 throw（有 rows）', () => {
    expect(() =>
      renderToString(
        <DataTable
          rows={ROWS}
          columns={COLUMNS}
          rowKey={(r) => r.id}
          mode="server"
          query={makeSnapshot()}
          onQueryChange={() => {}}
        />,
      ),
    ).not.toThrow()
  })

  it('renderToString 输出包含列头', () => {
    const html = renderToString(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
      />,
    )
    expect(html).toContain('Name')
    expect(html).toContain('Score')
  })
})
