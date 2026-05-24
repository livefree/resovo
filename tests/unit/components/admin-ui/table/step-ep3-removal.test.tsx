/**
 * EP-3 旧入口删除验证集成单测（CHG-SN-9-DT-HEADER-REDESIGN-EP-3）
 *
 * 覆盖 ADR-149 D-149-1 / D-149-10 / D-149-11：
 *   - DataTable 不再渲染 hidden-columns-chip（即使有隐藏列）
 *   - DataTable 不再渲染内置 filter chips slot（即使 query.filters 非空）
 *   - hideFilterChips / hideHiddenColumnsChip props @deprecated 仍接受不破 typecheck
 *   - toolbar 仍正常渲染 search / trailing / views 三槽位
 *   - FilterChipBar / FilterChip 独立组件仍可被业务消费（D-149-11）
 *   - index.ts 已移除 formatFilterValue export
 *   - column-visibility 4 函数仍可独立 export
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { DataTable } from '../../../../../packages/admin-ui/src/components/data-table/data-table'
import type {
  TableColumn,
  TableQuerySnapshot,
  ColumnPreference,
  FilterValue,
} from '../../../../../packages/admin-ui/src/components/data-table/types'

type Row = { id: string; name: string; type: string }

const ROWS: Row[] = [
  { id: '1', name: 'Alpha', type: 'movie' },
  { id: '2', name: 'Beta', type: 'series' },
]

const COLUMNS: TableColumn<Row>[] = [
  { id: 'name', header: '名称', accessor: (r) => r.name, pinned: true },
  { id: 'type', header: '类型', accessor: (r) => r.type, columnMenu: { filterContent: <input /> } },
  { id: 'year', header: '年份', accessor: () => '2024' },
]

function snapshot(overrides: Partial<TableQuerySnapshot> = {}): TableQuerySnapshot {
  return {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: undefined, direction: 'asc' },
    filters: new Map(),
    columns: new Map([
      ['name', { visible: true }],
      ['type', { visible: true }],
      ['year', { visible: true }],
    ]),
    selection: { selectedKeys: new Set(), mode: 'page' },
    ...overrides,
  }
}

// ── 1. 隐藏列 chip 完全删除（D-149-1） ────────────────────────────

describe('EP-3 / D-149-1 — toolbar hidden-columns chip 完全删除', () => {
  it('有隐藏列时 chip 不再渲染', () => {
    const colsWithHidden: ReadonlyMap<string, ColumnPreference> = new Map([
      ['name', { visible: true }],
      ['type', { visible: false }],
      ['year', { visible: false }],
    ])
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot({ columns: colsWithHidden })}
        onQueryChange={() => {}}
      />,
    )
    expect(screen.queryByTestId('hidden-columns-chip')).toBeNull()
    expect(document.querySelector('[data-table-toolbar-hidden-cols-chip]')).toBeNull()
  })

  it('hideHiddenColumnsChip prop 即使传 true 也不影响（@deprecated noop）', () => {
    const colsWithHidden: ReadonlyMap<string, ColumnPreference> = new Map([
      ['name', { visible: true }],
      ['type', { visible: false }],
      ['year', { visible: true }],
    ])
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot({ columns: colsWithHidden })}
        onQueryChange={() => {}}
        toolbar={{ hideHiddenColumnsChip: true }}
      />,
    )
    expect(screen.queryByTestId('hidden-columns-chip')).toBeNull()
  })
})

// ── 2. filter chips slot 完全删除（D-149-1 / D-149-10） ──────────

describe('EP-3 / D-149-10 — toolbar filter chips slot 完全删除', () => {
  it('query.filters 非空时不再渲染内置 chips', () => {
    const filters: ReadonlyMap<string, FilterValue> = new Map([
      ['type', { kind: 'text', value: 'movie' } as FilterValue],
    ])
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot({ filters })}
        onQueryChange={() => {}}
      />,
    )
    expect(document.querySelector('[data-table-filter-chips]')).toBeNull()
    expect(document.querySelector('[data-table-filter-chip]')).toBeNull()
  })

  it('hideFilterChips prop 即使传 true 也不影响（@deprecated noop / 6 消费方兼容）', () => {
    const filters: ReadonlyMap<string, FilterValue> = new Map([
      ['type', { kind: 'text', value: 'movie' } as FilterValue],
    ])
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot({ filters })}
        onQueryChange={() => {}}
        toolbar={{ hideFilterChips: true }}
      />,
    )
    expect(document.querySelector('[data-table-filter-chips]')).toBeNull()
  })
})

// ── 3. toolbar 三槽位仍正常工作 ─────────────────────────────────

describe('EP-3 — toolbar search / views / trailing 三槽位仍渲染', () => {
  it('search slot 渲染', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot()}
        onQueryChange={() => {}}
        toolbar={{ search: <input data-testid="search-input" placeholder="搜索" /> }}
      />,
    )
    expect(screen.getByTestId('search-input')).toBeTruthy()
    expect(document.querySelector('[data-table-toolbar-search]')).toBeTruthy()
  })

  it('trailing slot 渲染（保留消费方业务动作槽位 / D-149-11）', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot()}
        onQueryChange={() => {}}
        toolbar={{ trailing: <button data-testid="add-btn">+ 新建</button> }}
      />,
    )
    expect(screen.getByTestId('add-btn')).toBeTruthy()
    expect(document.querySelector('[data-table-toolbar-trailing]')).toBeTruthy()
  })

  it('toolbar 容器：所有槽位空时不渲染', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={snapshot()}
        onQueryChange={() => {}}
      />,
    )
    // 无 search / trailing / views → toolbar 不应渲染
    expect(document.querySelector('[data-table-toolbar]')).toBeNull()
  })
})

// ── 4. FilterChip / FilterChipBar 业务独立组件仍可消费（D-149-11） ──

describe('EP-3 / D-149-11 — FilterChip / FilterChipBar 独立组件保留', () => {
  it('FilterChipBar 仍可从 admin-ui index.ts import 并渲染', async () => {
    const { FilterChipBar } = await import('../../../../../packages/admin-ui/src/components/data-table')
    expect(typeof FilterChipBar).toBe('function')
    render(<FilterChipBar items={[{ id: 'q', label: '搜索', value: 'test', onClear: () => {} }]} onClearAll={() => {}} />)
    expect(screen.getByText('搜索:')).toBeTruthy()
    expect(screen.getByText('test')).toBeTruthy()
  })

  it('FilterChip 单组件仍可从 admin-ui index.ts import', async () => {
    const { FilterChip } = await import('../../../../../packages/admin-ui/src/components/data-table')
    expect(typeof FilterChip).toBe('function')
  })
})

// ── 5. column-visibility 工具仍 export ────────────────────────────

describe('EP-3 — column-visibility 4 函数仍 export', () => {
  it('setColumnVisibility / isColumnVisible / getHidableColumns / countHiddenColumns 均可 import', async () => {
    const mod = await import('../../../../../packages/admin-ui/src/components/data-table')
    expect(typeof mod.setColumnVisibility).toBe('function')
    expect(typeof mod.isColumnVisible).toBe('function')
    expect(typeof mod.getHidableColumns).toBe('function')
    expect(typeof mod.countHiddenColumns).toBe('function')
  })
})

// ── 6. formatFilterValue 已删除 export ────────────────────────────

describe('EP-3 / D-149-10 — formatFilterValue 已从 index.ts 移除', () => {
  it('index.ts 不再 export formatFilterValue', async () => {
    const mod = await import('../../../../../packages/admin-ui/src/components/data-table')
    // formatFilterValue 在 filter-chips.tsx 中，整文件已删
    expect((mod as Record<string, unknown>).formatFilterValue).toBeUndefined()
  })
})
