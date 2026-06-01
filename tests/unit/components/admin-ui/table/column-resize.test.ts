/**
 * column-resize.test.ts — DataTable 列宽可调纯函数单测（DTR-E / SEQ-20260531-01）
 * 覆盖：clampWidth / pickFlexColumnId 双分支 / buildResizableGridTemplate(flex-last) +
 *   legacy buildGridTemplate / 加载期钳制 / override 预览 / isResizableColumn /
 *   resolveColumnWidth / measureColumnContentWidth / column-visibility setColumnWidth + resetColumnWidths。
 */
import { describe, it, expect } from 'vitest'
import {
  clampWidth, pickFlexColumnId, buildResizableGridTemplate, isResizableColumn,
  resolveColumnWidth, measureColumnContentWidth, columnMinWidth,
  DEFAULT_COL_W, DEFAULT_COL_MIN_W,
} from '../../../../../packages/admin-ui/src/components/data-table/column-resize'
import { buildGridTemplate, SELECTION_COL_W } from '../../../../../packages/admin-ui/src/components/data-table/data-table-grid'
import { setColumnWidth, resetColumnWidths } from '../../../../../packages/admin-ui/src/components/data-table/column-visibility'
import type { TableColumn, ColumnPreference } from '../../../../../packages/admin-ui/src/components/data-table/types'

type Row = { id: string }
const COLS: TableColumn<Row>[] = [
  { id: 'a', header: 'A', accessor: () => '', width: 120, minWidth: 60 },
  { id: 'b', header: 'B', accessor: () => '' },                            // 未定宽
  { id: 'act', header: '', kind: 'action', accessor: () => null },        // action
]
const ALL_VISIBLE = (): Map<string, ColumnPreference> =>
  new Map(COLS.map((c) => [c.id, { visible: true }]))

describe('clampWidth', () => {
  it('下限钳制（不低于 min，至少 1）', () => {
    expect(clampWidth(10, 80)).toBe(80)
    expect(clampWidth(-5, 0)).toBe(1)
  })
  it('上限钳制（仅有限正数生效）', () => {
    expect(clampWidth(500, 80, 200)).toBe(200)
    expect(clampWidth(500, 80, Infinity)).toBe(500)
    expect(clampWidth(500, 80, NaN)).toBe(500)
  })
  it('取整（亚像素）', () => {
    expect(clampWidth(123.4, 80)).toBe(123)
    expect(clampWidth(123.6, 80)).toBe(124)
  })
  it('max < min 时下限优先', () => {
    expect(clampWidth(10, 100, 50)).toBe(100)
  })
})

describe('columnMinWidth', () => {
  it('取 col.minWidth 否则默认', () => {
    expect(columnMinWidth(COLS[0])).toBe(60)
    expect(columnMinWidth(COLS[1])).toBe(DEFAULT_COL_MIN_W)
  })
})

describe('pickFlexColumnId', () => {
  it('最后一个可见非 action 且未定宽列', () => {
    // a 定宽 / b 未定宽 / act action → flex = b
    expect(pickFlexColumnId(COLS, ALL_VISIBLE())).toBe('b')
  })
  it('末位可见非 action 列已定宽 → null', () => {
    const m = new Map<string, ColumnPreference>([['a', { visible: true }], ['b', { visible: true, width: 300 }], ['act', { visible: true }]])
    expect(pickFlexColumnId(COLS, m)).toBeNull()
  })
  it('无非 action 可见列 → null', () => {
    const onlyAction: TableColumn<Row>[] = [{ id: 'act', header: '', kind: 'action', accessor: () => null }]
    expect(pickFlexColumnId(onlyAction, new Map([['act', { visible: true }]]))).toBeNull()
  })
  it('隐藏的末列不计入（取前一个可见未定宽列）', () => {
    const m = new Map<string, ColumnPreference>([['a', { visible: true }], ['b', { visible: false }], ['act', { visible: true }]])
    // b 隐藏 → 最后可见非 action 是 a（未定宽，因 pref 无 width 覆盖 col.width=120？a 有 col.width=120 → 定宽 → null）
    expect(pickFlexColumnId(COLS, m)).toBeNull()
  })
})

describe('buildResizableGridTemplate (flex-last)', () => {
  it('fixed-left + flex 列 minmax', () => {
    expect(buildResizableGridTemplate(COLS, ALL_VISIBLE(), false, 'b')).toBe('120px minmax(80px, 1fr) 160px')
  })
  it('hasSelection 前置 selection 轨', () => {
    expect(buildResizableGridTemplate(COLS, ALL_VISIBLE(), true, 'b')).toBe(`${SELECTION_COL_W}px 120px minmax(80px, 1fr) 160px`)
  })
  it('无 flex 列 → 末尾占位轨 minmax(0,1fr)', () => {
    const m = new Map<string, ColumnPreference>([['a', { visible: true, width: 120 }], ['b', { visible: true, width: 300 }], ['act', { visible: true }]])
    expect(buildResizableGridTemplate(COLS, m, false, null)).toBe('120px 300px 160px minmax(0, 1fr)')
  })
  it('override 预览替换指定列固定宽', () => {
    expect(buildResizableGridTemplate(COLS, ALL_VISIBLE(), false, 'b', { colId: 'a', width: 999 })).toBe('999px minmax(80px, 1fr) 160px')
  })
  it('加载期钳制：stored width 越界按 min/max 钳', () => {
    const cols: TableColumn<Row>[] = [{ id: 'a', header: 'A', accessor: () => '', minWidth: 100, maxWidth: 300 }]
    const tooBig = new Map<string, ColumnPreference>([['a', { visible: true, width: 9999 }]])
    expect(buildResizableGridTemplate(cols, tooBig, false, null)).toBe('300px minmax(0, 1fr)')
    const tooSmall = new Map<string, ColumnPreference>([['a', { visible: true, width: 10 }]])
    expect(buildResizableGridTemplate(cols, tooSmall, false, null)).toBe('100px minmax(0, 1fr)')
  })
  it('隐藏列不出轨', () => {
    const m = new Map<string, ColumnPreference>([['a', { visible: false }], ['b', { visible: true }], ['act', { visible: true }]])
    expect(buildResizableGridTemplate(COLS, m, false, 'b')).toBe('minmax(80px, 1fr) 160px')
  })
})

