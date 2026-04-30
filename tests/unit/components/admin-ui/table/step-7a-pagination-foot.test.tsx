/**
 * DataTable PaginationFoot 单测（CHG-DESIGN-02 Step 7A）
 * 覆盖（三态语义 — Codex stop-time review fix）：
 *   - 省略 pagination prop → 渲染 summary-only foot（无 pager / 无 pageSize select），避免与外置 PaginationV2 双 pager
 *   - 显式 pagination={} → 渲染完整 foot（pager + pageSize 都激活）
 *   - hidden=true → 完全不渲染 foot
 *   - 显式 + 多页 → 渲染翻页器 + page 切换调 onQueryChange
 *   - 显式 + pageSizeOptions [10,20] → 渲染 pageSize select + 切换回 page 1
 *   - summaryRender 自定义 → 替换默认文案，含 selectedCount
 *   - server mode total 走 totalRows，不取 PaginationConfig.total（已删除）
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { DataTable } from '../../../../../packages/admin-ui/src/components/data-table/data-table'
import type {
  TableColumn,
  TableQuerySnapshot,
  TableQueryPatch,
} from '../../../../../packages/admin-ui/src/components/data-table/types'

type Row = { id: string; name: string }
const ROWS: Row[] = Array.from({ length: 35 }, (_, i) => ({ id: String(i + 1), name: `R${i + 1}` }))
const COLUMNS: TableColumn<Row>[] = [{ id: 'name', header: 'Name', accessor: (r) => r.name }]

function makeSnapshot(page = 1, pageSize = 10): TableQuerySnapshot {
  return {
    pagination: { page, pageSize },
    sort: { field: undefined, direction: 'asc' },
    filters: new Map(),
    columns: new Map([['name', { visible: true }]]),
    selection: { selectedKeys: new Set(), mode: 'page' },
  }
}

describe('DataTable Step 7A — PaginationFoot', () => {
  it('pagination 缺省（未传 prop）→ summary-only foot（无 pager / 无 pageSize select）', () => {
    // Codex stop-time review fix：省略 prop 时 foot 不应渲染主动控件，避免
    // 与现有外置 PaginationV2 消费方（VideoListClient / dev demo）双 pager 冲突
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot(1, 10)}
        onQueryChange={() => {}}
      />,
    )
    expect(document.querySelector('[data-table-foot]')).not.toBeNull()
    expect(document.querySelector('[data-table-foot-summary]')?.textContent).toContain('共 35 条')
    // 关键断言：缺省模式下 pager 与 pageSize 控件均不渲染
    expect(document.querySelector('[data-table-foot-pager]')).toBeNull()
    expect(document.querySelector('[data-table-foot-pagesize]')).toBeNull()
  })

  it('pagination={} 显式空对象 → 完整 foot（pager + pageSize 激活）', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot(1, 10)}
        onQueryChange={() => {}}
        pagination={{}}
      />,
    )
    expect(document.querySelector('[data-table-foot-pager]')).not.toBeNull()
    expect(document.querySelector('[data-table-foot-pagesize]')).not.toBeNull()
  })

  it('pagination={{ hidden: true }} → 完全不渲染 foot', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        pagination={{ hidden: true }}
      />,
    )
    expect(document.querySelector('[data-table-foot]')).toBeNull()
  })

  it('显式 pagination + 多页 → 翻页器渲染 + 点击页号触发 onQueryChange({pagination:{page:N}})', () => {
    const onQueryChange = vi.fn<(p: TableQueryPatch) => void>()
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot(1, 10)}
        onQueryChange={onQueryChange}
        pagination={{}}
      />,
    )
    const buttons = document.querySelectorAll('[data-table-foot-pager-btn]')
    expect(buttons.length).toBeGreaterThan(0)
    // 找到 page 2 按钮（textContent === '2'）
    const page2Btn = Array.from(buttons).find((b) => b.textContent === '2')
    expect(page2Btn).toBeDefined()
    fireEvent.click(page2Btn!)
    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ pagination: { page: 2 } }),
    )
  })

  it('pageSizeOptions [10,20] → 渲染 select 且切换回 page 1', () => {
    const onQueryChange = vi.fn<(p: TableQueryPatch) => void>()
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot(3, 10)}
        onQueryChange={onQueryChange}
        pagination={{ pageSizeOptions: [10, 20] }}
      />,
    )
    const select = document.querySelector('[data-table-foot-pagesize] select') as HTMLSelectElement
    expect(select).not.toBeNull()
    fireEvent.change(select, { target: { value: '20' } })
    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ pagination: { page: 1, pageSize: 20 } }),
    )
  })

  it('summaryRender 自定义 + selectedCount 上下文', () => {
    const summaryRender = vi.fn(
      (ctx) => `自定义: ${ctx.total} | sel ${ctx.selectedCount}`,
    )
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={{
          ...makeSnapshot(),
          selection: { selectedKeys: new Set(['1', '2', '3']), mode: 'page' },
        }}
        onQueryChange={() => {}}
        selection={{ selectedKeys: new Set(['1', '2', '3']), mode: 'page' }}
        onSelectionChange={() => {}}
        pagination={{ summaryRender }}
      />,
    )
    expect(summaryRender).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 35,
        page: 1,
        pageSize: 10,
        totalPages: 4,
        selectedCount: 3,
      }),
    )
    expect(document.querySelector('[data-table-foot-summary]')?.textContent).toBe('自定义: 35 | sel 3')
  })

  it('pageSizeOptions 长度 ≤1 → 不渲染 pageSize 切换', () => {
    render(
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="client"
        query={makeSnapshot()}
        onQueryChange={() => {}}
        pagination={{ pageSizeOptions: [10] }}
      />,
    )
    expect(document.querySelector('[data-table-foot-pagesize]')).toBeNull()
  })

  it('server mode 用 totalRows（顶层），PaginationConfig.total 已删除不存在', () => {
    render(
      <DataTable<Row>
        rows={ROWS.slice(0, 5)}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        mode="server"
        query={makeSnapshot(1, 5)}
        onQueryChange={() => {}}
        totalRows={120}
        pagination={{}}
      />,
    )
    expect(document.querySelector('[data-table-foot-summary]')?.textContent).toContain('共 120 条')
    expect(document.querySelector('[data-table-foot-summary]')?.textContent).toContain('第 1/24 页')
  })
})
