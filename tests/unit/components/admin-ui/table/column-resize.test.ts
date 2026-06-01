/**
 * column-resize.test.ts — DataTable 列宽可调纯函数单测（DTR-E / SEQ-20260531-01）
 * 覆盖：clampWidth / pickFlexColumnId 双分支 / buildResizableGridTemplate(flex-last) +
 *   legacy buildGridTemplate / 加载期钳制 / override 预览 / isResizableColumn /
 *   resolveColumnWidth / measureColumnContentWidth / column-visibility setColumnWidth + resetColumnWidths。
 */
import { describe, it, expect } from 'vitest'
import {
  clampWidth, pickFlexColumnId, buildResizableGridTemplate, isResizableColumn,
  resolveColumnWidth, measureColumnContentWidth, columnMinWidth, buildAutoFitColumnMap,
  DEFAULT_COL_W, DEFAULT_COL_MIN_W, AUTOFIT_PADDING_X,
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
  it('flex 列不可调；data 列 enableResizing=false 不可调', () => {
    expect(isResizableColumn(COLS[0], 'b')).toBe(true)    // a 非 flex 非 action
    expect(isResizableColumn(COLS[1], 'b')).toBe(false)   // b 是 flex
    expect(isResizableColumn({ id: 'z', header: 'Z', accessor: () => '', enableResizing: false }, 'b')).toBe(false)
  })
  it('DTR-F：action 列 opt-in —— 默认不可调，显式 enableResizing:true 才可调', () => {
    // 未写 enableResizing 的 action 列 → 不可调（零回归其他消费表）
    expect(isResizableColumn(COLS[2], 'b')).toBe(false)
    // 显式 true → 可调
    expect(isResizableColumn({ id: 'act2', header: '', kind: 'action', accessor: () => null, enableResizing: true }, 'b')).toBe(true)
    // 显式 false → 不可调
    expect(isResizableColumn({ id: 'act3', header: '', kind: 'action', accessor: () => null, enableResizing: false }, 'b')).toBe(false)
  })
})

describe('buildAutoFitColumnMap (DTR-F)', () => {
  it('对测到内容的可调列写 clamp(content+padding)，保留 visible', () => {
    const next = buildAutoFitColumnMap(COLS, ALL_VISIBLE(), new Map([['a', 100]]))
    // a: clamp(100+24, min 60, max∞) = 124
    expect(next.get('a')).toEqual({ visible: true, width: 100 + AUTOFIT_PADDING_X })
  })
  it('测不到内容（<=0 / 缺失）的列保持原 colMap 条目，不兜底', () => {
    const colMap = new Map<string, ColumnPreference>([['a', { visible: true, width: 200 }], ['b', { visible: true }], ['act', { visible: true }]])
    const next = buildAutoFitColumnMap(COLS, colMap, new Map([['a', 0]])) // a 测得 0
    expect(next.get('a')).toEqual({ visible: true, width: 200 })   // 保持原宽，不写
    expect(next.get('b')).toEqual({ visible: true })               // b 未测到 → 原状
  })
  it('flex 列也能被写宽（F3：isWidthAdjustable 不排除 flex）', () => {
    const next = buildAutoFitColumnMap(COLS, ALL_VISIBLE(), new Map([['b', 90]]))
    // b 即便当前是 flex 列，measured>0 → 写宽 clamp(90+24, min 80) = 114
    expect(next.get('b')).toEqual({ visible: true, width: 114 })
  })
  it('action 列默认不写（opt-in）；钳制到 [min,max]', () => {
    const cols: TableColumn<Row>[] = [
      { id: 'a', header: 'A', accessor: () => '', minWidth: 100, maxWidth: 150 },
      { id: 'act', header: '', kind: 'action', accessor: () => null }, // 未 opt-in
    ]
    const next = buildAutoFitColumnMap(cols, new Map([['a', { visible: true }], ['act', { visible: true }]]), new Map([['a', 9999], ['act', 9999]]))
    expect(next.get('a')).toEqual({ visible: true, width: 150 })  // 钳到 maxWidth
    expect(next.get('act')).toEqual({ visible: true })            // action 未 opt-in → 不写
  })
  it('action 列 opt-in（enableResizing:true）则参与 auto-fit', () => {
    const cols: TableColumn<Row>[] = [
      { id: 'act', header: '', kind: 'action', accessor: () => null, enableResizing: true, minWidth: 80 },
    ]
    const next = buildAutoFitColumnMap(cols, new Map([['act', { visible: true }]]), new Map([['act', 100]]))
    expect(next.get('act')).toEqual({ visible: true, width: 124 }) // clamp(100+24, min 80)
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
  it('DTR-F-FIX1：自定义 cell 测最宽后代内容，不测 overflow:hidden 的 wrapper 自身（修 pill 列过宽）', () => {
    const root = document.createElement('div')
    root.innerHTML = `<div data-col-id="p"><span class="pill"></span></div>`
    const wrapper = root.querySelector('[data-col-id="p"]')!
    const pill = root.querySelector('.pill')!
    Object.defineProperty(wrapper, 'scrollWidth', { value: 200 }) // = 当前列宽（不该用）
    Object.defineProperty(pill, 'scrollWidth', { value: 60 })     // 内容真实宽
    expect(measureColumnContentWidth(root, 'p')).toBe(60)         // 取内容宽，非 wrapper 200
  })
  it('DTR-F-FIX1：表头 label（本身是 data-dt-truncate）测自身 scrollWidth', () => {
    const root = document.createElement('div')
    root.innerHTML = `<span data-dt-truncate data-col-id="h"></span>`
    Object.defineProperty(root.querySelector('[data-col-id="h"]')!, 'scrollWidth', { value: 42 })
    expect(measureColumnContentWidth(root, 'h')).toBe(42)
  })
  it('DTR-F-FIX1：跳过 resize handle（非内容）', () => {
    const root = document.createElement('div')
    root.innerHTML = `<span data-dt-resize-handle data-col-id="x"></span><div data-col-id="x"><span class="c"></span></div>`
    Object.defineProperty(root.querySelector('[data-dt-resize-handle]')!, 'scrollWidth', { value: 8 })
    Object.defineProperty(root.querySelector('.c')!, 'scrollWidth', { value: 70 })
    expect(measureColumnContentWidth(root, 'x')).toBe(70) // handle 8 跳过，取内容 70
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
