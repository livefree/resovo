/**
 * DataTable scrollport / body / foot layout 单测（CHG-DESIGN-02 Step 7A + 7B fix#2）
 * 覆盖：
 *   - data-table-body 元素存在 + role=rowgroup（语义保留）
 *   - dt-styles 注入后选择器有效：
 *     · [data-table] overflow:hidden + flex column + min-width:0 + min-height:240px
 *     · [data-table-scroll] 双轴 overflow:auto + flex:1 + min-height/width:0
 *     · [data-table-body] 不再独立 overflow（display:contents）
 *   - DOM 树形：frame 直接子 = toolbar → (filter-chips) → scroll(thead, body, bulk) → foot
 *     scroll 子 = thead → body → bulk
 *
 * 设计目标（Codex stop-time review fix#2）：横向 + 纵向滚动统一在 [data-table-scroll]
 * 单一 viewport 内，避免 frame 横滚 + body 纵滚分裂导致垂直滚动条随 scrollLeft 漂移。
 *
 * 注：JSDOM 不实际计算 layout，本测保留 DOM 结构 + CSS 注入文本断言；视觉验收靠人工。
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

describe('DataTable Step 7A + 7B fix#2 — scrollport / body / foot layout', () => {
  it('渲染 [data-table-body] role=rowgroup（语义保留）', () => {
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

  it('dt-styles 注入：frame overflow:hidden + scrollport 双轴 + body 不独立滚动', () => {
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
    // [data-table] frame 不滚动 + flex column + min-width/height 兜底
    expect(css).toContain('min-height: 240px')
    expect(css).toContain('min-width: 0')
    expect(css).toContain('display: flex')
    expect(css).toContain('flex-direction: column')
    // 关键：[data-table-scroll] 单一 scrollport 双轴
    expect(css).toMatch(/\[data-table-scroll\]/)
    expect(css).toContain('overflow: auto')
    // body wrapper 不再独立滚动（display:contents 让 rows 直接成为 scrollport children）
    expect(css).toMatch(/\[data-table-body\]\s*\{[^}]*display:\s*contents/)
  })

  it('DOM 顺序（frame 直接子）：toolbar → (filter-chips) → scroll → foot；bulk 在 scroll 内', () => {
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
    const toolbar = children.findIndex((c) => c.hasAttribute('data-table-toolbar'))
    const scroll = children.findIndex((c) => c.hasAttribute('data-table-scroll'))
    const foot = children.findIndex((c) => c.hasAttribute('data-table-foot'))
    expect(toolbar).toBeGreaterThanOrEqual(0)
    expect(scroll).toBeGreaterThan(toolbar)
    expect(foot).toBeGreaterThan(scroll)

    // bulk 不在 frame 直接子层
    expect(children.find((c) => c.hasAttribute('data-table-bulk'))).toBeUndefined()

    // bulk + body 都应在 [data-table-scroll] 容器内
    const scrollEl = container.querySelector('[data-table-scroll]')!
    expect(scrollEl.querySelector('[data-table-body]')).not.toBeNull()
    expect(scrollEl.querySelector('[data-table-bulk]')).not.toBeNull()
  })

  it('foot 在 scrollport 之外（frame 直接子，不随横滚漂移）', () => {
    const { container } = render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={SNAPSHOT}
        onQueryChange={() => {}}
        pagination={{}}
      />,
    )
    const dt = container.querySelector('[data-table]')!
    const scrollEl = container.querySelector('[data-table-scroll]')
    const foot = container.querySelector('[data-table-foot]')
    expect(scrollEl).not.toBeNull()
    expect(foot).not.toBeNull()
    // foot 是 frame 直接子，不在 scrollport 内
    expect(foot!.parentElement).toBe(dt)
    expect(scrollEl!.contains(foot)).toBe(false)
  })
})
