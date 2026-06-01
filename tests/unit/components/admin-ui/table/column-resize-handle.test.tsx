/**
 * column-resize-handle.test.tsx — DataTable 列宽 resize handle 组件测（DTR-E / SEQ-20260531-01）
 * 覆盖：handle 仅可调非 flex/非 action 列 / 拖拽提交 width / pointercancel 回滚 /
 *   键盘 ←/→/Shift/Home/End / 双击 auto-fit / 默认 cell+header 截断+title / 不触发排序 / 重置列宽。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import React from 'react'

// jsdom 缺/弱 PointerEvent（button/clientX/pointerId 不透传）→ 基于 MouseEvent 补一个，
// 让 fireEvent.pointerXxx 携带 button/clientX/pointerId（真实浏览器原生具备）。
class PointerEventPolyfill extends MouseEvent {
  readonly pointerId: number
  constructor(type: string, params: PointerEventInit = {}) {
    super(type, params)
    this.pointerId = params.pointerId ?? 1
  }
}
// @ts-expect-error 测试环境 polyfill
globalThis.PointerEvent = PointerEventPolyfill
// @ts-expect-error 测试环境 polyfill
window.PointerEvent = PointerEventPolyfill
import { DataTable } from '../../../../../packages/admin-ui/src/components/data-table/data-table'
import type { TableColumn, TableQuerySnapshot, TableQueryPatch } from '../../../../../packages/admin-ui/src/components/data-table/types'

type Row = { id: string; name: string; url: string }
const ROWS: Row[] = [
  { id: '1', name: 'Alpha', url: 'https://example.com/very/long/path/aaaaaaaaaaaa' },
  { id: '2', name: 'Beta', url: 'x' },
]
const COLUMNS: TableColumn<Row>[] = [
  { id: 'name', header: 'Name', accessor: (r) => r.name, width: 120, minWidth: 80, maxWidth: 300, enableSorting: true },
  { id: 'url', header: 'URL', accessor: (r) => r.url },                        // flex（最后未定宽非 action）
  { id: 'act', header: '', kind: 'action', accessor: () => null, cell: () => <button>x</button> },
]
function snap(cols?: Map<string, { visible: boolean; width?: number }>): TableQuerySnapshot {
  return {
    pagination: { page: 1, pageSize: 20 },
    sort: { field: undefined, direction: 'asc' },
    filters: new Map(),
    columns: cols ?? new Map(COLUMNS.map((c) => [c.id, { visible: true }])),
    selection: { selectedKeys: new Set(), mode: 'page' },
  }
}
function renderDT(onQueryChange = vi.fn<(p: TableQueryPatch) => void>()) {
  const utils = render(
    <DataTable rows={ROWS} columns={COLUMNS} rowKey={(r) => r.id} mode="client" query={snap()} onQueryChange={onQueryChange} enableColumnResizing />,
  )
  return { ...utils, onQueryChange }
}
function handleFor(container: HTMLElement, colId: string): HTMLElement {
  const h = container.querySelector(`[data-testid="dt-resize-handle-${colId}"]`) as HTMLElement
  // jsdom 无 setPointerCapture 真实实现 → stub 为 no-op 防抛
  h.setPointerCapture = () => {}
  h.releasePointerCapture = () => {}
  return h
}

beforeEach(() => { document.body.removeAttribute('data-dt-resizing') })

/**
 * mock document.createRange：getBoundingClientRect 按 selectNodeContents 节点的 data-col-id 返回内容几何宽
 * （DTR-F-FIX4：auto-fit 测量改 Range / jsdom 无 layout 需 mock）。返回 spy，调用方 finally restore。
 */
function mockRangeByCol(widthByColId: Record<string, number>) {
  return vi.spyOn(document, 'createRange').mockImplementation(() => {
    let node: HTMLElement | null = null
    return {
      selectNodeContents(n: Node) { node = n as HTMLElement },
      getBoundingClientRect: () => ({ width: widthByColId[node?.getAttribute?.('data-col-id') ?? ''] ?? 0 }),
    } as unknown as Range
  })
}

describe('handle 渲染门控', () => {
  it('仅可调非 flex/非 action 列出 handle', () => {
    const { container } = renderDT()
    expect(container.querySelector('[data-testid="dt-resize-handle-name"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="dt-resize-handle-url"]')).toBeNull()  // flex
    expect(container.querySelector('[data-testid="dt-resize-handle-act"]')).toBeNull()  // action
  })
  it('handle a11y：role=separator + aria-valuenow/min/max + label', () => {
    const { container } = renderDT()
    const h = container.querySelector('[data-testid="dt-resize-handle-name"]')!
    expect(h.getAttribute('role')).toBe('separator')
    expect(h.getAttribute('aria-orientation')).toBe('vertical')
    expect(h.getAttribute('aria-valuenow')).toBe('120')
    expect(h.getAttribute('aria-valuemin')).toBe('80')
    expect(h.getAttribute('aria-valuemax')).toBe('300')
    expect(h.getAttribute('aria-label')).toContain('Name')
    expect(h.getAttribute('tabindex')).toBe('0')
  })
})

