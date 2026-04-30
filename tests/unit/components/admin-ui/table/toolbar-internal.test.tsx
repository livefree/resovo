/**
 * DataTable 内置 toolbar 单测（CHG-DESIGN-02 Step 4/7）
 * 覆盖：toolbar 缺省不渲染 / hidden=true 不渲染 / 三槽位（search/trailing/viewsConfig） /
 *       ViewsMenu 切换交互 / saved/onChange/onSave callback。
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { DataTable } from '../../../../../packages/admin-ui/src/components/data-table/data-table'
import type {
  TableColumn,
  TableQuerySnapshot,
  TableQueryPatch,
  TableView,
  ToolbarConfig,
} from '../../../../../packages/admin-ui/src/components/data-table/types'

type Row = { id: string; name: string }

const ROWS: Row[] = [{ id: '1', name: 'Alpha' }]
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

describe('DataTable — 内置 toolbar 渲染门控', () => {
  it('toolbar 缺省 → 不渲染 toolbar 容器', () => {
    render(<DataTable<Row> {...baseProps} />)
    expect(document.querySelector('[data-table-toolbar]')).toBeNull()
  })

  it('toolbar={{ hidden: true }} → 不渲染', () => {
    render(<DataTable<Row> {...baseProps} toolbar={{ hidden: true, search: <input /> }} />)
    expect(document.querySelector('[data-table-toolbar]')).toBeNull()
  })

  it('toolbar 配置全空（无 search/trailing/viewsConfig）→ 不渲染（避免空容器）', () => {
    render(<DataTable<Row> {...baseProps} toolbar={{}} />)
    expect(document.querySelector('[data-table-toolbar]')).toBeNull()
  })

  it.each([
    ['null', null],
    ['false', false],
    ['true', true],
    ['空字符串', ''],
    ['空数组', [] as React.ReactNode],
    ['全 null 数组', [null, false] as React.ReactNode],
    ['空 Set', new Set() as unknown as React.ReactNode],
  ])('search=%s（合法但渲染为空 ReactNode）→ 不渲染 toolbar 容器', (_label, value) => {
    render(<DataTable<Row> {...baseProps} toolbar={{ search: value as React.ReactNode }} />)
    expect(document.querySelector('[data-table-toolbar]')).toBeNull()
  })

  it.each([
    ['null', null],
    ['空数组', [] as React.ReactNode],
  ])('trailing=%s + 无 search/viewsConfig → 不渲染 toolbar 容器', (_label, value) => {
    render(<DataTable<Row> {...baseProps} toolbar={{ trailing: value as React.ReactNode }} />)
    expect(document.querySelector('[data-table-toolbar]')).toBeNull()
  })

  it('search=null + trailing=有效内容 → 仅渲染 trailing 包裹（不渲染空 search wrapper）', () => {
    render(
      <DataTable<Row>
        {...baseProps}
        toolbar={{ search: null, trailing: <button data-testid="real-trailing">导出</button> }}
      />,
    )
    expect(document.querySelector('[data-table-toolbar]')).toBeTruthy()
    expect(document.querySelector('[data-table-toolbar-search]')).toBeNull()
    expect(document.querySelector('[data-table-toolbar-trailing]')).toBeTruthy()
  })

  it('search=非空 generator → 物化后真实渲染（不会因检测消耗导致空）', () => {
    function* gen(): Generator<React.ReactNode> {
      yield <input key="real" data-testid="search-gen-real" placeholder="搜索…" />
    }
    render(
      <DataTable<Row>
        {...baseProps}
        toolbar={{ search: gen() as unknown as React.ReactNode }}
      />,
    )
    expect(document.querySelector('[data-table-toolbar-search]')).toBeTruthy()
    expect(screen.getByTestId('search-gen-real')).toBeTruthy()
  })

  it('toolbar.search 提供 → 渲染容器 + search 槽位', () => {
    render(
      <DataTable<Row>
        {...baseProps}
        toolbar={{ search: <input data-testid="my-search" placeholder="搜索…" /> }}
      />,
    )
    expect(document.querySelector('[data-table-toolbar]')).toBeTruthy()
    expect(document.querySelector('[data-table-toolbar-search]')).toBeTruthy()
    expect(screen.getByTestId('my-search')).toBeTruthy()
  })

  it('toolbar.trailing 提供 → 渲染右侧 actions 槽位', () => {
    render(
      <DataTable<Row>
        {...baseProps}
        toolbar={{ trailing: <button data-testid="export-btn">导出</button> }}
      />,
    )
    expect(document.querySelector('[data-table-toolbar-trailing]')).toBeTruthy()
    expect(screen.getByTestId('export-btn')).toBeTruthy()
  })
})

// ── ViewsMenu 集成（toolbar.viewsConfig）────────────────────────

const mockView = (id: string, label: string, scope: 'personal' | 'team' = 'personal'): TableView => ({
  id,
  label,
  scope,
  query: {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: undefined, direction: 'asc' },
    filters: new Map(),
    columns: new Map([['name', { visible: true }]]),
  },
  createdAt: '2026-04-29T00:00:00Z',
  updatedAt: '2026-04-29T00:00:00Z',
})

describe('DataTable — toolbar.viewsConfig 渲染 ViewsMenu', () => {
  it('提供 viewsConfig → 渲染视图触发按钮', () => {
    const cfg: ToolbarConfig['viewsConfig'] = {
      items: [mockView('v1', '我的待审')],
    }
    render(<DataTable<Row> {...baseProps} toolbar={{ viewsConfig: cfg }} />)
    expect(document.querySelector('[data-views-trigger]')).toBeTruthy()
    expect(screen.getByText('视图')).toBeTruthy()
    expect(screen.getByText('默认')).toBeTruthy()  // activeId 未提供 → 显示"默认"
  })

  it('activeId 匹配某个 view → 触发按钮显示该 view 的 label', () => {
    const cfg: ToolbarConfig['viewsConfig'] = {
      items: [mockView('v1', '我的待审'), mockView('v2', '失效封面')],
      activeId: 'v2',
    }
    render(<DataTable<Row> {...baseProps} toolbar={{ viewsConfig: cfg }} />)
    expect(screen.getByText('失效封面')).toBeTruthy()
  })

  it('点击视图行 → 调 onChange + 关闭 menu', () => {
    const onChange = vi.fn()
    const cfg: ToolbarConfig['viewsConfig'] = {
      items: [mockView('v1', '我的待审'), mockView('v2', '失效封面')],
      onChange,
    }
    render(<DataTable<Row> {...baseProps} toolbar={{ viewsConfig: cfg }} />)
    // 打开 menu
    fireEvent.click(document.querySelector('[data-views-trigger]') as HTMLElement)
    expect(document.querySelector('[data-views-menu]')).toBeTruthy()
    // 点击 v2
    fireEvent.click(document.querySelector('[data-view-id="v2"]') as HTMLElement)
    expect(onChange).toHaveBeenCalledWith('v2')
    // menu 关闭
    expect(document.querySelector('[data-views-menu]')).toBeNull()
  })

  it('提供 onSave → 显示"保存当前为个人/团队视图"按钮，点击调 callback', () => {
    const onSave = vi.fn()
    const cfg: ToolbarConfig['viewsConfig'] = {
      items: [],
      onSave,
    }
    render(<DataTable<Row> {...baseProps} toolbar={{ viewsConfig: cfg }} />)
    fireEvent.click(document.querySelector('[data-views-trigger]') as HTMLElement)
    const personalBtn = document.querySelector('[data-views-save-personal]') as HTMLElement
    const teamBtn = document.querySelector('[data-views-save-team]') as HTMLElement
    expect(personalBtn).toBeTruthy()
    expect(teamBtn).toBeTruthy()
    fireEvent.click(personalBtn)
    expect(onSave).toHaveBeenCalledWith('personal')
    expect(document.querySelector('[data-views-menu]')).toBeNull()
  })

  it('未提供 onSave → 不渲染保存按钮', () => {
    const cfg: ToolbarConfig['viewsConfig'] = {
      items: [mockView('v1', '我的待审')],
    }
    render(<DataTable<Row> {...baseProps} toolbar={{ viewsConfig: cfg }} />)
    fireEvent.click(document.querySelector('[data-views-trigger]') as HTMLElement)
    expect(document.querySelector('[data-views-save-personal]')).toBeNull()
    expect(document.querySelector('[data-views-save-team]')).toBeNull()
  })

  it('items 为空且无 onSave → 显示"暂无保存的视图"提示', () => {
    const cfg: ToolbarConfig['viewsConfig'] = { items: [] }
    render(<DataTable<Row> {...baseProps} toolbar={{ viewsConfig: cfg }} />)
    fireEvent.click(document.querySelector('[data-views-trigger]') as HTMLElement)
    expect(screen.getByText('暂无保存的视图')).toBeTruthy()
  })

  it('ESC 关闭 ViewsMenu', () => {
    const cfg: ToolbarConfig['viewsConfig'] = {
      items: [mockView('v1', 'V1')],
    }
    render(<DataTable<Row> {...baseProps} toolbar={{ viewsConfig: cfg }} />)
    fireEvent.click(document.querySelector('[data-views-trigger]') as HTMLElement)
    expect(document.querySelector('[data-views-menu]')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[data-views-menu]')).toBeNull()
  })
})