describe('legacy buildGridTemplate (C2 零改动验证)', () => {
  it('有 width 列渲染 px / 无 width 列 minmax(min,1fr)', () => {
    expect(buildGridTemplate(COLS, ALL_VISIBLE(), false)).toBe('120px minmax(80px, 1fr) minmax(80px, 1fr)')
  })
  it('legacy 允许多个 1fr 弹性列（与 flex-last 区别）', () => {
    const cols: TableColumn<Row>[] = [{ id: 'x', header: 'X', accessor: () => '' }, { id: 'y', header: 'Y', accessor: () => '' }]
    expect(buildGridTemplate(cols, new Map([['x', { visible: true }], ['y', { visible: true }]]), false)).toBe('minmax(80px, 1fr) minmax(80px, 1fr)')
  })
})

describe('isResizableColumn', () => {
  it('flex 列 / action 列不可调；enableResizing=false 不可调', () => {
    expect(isResizableColumn(COLS[0], 'b')).toBe(true)    // a 非 flex 非 action
    expect(isResizableColumn(COLS[1], 'b')).toBe(false)   // b 是 flex
    expect(isResizableColumn(COLS[2], 'b')).toBe(false)   // act action
    expect(isResizableColumn({ id: 'z', header: 'Z', accessor: () => '', enableResizing: false }, 'b')).toBe(false)
  })
})

describe('resolveColumnWidth', () => {
  it('pref.width 优先，钳制到 [min,max]', () => {
    expect(resolveColumnWidth(COLS[0], new Map([['a', { visible: true, width: 250 }]]))).toBe(250)
    expect(resolveColumnWidth(COLS[0], ALL_VISIBLE())).toBe(120) // col.width
    expect(resolveColumnWidth(COLS[1], ALL_VISIBLE())).toBe(DEFAULT_COL_W) // 无 width/minWidth → 默认
  })
})

describe('measureColumnContentWidth', () => {
  it('扫描 data-col-id cell 内 truncate scrollWidth 取最大', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div data-col-id="a"><span data-dt-truncate></span></div>
      <div data-col-id="a"><span data-dt-truncate></span></div>
      <div data-col-id="b"></div>`
    const spans = root.querySelectorAll('[data-dt-truncate]')
    Object.defineProperty(spans[0], 'scrollWidth', { value: 80 })
    Object.defineProperty(spans[1], 'scrollWidth', { value: 150 })
    expect(measureColumnContentWidth(root, 'a')).toBe(150)
  })
  it('无 DOM / 无命中 → 0', () => {
    expect(measureColumnContentWidth(null, 'a')).toBe(0)
    expect(measureColumnContentWidth(document.createElement('div'), 'zzz')).toBe(0)
  })
})

describe('column-visibility setColumnWidth / resetColumnWidths', () => {
  it('setColumnWidth 返回全量 map 保留 visible', () => {
    const next = setColumnWidth(ALL_VISIBLE(), 'a', 200, true)
    expect(next.size).toBe(3)
    expect(next.get('a')).toEqual({ visible: true, width: 200 })
    expect(next.get('b')).toEqual({ visible: true })
  })
  it('setColumnWidth 沿用既有 visible（即使 defaultVisible 兜底不同）', () => {
    const m = new Map<string, ColumnPreference>([['a', { visible: false }]])
    expect(setColumnWidth(m, 'a', 150, true).get('a')).toEqual({ visible: false, width: 150 })
  })
  it('setColumnWidth 缺列用 defaultVisible 兜底（C4）', () => {
    expect(setColumnWidth(new Map(), 'a', 150, false).get('a')).toEqual({ visible: false, width: 150 })
    expect(setColumnWidth(new Map(), 'a', 150).get('a')).toEqual({ visible: true, width: 150 })
  })
  it('resetColumnWidths 清 width 保留 visible', () => {
    const m = new Map<string, ColumnPreference>([['a', { visible: false, width: 200 }], ['b', { visible: true, width: 300 }]])
    const next = resetColumnWidths(COLS, m)
    expect(next.get('a')).toEqual({ visible: false })
    expect(next.get('b')).toEqual({ visible: true })
    expect([...next.values()].every((p) => p.width === undefined)).toBe(true)
  })
})
