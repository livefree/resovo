/**
 * EP-2 列级 ⋯ + 列名 toggle 排序专属单测（CHG-SN-9-DT-HEADER-REDESIGN-EP-2）
 *
 * 覆盖 ADR-149：
 *   - D-149-4 列名点击二态互斥（不可回 none / 业界范式）
 *   - D-149-3 列级 ⋯ button + columnTriggerVisibility 三态（auto/always/never）
 *   - R-149-6 ⋯ onClick e.stopPropagation 防冒泡到列名排序
 *   - R-149-2 columnTriggerVisibility='auto' 5 条件 OR 判定
 *   - D-149-1 旧 enableHeaderMenu prop @deprecated noop（消费方传 true/false 不影响行为）
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { DataTable } from '../../../../../packages/admin-ui/src/components/data-table/data-table'
import type {
  TableColumn,
  TableQuerySnapshot,
  TableQueryPatch,
  ColumnPreference,
  FilterValue,
} from '../../../../../packages/admin-ui/src/components/data-table/types'

type Row = { id: string; name: string; score: number }

const ROWS: Row[] = [
  { id: '1', name: 'Alpha', score: 90 },
  { id: '2', name: 'Beta', score: 70 },
]

// AMD2（2026-05-24）：旧 fixture 假设"未声明 filterable=不支持" / 显式 false 维持原预期
const COLUMNS_BASIC: TableColumn<Row>[] = [
  { id: 'name', header: 'Name', accessor: (r) => r.name, enableSorting: true, filterable: false },
  { id: 'score', header: 'Score', accessor: (r) => r.score, enableSorting: true, filterable: false },
]

const COLUMNS_RICH: TableColumn<Row>[] = [
  { id: 'name', header: 'Name', accessor: (r) => r.name, enableSorting: true, filterable: false },
  { id: 'score', header: 'Score', accessor: (r) => r.score, enableSorting: false, filterable: false }, // 不可排序
  { id: 'note', header: 'Note', accessor: () => '', enableSorting: false, filterable: false, columnMenu: { filterContent: <input /> } }, // 有 filter
  { id: 'pinned', header: 'Pinned', accessor: () => '', pinned: true, enableSorting: false, filterable: false }, // pinned 无操作
]

function makeSnapshot(overrides: Partial<TableQuerySnapshot> = {}): TableQuerySnapshot {
  const cols: ReadonlyMap<string, ColumnPreference> = new Map([
    ['name', { visible: true }],
    ['score', { visible: true }],
    ['note', { visible: true }],
    ['pinned', { visible: true }],
  ])
  return {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: undefined, direction: 'asc' },
    filters: new Map(),
    columns: cols,
    selection: { selectedKeys: new Set(), mode: 'page' },
    ...overrides,
  }
}

// ── 1. D-149-4 列名点击二态互斥（核心行为变化） ────────────────────────

describe('EP-2 / D-149-4 — 列名点击二态互斥 asc ↔ desc（废除三态循环）', () => {
  it('未排序点列名 → asc', () => {
    const patches: TableQueryPatch[] = []
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS_BASIC}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByText('Name'))
    expect(patches[0].sort).toEqual({ field: 'name', direction: 'asc' })
  })

  it('asc 再点列名 → desc 互斥（不回 none）', () => {
    const patches: TableQueryPatch[] = []
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS_BASIC}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ sort: { field: 'name', direction: 'asc' } })}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByText('Name'))
    expect(patches[0].sort).toEqual({ field: 'name', direction: 'desc' })
  })

  it('desc 再点列名 → asc 互斥（D-149-4 不可回 none）', () => {
    const patches: TableQueryPatch[] = []
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS_BASIC}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ sort: { field: 'name', direction: 'desc' } })}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByText('Name'))
    expect(patches[0].sort).toEqual({ field: 'name', direction: 'asc' })
    // 关键验证：sort.field 仍存在（未被清除）
    expect(patches[0].sort?.field).toBeDefined()
  })

  it('切换不同列 → 默认 asc + 清除原列', () => {
    const patches: TableQueryPatch[] = []
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS_BASIC}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ sort: { field: 'name', direction: 'desc' } })}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByText('Score'))
    expect(patches[0].sort).toEqual({ field: 'score', direction: 'asc' })
  })
})

// ── 2. D-149-3 列级 ⋯ button + stopPropagation ────────────────────

describe('EP-2 / D-149-3 — 列级 ⋯ button + stopPropagation', () => {
  it('点 ⋯ button → 打开 HeaderMenu popover（不触发列名 toggle 排序）', () => {
    const patches: TableQueryPatch[] = []
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS_BASIC}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByTestId('th-menu-trigger-name'))
    // popover 已打开
    expect(document.querySelector('[data-header-menu]')).toBeTruthy()
    // 列名 toggle 排序未触发（patches 应该为空 — 因为 ⋯ click stopPropagation 防冒泡）
    expect(patches.length).toBe(0)
  })

  it('⋯ button aria-haspopup + aria-expanded 同步 menu 状态', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS_BASIC}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
      />,
    )
    const trigger = screen.getByTestId('th-menu-trigger-name')
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })
})

// ── 3. D-149-3 / R-149-2 columnTriggerVisibility 三态判定 ─────────

describe('EP-2 / R-149-2 — columnTriggerVisibility 三态', () => {
  it('default auto: 可排序列显示 ⋯', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS_RICH}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
      />,
    )
    // name 可排序 → 有 ⋯
    expect(screen.queryByTestId('th-menu-trigger-name')).toBeTruthy()
    // note 有 filterContent → 有 ⋯
    expect(screen.queryByTestId('th-menu-trigger-note')).toBeTruthy()
    // score 不可排序+无 filter+非 pinned → hidable=true（默认 canHide）→ 有 ⋯
    expect(screen.queryByTestId('th-menu-trigger-score')).toBeTruthy()
    // pinned 列不可排序+无 filter+不可隐藏 → 无 ⋯
    expect(screen.queryByTestId('th-menu-trigger-pinned')).toBeNull()
  })

  it('always: 所有列均显示 ⋯（含 pinned）', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS_RICH}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        columnTriggerVisibility="always"
      />,
    )
    expect(screen.queryByTestId('th-menu-trigger-name')).toBeTruthy()
    expect(screen.queryByTestId('th-menu-trigger-score')).toBeTruthy()
    expect(screen.queryByTestId('th-menu-trigger-note')).toBeTruthy()
    expect(screen.queryByTestId('th-menu-trigger-pinned')).toBeTruthy()
  })

  it('never: 所有列均不显示 ⋯', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS_RICH}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        columnTriggerVisibility="never"
      />,
    )
    expect(screen.queryByTestId('th-menu-trigger-name')).toBeNull()
    expect(screen.queryByTestId('th-menu-trigger-score')).toBeNull()
    expect(screen.queryByTestId('th-menu-trigger-note')).toBeNull()
    expect(screen.queryByTestId('th-menu-trigger-pinned')).toBeNull()
  })

  it('auto: 当前已排序列 → 显示 ⋯（即使其他条件不满足）+ data-active="true"', () => {
    const COLUMNS_PINNED_SORTABLE: TableColumn<Row>[] = [
      { id: 'name', header: 'Name', accessor: (r) => r.name, enableSorting: true, pinned: true },
    ]
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS_PINNED_SORTABLE}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ sort: { field: 'name', direction: 'asc' } })}
        onQueryChange={() => {}}
      />,
    )
    const trigger = screen.queryByTestId('th-menu-trigger-name')
    expect(trigger).toBeTruthy()
    expect(trigger?.getAttribute('data-active')).toBe('true')
  })

  it('auto: 当前已过滤列 → 显示 ⋯ + data-active="true"', () => {
    const COLUMNS_FILTERABLE: TableColumn<Row>[] = [
      { id: 'name', header: 'Name', accessor: (r) => r.name, columnMenu: { filterContent: <input /> } },
    ]
    const filters: ReadonlyMap<string, FilterValue> = new Map([
      ['name', { kind: 'text', value: 'Alpha' } as FilterValue],
    ])
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS_FILTERABLE}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ filters })}
        onQueryChange={() => {}}
      />,
    )
    const trigger = screen.queryByTestId('th-menu-trigger-name')
    expect(trigger).toBeTruthy()
    expect(trigger?.getAttribute('data-active')).toBe('true')
  })
})

// ── 4. D-149-1 旧 enableHeaderMenu @deprecated noop ────────────────

describe('EP-2 / D-149-1 — 旧 enableHeaderMenu prop @deprecated noop', () => {
  it('enableHeaderMenu={true} 不影响行为：列名仍 toggle 排序 + ⋯ trigger 仍存在', () => {
    const patches: TableQueryPatch[] = []
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS_BASIC}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={(p) => patches.push(p)}
        enableHeaderMenu={true}
      />,
    )
    // 行为按新设计：点列名 toggle 排序（旧 enableHeaderMenu=true 不再打开 popover）
    fireEvent.click(screen.getByText('Name'))
    expect(patches[0].sort).toEqual({ field: 'name', direction: 'asc' })
    expect(document.querySelector('[data-header-menu]')).toBeNull()
    // ⋯ trigger 仍存在（由 columnTriggerVisibility='auto' 控制）
    expect(screen.queryByTestId('th-menu-trigger-name')).toBeTruthy()
  })
})
