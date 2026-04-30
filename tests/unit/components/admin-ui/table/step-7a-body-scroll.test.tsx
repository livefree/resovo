/**
 * DataTable .dt__body 独立滚动 layout 单测（CHG-DESIGN-02 Step 7A）
 * 覆盖：
 *   - data-table-body 元素存在，role=rowgroup
 *   - dt-styles 注入后选择器有效（防御性 min-height: 240px / body min-height: var(--row-h)）
 *   - 与 toolbar / thead / bulk / foot 的兄弟顺序正确
 *
 * 注：JSDOM 不实际计算 layout，本测保留 DOM 结构断言；视觉验收靠人工。
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { DataTable } from '../../../../../packages/admin-ui/src/components/data-table/data-table'
import type {
  TableColumn,
  TableQuerySnapshot,
} from '../../../../../packages/admin-ui/src/components/data-table/types'

type Row = { id: string; name: string }
const ROWS: Row[] = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
const COLUMNS: TableColumn<Row>[] = [{ id: 'name', header: 'Name', accessor: (r) => r.name }]

const SNAPSHOT: TableQuerySnapshot = {
  pagination: { page: 1, pageSize: 10 },
  sort: { field: undefined, direction: 'asc' },
  filters: new Map(),
  columns: new Map([['name', { visible: true }]]),
  selection: { selectedKeys: new Set(), mode: 'page' },
}

describe('DataTable Step 7A — body 独立滚动 layout', () => {
  it('渲染 [data-table-body] role=rowgroup', () => {
    const { container } = render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={SNAPSHOT}
        onQueryChange={() => {}}
      />,
    )
    const body = container.querySelector('[data-table-body]')
    expect(body).not.toBeNull()
    expect(body?.getAttribute('role')).toBe('rowgroup')
  })

  it('dt-styles 注入 [data-table] 与 [data-table-body] 选择器', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={SNAPSHOT}
        onQueryChange={() => {}}
      />,
    )
    const styleEl = document.getElementById('admin-ui-dt-styles')
    expect(styleEl).not.toBeNull()
    const css = styleEl!.textContent ?? ''
    // 防御性兜底
    expect(css).toContain('min-height: 240px')
    expect(css).toContain('display: flex')
    expect(css).toContain('flex-direction: column')
    // body 独立滚动
    expect(css).toMatch(/\[data-table-body\]/)
    expect(css).toContain('overflow-y: auto')
  })

  it('DOM 结构顺序：toolbar → (filter-chips) → thead → body → bulk → foot', () => {
    const { container } = render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={SNAPSHOT}
        onQueryChange={() => {}}
        toolbar={{ search: <input /> }}
        selection={{ selectedKeys: new Set(['1']), mode: 'page' }}
        onSelectionChange={() => {}}
        bulkActions={<button>批量</button>}
      />,
    )
    const dt = container.querySelector('[data-table]')!
    const children = Array.from(dt.children) as HTMLElement[]
    // skip <DTStyles /> renders null, so first real child is toolbar
    const toolbar = children.findIndex((c) => c.hasAttribute('data-table-toolbar'))
    const body = children.findIndex((c) => c.hasAttribute('data-table-body'))
    const bulk = children.findIndex((c) => c.hasAttribute('data-table-bulk'))
    const foot = children.findIndex((c) => c.hasAttribute('data-table-foot'))
    expect(toolbar).toBeGreaterThanOrEqual(0)
    expect(body).toBeGreaterThan(toolbar)
    expect(bulk).toBeGreaterThan(body)
    expect(foot).toBeGreaterThan(bulk)
  })
})
