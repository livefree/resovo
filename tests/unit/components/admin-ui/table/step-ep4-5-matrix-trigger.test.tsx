/**
 * EP-4.5 矩阵触发器接入 DataTable 主组件 toolbar 单测（CHG-SN-9-DT-HEADER-REDESIGN-EP-4.5）
 *
 * 覆盖 ADR-149 AMENDMENT 2 D-149-16（9 子段）：
 *   - 触发器渲染（默认 toolbar-right）+ data attribute 独立
 *   - 触发器永驻渲染（即使 toolbar 三槽位全空 / R-AMEND-2-1）
 *   - aria-haspopup="dialog" + aria-expanded 双向（D-149-12）
 *   - 点击触发器 → matrix popover 打开 + data-active="true" 同步
 *   - matrix popover wiring 联动 query.columns / query.filters / query.sort
 *   - 业务 key 桥接清除全部过滤（BLOCKER R-AMEND-2-3）
 *   - 合并式 reset 不丢 column width（R-AMEND-2-4）
 *   - 矩阵触发器视觉与列级 ⋯ 独立 data attribute
 *
 * column-visibility.ts 4 工具单测同覆盖（clearAllColumnFilters + resetColumnVisibility）。
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { DataTable } from '../../../../../packages/admin-ui/src/components/data-table/data-table'
import {
  clearAllColumnFilters,
  resetColumnVisibility,
} from '../../../../../packages/admin-ui/src/components/data-table/column-visibility'
import type {
  TableColumn,
  TableQuerySnapshot,
  TableQueryPatch,
  ColumnPreference,
  FilterValue,
} from '../../../../../packages/admin-ui/src/components/data-table/types'

// ── fixtures ─────────────────────────────────────────────────────

type Row = { id: string; name: string; type: string }
const ROWS: Row[] = [
  { id: '1', name: 'Alpha', type: 'movie' },
  { id: '2', name: 'Beta', type: 'series' },
]
const COLUMNS: TableColumn<Row>[] = [
  { id: 'name', header: '标题', accessor: (r) => r.name, enableSorting: true, pinned: false },
  { id: 'type', header: '类型', accessor: (r) => r.type, enableSorting: true, columnMenu: { filterContent: <input /> } },
  { id: 'year', header: '年份', accessor: () => '2024' },
]

function makeSnapshot(overrides: Partial<TableQuerySnapshot> = {}): TableQuerySnapshot {
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

// ── 1. 触发器渲染（默认 toolbar-right） ─────────────────────────────

describe('EP-4.5 / D-149-16 §(1)/§(3) — 矩阵触发器渲染', () => {
  it('默认 headerMenuTriggerPosition=toolbar-right → 触发器渲染在 toolbar', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
      />,
    )
    const trigger = screen.queryByTestId('matrix-trigger')
    expect(trigger).toBeTruthy()
    expect(trigger?.hasAttribute('data-table-matrix-trigger')).toBe(true)
  })

  it('触发器 ARIA：aria-haspopup="dialog" + aria-expanded=false（初始）', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
      />,
    )
    const trigger = screen.getByTestId('matrix-trigger')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-label')).toBe('表格设置')
  })

  it('R-AMEND-2-1：toolbar 三槽位全空时触发器仍渲染', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        toolbar={{}}
      />,
    )
    expect(document.querySelector('[data-table-toolbar]')).toBeTruthy()
    expect(screen.queryByTestId('matrix-trigger')).toBeTruthy()
  })

  it('R-AMEND-2-2：矩阵触发器视觉与列级 ⋯ 独立 data attribute', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
      />,
    )
    // 列级 ⋯ 用 [data-th-menu-icon]（thead 内 / hover 显隐）
    expect(document.querySelector('[data-th-menu-icon]')).toBeTruthy()
    // 矩阵触发器用 [data-table-matrix-trigger]（toolbar 内 / opacity:1 恒显）
    expect(document.querySelector('[data-table-matrix-trigger]')).toBeTruthy()
    // 两者完全独立 selector，不重叠
    expect(document.querySelector('[data-th-menu-icon][data-table-matrix-trigger]')).toBeNull()
  })

  it('toolbar.hidden=true 时触发器不在 toolbar 渲染（thead-right fallback 推 N1）', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        toolbar={{ hidden: true }}
      />,
    )
    expect(document.querySelector('[data-table-toolbar]')).toBeNull()
    // EP-4.5 仅实装 toolbar-right；thead-right fallback 推 N1-149-11
    // 当前行为：toolbar.hidden=true 时矩阵触发器不渲染（消费方需取消 hidden=true）
  })
})

// ── 2. 点击触发器 → popover 打开 + data-active 同步 ──────────────────

describe('EP-4.5 — 触发器点击 + popover 联动', () => {
  it('点击触发器 → matrix popover 打开 + aria-expanded=true + data-active=true', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
      />,
    )
    const trigger = screen.getByTestId('matrix-trigger')
    expect(document.querySelector('[data-column-matrix-menu]')).toBeNull()
    fireEvent.click(trigger)
    expect(document.querySelector('[data-column-matrix-menu]')).toBeTruthy()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('data-active')).toBe('true')
  })

  it('再次点击 → popover 关闭 + data-active=undefined', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
      />,
    )
    const trigger = screen.getByTestId('matrix-trigger')
    fireEvent.click(trigger)
    fireEvent.click(trigger)
    expect(document.querySelector('[data-column-matrix-menu]')).toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})

// ── 3. matrix popover wiring 联动 query ───────────────────────────

describe('EP-4.5 — matrix popover 6 callback wiring', () => {
  it('可见性 toggle → onQueryChange({ columns })', () => {
    const patches: TableQueryPatch[] = []
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-trigger'))
    fireEvent.click(screen.getByTestId('matrix-visibility-type'))
    expect(patches.length).toBe(1)
    expect(patches[0].columns).toBeDefined()
    expect(patches[0].columns?.get('type')?.visible).toBe(false)
  })

  it('排序 ↑ 触发 → onQueryChange({ sort: asc })', () => {
    const patches: TableQueryPatch[] = []
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-trigger'))
    fireEvent.click(screen.getByTestId('matrix-sort-asc-type'))
    expect(patches[0].sort).toEqual({ field: 'type', direction: 'asc' })
  })

  it('过滤 toggle 关闭 → 调 onClearColumnFilter 删除 query.filters 该列', () => {
    const filters: ReadonlyMap<string, FilterValue> = new Map([
      ['type', { kind: 'text', value: 'movie' } as FilterValue],
    ])
    const patches: TableQueryPatch[] = []
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ filters })}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-trigger'))
    fireEvent.click(screen.getByTestId('matrix-filter-type'))
    expect(patches[0].filters).toBeDefined()
    expect(patches[0].filters?.has('type')).toBe(false)
  })
})

// ── 4. BLOCKER R-AMEND-2-3：业务 key 桥接清除全部过滤 ──────────────

describe('EP-4.5 / R-AMEND-2-3 BLOCKER — onClearAllFilters 业务 key 桥接', () => {
  it('优先调 columnMenu.onClearFilter（业务 key 桥接 / 防 M-SN-8 假装实现）', () => {
    const businessClear1 = vi.fn<() => void>()
    const businessClear2 = vi.fn<() => void>()
    const customColumns: TableColumn<Row>[] = [
      { id: 'name', header: '标题', accessor: (r) => r.name },
      {
        id: 'type', header: '类型', accessor: (r) => r.type,
        columnMenu: {
          filterContent: <input />,
          isFiltered: true,
          onClearFilter: businessClear1,
        },
      },
      {
        id: 'year', header: '年份', accessor: () => '2024',
        columnMenu: {
          filterContent: <input />,
          isFiltered: true,
          onClearFilter: businessClear2,
        },
      },
    ]
    const patches: TableQueryPatch[] = []
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={customColumns}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-trigger'))
    fireEvent.click(screen.getByTestId('matrix-foot-clear-filters'))
    // 业务 key 桥接：两个 columnMenu.onClearFilter 都被调（D-149-15 桥接合约）
    expect(businessClear1).toHaveBeenCalledTimes(1)
    expect(businessClear2).toHaveBeenCalledTimes(1)
  })

  it('同时清空 column.id 命名空间过滤（非业务 key 场景）', () => {
    const filters: ReadonlyMap<string, FilterValue> = new Map([
      ['type', { kind: 'text', value: 'movie' } as FilterValue],
    ])
    const patches: TableQueryPatch[] = []
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ filters })}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-trigger'))
    fireEvent.click(screen.getByTestId('matrix-foot-clear-filters'))
    // column.id 命名空间过滤被清（query.filters 设为空 Map）
    expect(patches[0].filters).toBeDefined()
    expect(patches[0].filters?.size).toBe(0)
  })
})

// ── 5. R-AMEND-2-4：合并式 reset 不丢 column width ───────────────

describe('EP-4.5 / R-AMEND-2-4 — onResetColumnVisibility 不丢 column width', () => {
  it('reset 保留 width 字段 + visible 回 defaultVisible', () => {
    const colsWithWidth: ReadonlyMap<string, ColumnPreference> = new Map([
      ['name', { visible: true, width: 240 }],
      ['type', { visible: false, width: 120 }],  // 已隐藏 + 自定义 width
      ['year', { visible: false }],  // 无 width
    ])
    const patches: TableQueryPatch[] = []
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot({ columns: colsWithWidth })}
        onQueryChange={(p) => patches.push(p)}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-trigger'))
    fireEvent.click(screen.getByTestId('matrix-foot-reset-visibility'))
    const nextCols = patches[0].columns!
    // visible 字段重置（COLUMNS 全部 defaultVisible 缺省 = true）
    expect(nextCols.get('name')?.visible).toBe(true)
    expect(nextCols.get('type')?.visible).toBe(true)  // type 从 false reset 回 true
    expect(nextCols.get('year')?.visible).toBe(true)
    // **关键断言**：width 字段保留（不丢 user state）
    expect(nextCols.get('name')?.width).toBe(240)
    expect(nextCols.get('type')?.width).toBe(120)
    expect(nextCols.get('year')?.width).toBeUndefined()  // 原本无 width
  })
})

// ── 6. column-visibility.ts 工具函数单测 ─────────────────────────

describe('column-visibility.ts — EP-4.5 新增工具', () => {
  it('clearAllColumnFilters：优先调 columnMenu.onClearFilter + 清空 query.filters', () => {
    const businessClear = vi.fn<() => void>()
    const cols: TableColumn<Row>[] = [
      { id: 'name', header: '标题', accessor: (r) => r.name },
      {
        id: 'type', header: '类型', accessor: (r) => r.type,
        columnMenu: { onClearFilter: businessClear },
      },
    ]
    const onPatch = vi.fn<(next: ReadonlyMap<string, FilterValue>) => void>()
    const filters: ReadonlyMap<string, FilterValue> = new Map([
      ['name', { kind: 'text', value: 'a' } as FilterValue],
    ])
    clearAllColumnFilters(cols, filters, onPatch)
    expect(businessClear).toHaveBeenCalledTimes(1)
    expect(onPatch).toHaveBeenCalledWith(new Map())
  })

  it('clearAllColumnFilters：空 filters Map 时不调 onPatch（避免无谓 re-render）', () => {
    const cols: TableColumn<Row>[] = [
      { id: 'name', header: '标题', accessor: (r) => r.name },
    ]
    const onPatch = vi.fn<(next: ReadonlyMap<string, FilterValue>) => void>()
    clearAllColumnFilters(cols, new Map(), onPatch)
    expect(onPatch).not.toHaveBeenCalled()
  })

  it('resetColumnVisibility：保留 width / visible 回 defaultVisible', () => {
    const cols = [
      { id: 'a', header: 'A', defaultVisible: true },
      { id: 'b', header: 'B', defaultVisible: false },
      { id: 'c', header: 'C' },  // defaultVisible undefined → true
    ]
    const colMap: ReadonlyMap<string, ColumnPreference> = new Map([
      ['a', { visible: false, width: 200 }],
      ['b', { visible: true }],  // 用户曾改可见但无 width
      ['c', { visible: false, width: 150 }],
    ])
    const next = resetColumnVisibility(cols, colMap)
    expect(next.get('a')).toEqual({ visible: true, width: 200 })
    expect(next.get('b')).toEqual({ visible: false })
    expect(next.get('c')).toEqual({ visible: true, width: 150 })
  })

  it('resetColumnVisibility：colMap 完全空时也能正确生成', () => {
    const cols = [
      { id: 'a', header: 'A', defaultVisible: true },
      { id: 'b', header: 'B', defaultVisible: false },
    ]
    const next = resetColumnVisibility(cols, new Map())
    expect(next.get('a')).toEqual({ visible: true })
    expect(next.get('b')).toEqual({ visible: false })
  })
})