describe('拖拽', () => {
  it('pointerdown→move→up 提交新宽（120+60=180）', () => {
    const { container, onQueryChange } = renderDT()
    const h = handleFor(container, 'name')
    fireEvent.pointerDown(h, { button: 0, pointerId: 1, clientX: 200 })
    fireEvent.pointerMove(h, { pointerId: 1, clientX: 260 })
    fireEvent.pointerUp(h, { pointerId: 1, clientX: 260 })
    expect(onQueryChange).toHaveBeenCalledTimes(1)
    expect(onQueryChange.mock.calls[0][0].columns?.get('name')?.width).toBe(180)
    expect(document.body.hasAttribute('data-dt-resizing')).toBe(false) // up 后解除标记
  })
  it('拖拽钳制到 maxWidth（300）', () => {
    const { container, onQueryChange } = renderDT()
    const h = handleFor(container, 'name')
    fireEvent.pointerDown(h, { button: 0, pointerId: 1, clientX: 0 })
    fireEvent.pointerMove(h, { pointerId: 1, clientX: 9999 })
    fireEvent.pointerUp(h, { pointerId: 1, clientX: 9999 })
    expect(onQueryChange.mock.calls[0][0].columns?.get('name')?.width).toBe(300)
  })
  it('pointercancel 回滚（不提交）', () => {
    const { container, onQueryChange } = renderDT()
    const h = handleFor(container, 'name')
    fireEvent.pointerDown(h, { button: 0, pointerId: 1, clientX: 200 })
    fireEvent.pointerMove(h, { pointerId: 1, clientX: 260 })
    fireEvent.pointerCancel(h, { pointerId: 1 })
    expect(onQueryChange).not.toHaveBeenCalled()
    expect(document.body.hasAttribute('data-dt-resizing')).toBe(false)
  })
  it('非主键（button!=0）不触发拖拽', () => {
    const { container, onQueryChange } = renderDT()
    const h = handleFor(container, 'name')
    fireEvent.pointerDown(h, { button: 2, pointerId: 1, clientX: 200 })
    fireEvent.pointerMove(h, { pointerId: 1, clientX: 260 })
    fireEvent.pointerUp(h, { pointerId: 1, clientX: 260 })
    expect(onQueryChange).not.toHaveBeenCalled()
  })
})

describe('键盘', () => {
  const cases: [string, Record<string, unknown>, number][] = [
    ['ArrowRight +8', { key: 'ArrowRight' }, 128],
    ['ArrowLeft -8', { key: 'ArrowLeft' }, 112],
    ['Shift+ArrowRight +32', { key: 'ArrowRight', shiftKey: true }, 152],
    ['Home→min', { key: 'Home' }, 80],
    ['End→max', { key: 'End' }, 300],
  ]
  for (const [name, init, expected] of cases) {
    it(name, () => {
      const { container, onQueryChange } = renderDT()
      fireEvent.keyDown(handleFor(container, 'name'), init)
      expect(onQueryChange.mock.calls[0][0].columns?.get('name')?.width).toBe(expected)
    })
  }
  it('End 在无 maxWidth 列 → no-op', () => {
    const cols: TableColumn<Row>[] = [
      { id: 'name', header: 'Name', accessor: (r) => r.name, width: 120 },
      { id: 'url', header: 'URL', accessor: (r) => r.url },
    ]
    const onQueryChange = vi.fn<(p: TableQueryPatch) => void>()
    const { container } = render(
      <DataTable rows={ROWS} columns={cols} rowKey={(r) => r.id} mode="client" query={snap(new Map(cols.map((c) => [c.id, { visible: true }])))} onQueryChange={onQueryChange} enableColumnResizing />,
    )
    fireEvent.keyDown(handleFor(container, 'name'), { key: 'End' })
    expect(onQueryChange).not.toHaveBeenCalled()
  })
})

describe('双击 auto-fit', () => {
  it('测当前页内容几何宽 + padding 提交（Range mock）', () => {
    const { container, onQueryChange } = renderDT()
    const spy = mockRangeByCol({ name: 200 }) // 内容几何宽 200
    try {
      fireEvent.doubleClick(handleFor(container, 'name'))
      // 200 + AUTOFIT_PADDING_X(24) = 224，钳到 [80,300]
      expect(onQueryChange.mock.calls[0][0].columns?.get('name')?.width).toBe(224)
    } finally { spy.mockRestore() }
  })
  it('测不到内容（Range 0）→ 不提交', () => {
    const { container, onQueryChange } = renderDT()
    fireEvent.doubleClick(handleFor(container, 'name')) // 未 mock Range → jsdom 0
    expect(onQueryChange).not.toHaveBeenCalled()
  })
})

describe('截断 + title', () => {
  it('header label 包 data-dt-truncate + title', () => {
    const { container } = renderDT()
    const span = container.querySelector('[role="columnheader"] [data-dt-truncate][data-col-id="name"]') as HTMLElement
    expect(span).toBeTruthy()
    expect(span.getAttribute('title')).toBe('Name')
  })
  it('body 默认字符串 cell 包 truncate + title（完整文本）', () => {
    const { container } = renderDT()
    const cell = container.querySelector('[role="cell"][data-col-id="url"] [data-dt-truncate]') as HTMLElement
    expect(cell).toBeTruthy()
    expect(cell.getAttribute('title')).toContain('https://example.com')
  })
})

describe('不触发表头排序（stopPropagation）', () => {
  it('click handle 不触发 sort', () => {
    const { container, onQueryChange } = renderDT()
    fireEvent.click(handleFor(container, 'name'))
    expect(onQueryChange).not.toHaveBeenCalled()
  })
  it('键盘调宽提交的是 columns 不是 sort', () => {
    const { container, onQueryChange } = renderDT()
    fireEvent.keyDown(handleFor(container, 'name'), { key: 'ArrowRight' })
    expect(onQueryChange.mock.calls[0][0].sort).toBeUndefined()
    expect(onQueryChange.mock.calls[0][0].columns).toBeDefined()
  })
})

describe('自适应列宽（矩阵 popover / DTR-F）', () => {
  it('打开矩阵 → 点击「自适应列宽」按内容几何宽 auto-fit 全列（Range mock），保留 visible', () => {
    const onQueryChange = vi.fn<(p: TableQueryPatch) => void>()
    const cols = new Map([['name', { visible: true, width: 250 }], ['url', { visible: true, width: 200 }], ['act', { visible: true }]])
    const { getByTestId } = render(
      <DataTable rows={ROWS} columns={COLUMNS} rowKey={(r) => r.id} mode="client" query={snap(cols)} onQueryChange={onQueryChange} enableColumnResizing />,
    )
    const spy = mockRangeByCol({ name: 100, url: 160 })
    try {
      fireEvent.click(getByTestId('matrix-trigger'))
      fireEvent.click(document.querySelector('[data-testid="matrix-foot-reset-widths"]') as HTMLElement)
      const patched = onQueryChange.mock.calls[0][0].columns!
      expect(patched.get('name')).toEqual({ visible: true, width: 124 })  // clamp(100+24, [80,300])
      expect(patched.get('url')).toEqual({ visible: true, width: 184 })   // clamp(160+24, min 80)
      // act 是 action 未 opt-in → 不可调 → 保持原状（无 width）
      expect(patched.get('act')).toEqual({ visible: true })
    } finally { spy.mockRestore() }
  })
  it('全测不到内容（Range 0）→ 不提交', () => {
    const onQueryChange = vi.fn<(p: TableQueryPatch) => void>()
    const { getByTestId } = render(
      <DataTable rows={ROWS} columns={COLUMNS} rowKey={(r) => r.id} mode="client" query={snap()} onQueryChange={onQueryChange} enableColumnResizing />,
    )
    fireEvent.click(getByTestId('matrix-trigger'))
    fireEvent.click(document.querySelector('[data-testid="matrix-foot-reset-widths"]') as HTMLElement)
    expect(onQueryChange).not.toHaveBeenCalled()
  })
})

describe('legacy（未开启列宽可调）零变化', () => {
  it('无 handle / 无截断 span / 无 --dt-grid-template', () => {
    const { container } = render(
      <DataTable rows={ROWS} columns={COLUMNS} rowKey={(r) => r.id} mode="client" query={snap()} onQueryChange={() => {}} />,
    )
    expect(container.querySelector('[data-dt-resize-handle]')).toBeNull()
    expect(container.querySelector('[data-dt-truncate]')).toBeNull()
    expect((container.querySelector('[data-table]') as HTMLElement).style.getPropertyValue('--dt-grid-template')).toBe('')
  })
})
