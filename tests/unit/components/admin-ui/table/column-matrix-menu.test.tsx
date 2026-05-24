/**
 * ColumnMatrixMenu 单测（ADR-149 / CHG-SN-9-DT-HEADER-REDESIGN-EP-1）
 *
 * 覆盖维度（ADR-149 §7 测试 surface）：
 *   - 基础渲染（open / dialog / grid / 行数 / 列名 / SSR）
 *   - 可见性 cell（switch / pinned 锁定 / canHide / toggle 触发）
 *   - 过滤 cell（无 filterContent 灰化 / 已过滤 / filterSummary 摘要 / 关闭=清除）
 *   - 排序 cell（不支持灰化 / radiogroup / ↑↓× 互斥 / × 清除）
 *   - 底部批量操作（清除全部过滤 / 清除排序 / 恢复默认）
 *   - a11y（dialog / grid / switch / radiogroup ARIA）
 *   - 键盘 + 焦点（ESC / 点击外部 / 方向键 grid 内移动）
 *   - 位置 + 关闭按钮
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React, { createRef } from 'react'
import { ColumnMatrixMenu } from '../../../../../packages/admin-ui/src/components/data-table/column-matrix-menu'
import type {
  ColumnDescriptor,
  ColumnMenuConfig,
  ColumnPreference,
  FilterValue,
  TableSortState,
} from '../../../../../packages/admin-ui/src/components/data-table/types'

// ── fixtures ─────────────────────────────────────────────────────

const COLUMNS: ColumnDescriptor[] = [
  { id: 'id', header: 'ID', pinned: true },
  { id: 'title', header: '标题', enableSorting: true },
  { id: 'type', header: '类型', enableSorting: true },
  { id: 'score', header: '评分', enableSorting: true },
  { id: 'country', header: '国家' }, // 不可排序
  { id: 'actions', header: '操作', pinned: true }, // pinned + 不可操作
]

const ALL_VISIBLE: ReadonlyMap<string, ColumnPreference> = new Map([
  ['id', { visible: true }],
  ['title', { visible: true }],
  ['type', { visible: true }],
  ['score', { visible: true }],
  ['country', { visible: true }],
  ['actions', { visible: true }],
])

const NO_SORT: TableSortState = { field: undefined, direction: 'asc' }
const SORT_TITLE_ASC: TableSortState = { field: 'title', direction: 'asc' }
const SORT_SCORE_DESC: TableSortState = { field: 'score', direction: 'desc' }

const EMPTY_FILTERS: ReadonlyMap<string, FilterValue> = new Map()

const COLUMN_MENUS_BASE: ReadonlyMap<string, ColumnMenuConfig> = new Map([
  ['title', { filterContent: <input data-testid="title-filter-input" /> }],
  ['type', { filterContent: <select data-testid="type-filter-select" /> }],
  ['score', { filterContent: <input data-testid="score-filter-input" />, filterSummary: '8.0-10.0' }],
  // country / id / actions 无 filterContent → 矩阵过滤格灰化
])

function makeAnchorRef(): React.RefObject<HTMLElement | null> {
  const ref = createRef<HTMLElement>()
  // jsdom 下让 anchor 实际存在；使用 createElement 后 ref 设置（不附 document）
  const el = document.createElement('button')
  el.getBoundingClientRect = (() =>
    ({ top: 100, left: 200, bottom: 124, right: 300, width: 100, height: 24, x: 200, y: 100, toJSON: () => ({}) }) as DOMRect) as unknown as () => DOMRect
  ;(ref as React.MutableRefObject<HTMLElement | null>).current = el
  return ref
}

function noop(): void {}

// ── 1. 基础渲染（~5 用例） ─────────────────────────────────────────

describe('ColumnMatrixMenu — 基础渲染', () => {
  it('open=false → 不渲染任何 portal 内容', () => {
    render(
      <ColumnMatrixMenu
        open={false}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    expect(document.querySelector('[data-column-matrix-menu]')).toBeNull()
  })

  it('open=true → 渲染 dialog + grid + header + foot 三段', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const dialog = document.querySelector('[data-column-matrix-menu]')
    expect(dialog).toBeTruthy()
    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.getAttribute('aria-label')).toBe('列设置')
    expect(document.querySelector('[data-column-matrix-grid]')).toBeTruthy()
    expect(screen.getByTestId('column-matrix-close')).toBeTruthy()
    expect(screen.getByTestId('matrix-foot-clear-filters')).toBeTruthy()
  })

  it('行数 = columns.length（每列一行）', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const rows = document.querySelectorAll('[data-column-matrix-grid] tbody tr')
    expect(rows.length).toBe(COLUMNS.length)
  })

  it('列名 rowheader 渲染正确（含 pinned）', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const rowHeaders = document.querySelectorAll('[role="rowheader"]')
    expect(rowHeaders.length).toBe(COLUMNS.length)
    expect(rowHeaders[0].textContent).toBe('ID')
    expect(rowHeaders[1].textContent).toBe('标题')
    expect(rowHeaders[5].textContent).toBe('操作')
  })

  it('SSR 零 throw（open=true 在 server 端不报错）', () => {
    expect(() =>
      renderToString(
        <ColumnMatrixMenu
          open={true}
          columns={COLUMNS}
          columnMenus={COLUMN_MENUS_BASE}
          columnsValue={ALL_VISIBLE}
          currentSort={NO_SORT}
          currentFilters={EMPTY_FILTERS}
          anchorRef={makeAnchorRef()}
          onColumnsChange={noop}
          onClearColumnFilter={noop}
          onSort={noop}
          onClearSort={noop}
          onClearAllFilters={noop}
          onResetColumnVisibility={noop}
          onClose={noop}
        />,
      ),
    ).not.toThrow()
  })
})

// ── 2. 可见性 cell（~5 用例） ─────────────────────────────────────

describe('ColumnMatrixMenu — 可见性 cell', () => {
  it('非 pinned 列渲染 switch + aria-checked=true（visible）', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const titleSwitch = screen.getByTestId('matrix-visibility-title')
    expect(titleSwitch.getAttribute('role')).toBe('switch')
    expect(titleSwitch.getAttribute('aria-checked')).toBe('true')
  })

  it('pinned 列渲染 🔒 锁定 + aria-disabled', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const idLock = screen.getByTestId('matrix-visibility-locked-id')
    expect(idLock.textContent).toBe('🔒')
    expect(idLock.getAttribute('aria-disabled')).toBe('true')
    // 非 pinned 列不出现 locked tag
    expect(screen.queryByTestId('matrix-visibility-locked-title')).toBeNull()
  })

  it('点 switch 触发 onColumnsChange + 正确 patch（隐藏 type）', () => {
    const onColumnsChange = vi.fn<(next: ReadonlyMap<string, ColumnPreference>) => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={onColumnsChange}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-visibility-type'))
    expect(onColumnsChange).toHaveBeenCalledTimes(1)
    const patch = onColumnsChange.mock.calls[0][0]
    expect(patch.get('type')).toEqual({ visible: false })
  })

  it('隐藏列再次 toggle 恢复（visible: false → true）', () => {
    const ONE_HIDDEN = new Map([...ALL_VISIBLE, ['type', { visible: false }]])
    const onColumnsChange = vi.fn<(next: ReadonlyMap<string, ColumnPreference>) => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ONE_HIDDEN}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={onColumnsChange}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const typeSwitch = screen.getByTestId('matrix-visibility-type')
    expect(typeSwitch.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(typeSwitch)
    expect(onColumnsChange.mock.calls[0][0].get('type')).toEqual({ visible: true })
  })

  it('canHide=false 列 → switch disabled', () => {
    const columnMenusCanHideFalse = new Map([
      ...COLUMN_MENUS_BASE,
      ['country', { canHide: false }] as [string, ColumnMenuConfig],
    ])
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={columnMenusCanHideFalse}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const countrySwitch = screen.getByTestId('matrix-visibility-country')
    expect(countrySwitch.hasAttribute('disabled')).toBe(true)
  })
})

// ── 3. 过滤 cell（~6 用例） ───────────────────────────────────────

describe('ColumnMatrixMenu — 过滤 cell', () => {
  it('无 filterContent 列 → 渲染 "—" + aria-disabled', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const countryUnsupported = screen.getByTestId('matrix-filter-unsupported-country')
    expect(countryUnsupported.textContent).toBe('—')
    expect(countryUnsupported.getAttribute('aria-disabled')).toBe('true')
  })

  it('有 filterContent 列 → 渲染 switch（未过滤 aria-checked=false / EP-4.5-HOTFIX-3 disabled + title tooltip / EP-4.5-HOTFIX-4 可见 hint）', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const titleFilter = screen.getByTestId('matrix-filter-title')
    expect(titleFilter.getAttribute('role')).toBe('switch')
    expect(titleFilter.getAttribute('aria-checked')).toBe('false')
    // EP-4.5-HOTFIX-3 / 问题 2：未过滤 + 有 filterContent → switch disabled + title tooltip 提示
    expect((titleFilter as HTMLButtonElement).disabled).toBe(true)
    expect(titleFilter.getAttribute('aria-disabled')).toBe('true')
    expect(titleFilter.getAttribute('title')).toContain('编辑过滤值')
    // EP-4.5-HOTFIX-4：未过滤 + 有 filterContent → 渲染可见 hint 文本（无需 hover）
    const titleHint = screen.getByTestId('matrix-filter-hint-title')
    expect(titleHint.textContent).toBe('列名 ⋯ 编辑')
  })

  it('已过滤列 → switch enabled（可点击关闭清除过滤）/ 不渲染 hint', () => {
    const filtersWithTitle: ReadonlyMap<string, FilterValue> = new Map([
      ['title', { kind: 'text', value: '黑客' } as FilterValue],
    ])
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={filtersWithTitle}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const titleFilter = screen.getByTestId('matrix-filter-title')
    expect((titleFilter as HTMLButtonElement).disabled).toBe(false)
    expect(titleFilter.getAttribute('aria-disabled')).toBeNull()
    expect(titleFilter.getAttribute('title')).toBeNull()
    // EP-4.5-HOTFIX-4：已过滤列不渲染 hint（已有 ●─ + filterSummary 表明状态）
    expect(screen.queryByTestId('matrix-filter-hint-title')).toBeNull()
  })

  it('已过滤列（currentFilters 含 colId）→ switch aria-checked=true', () => {
    const filtersWithTitle: ReadonlyMap<string, FilterValue> = new Map([
      ['title', { kind: 'text', value: '黑客' } as FilterValue],
    ])
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={filtersWithTitle}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    expect(screen.getByTestId('matrix-filter-title').getAttribute('aria-checked')).toBe('true')
  })

  it('已过滤列显示 filterSummary 摘要文本（max-width + tooltip）', () => {
    const filtersWithScore: ReadonlyMap<string, FilterValue> = new Map([
      ['score', { kind: 'range', min: 8.0, max: 10.0 } as FilterValue],
    ])
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={filtersWithScore}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const summary = screen.getByTestId('matrix-filter-summary-score')
    expect(summary.textContent).toBe('8.0-10.0')
    expect(summary.getAttribute('title')).toBe('8.0-10.0')
  })

  it('filterSummary 缺省时显示"已过滤"占位', () => {
    const filtersWithTitle: ReadonlyMap<string, FilterValue> = new Map([
      ['title', { kind: 'text', value: '黑客' } as FilterValue],
    ])
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={filtersWithTitle}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    // title 在 COLUMN_MENUS_BASE 中无 filterSummary → 兜底"已过滤"
    const filterCell = document.querySelector('[data-matrix-row="title"] [data-matrix-filter-cell]')
    expect(filterCell?.textContent).toContain('已过滤')
  })

  it('关闭已过滤 switch → 触发 onClearColumnFilter(colId)', () => {
    const filtersWithTitle: ReadonlyMap<string, FilterValue> = new Map([
      ['title', { kind: 'text', value: '黑客' } as FilterValue],
    ])
    const onClearColumnFilter = vi.fn<(id: string) => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={filtersWithTitle}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={onClearColumnFilter}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-filter-title'))
    expect(onClearColumnFilter).toHaveBeenCalledWith('title')
  })

  it('columnMenu.onClearFilter 优先于 onClearColumnFilter（业务 key 不对齐场景）', () => {
    const businessClear = vi.fn<() => void>()
    const filtersEmpty: ReadonlyMap<string, FilterValue> = new Map()
    // 关键：业务 key 不在 currentFilters 中，靠 columnMenu.isFiltered=true 标记
    const customMenus = new Map([
      ...COLUMN_MENUS_BASE,
      [
        'title',
        {
          filterContent: <input />,
          isFiltered: true,
          onClearFilter: businessClear,
        } as ColumnMenuConfig,
      ],
    ])
    const onClearColumnFilter = vi.fn<(id: string) => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={customMenus}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={filtersEmpty}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={onClearColumnFilter}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-filter-title'))
    expect(businessClear).toHaveBeenCalledTimes(1)
    expect(onClearColumnFilter).not.toHaveBeenCalled()
  })
})

// ── 4. 排序 cell（~6 用例） ───────────────────────────────────────

describe('ColumnMatrixMenu — 排序 cell', () => {
  it('enableSorting=false 列 → "—" + aria-disabled', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const countryUnsupported = screen.getByTestId('matrix-sort-unsupported-country')
    expect(countryUnsupported.textContent).toBe('—')
    expect(countryUnsupported.getAttribute('aria-disabled')).toBe('true')
  })

  it('enableSorting=true 列 → radiogroup + 3 radio + 清除', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    expect(screen.getByTestId('matrix-sort-asc-title')).toBeTruthy()
    expect(screen.getByTestId('matrix-sort-desc-title')).toBeTruthy()
    expect(screen.getByTestId('matrix-sort-clear-title')).toBeTruthy()
    // radiogroup wrapper
    const titleRow = document.querySelector('[data-matrix-row="title"] [role="radiogroup"]')
    expect(titleRow).toBeTruthy()
  })

  it('点 ↑ 触发 onSort(colId, "asc")', () => {
    const onSort = vi.fn<(field: string, direction: 'asc' | 'desc') => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={onSort}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-sort-asc-title'))
    expect(onSort).toHaveBeenCalledWith('title', 'asc')
  })

  it('点 ↓ 触发 onSort(colId, "desc")', () => {
    const onSort = vi.fn<(field: string, direction: 'asc' | 'desc') => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={onSort}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-sort-desc-score'))
    expect(onSort).toHaveBeenCalledWith('score', 'desc')
  })

  it('当前已排序列 → ↑/↓ 对应 radio aria-checked=true', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={SORT_TITLE_ASC}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    expect(screen.getByTestId('matrix-sort-asc-title').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('matrix-sort-desc-title').getAttribute('aria-checked')).toBe('false')
  })

  it('已排序列再次点同方向 → 触发 onClearSort', () => {
    const onClearSort = vi.fn<() => void>()
    const onSort = vi.fn<(field: string, direction: 'asc' | 'desc') => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={SORT_SCORE_DESC}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={onSort}
        onClearSort={onClearSort}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-sort-desc-score'))
    expect(onClearSort).toHaveBeenCalledTimes(1)
    expect(onSort).not.toHaveBeenCalled()
  })

  it('点 × 触发 onClearSort（当前已排序）', () => {
    const onClearSort = vi.fn<() => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={SORT_TITLE_ASC}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={onClearSort}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-sort-clear-title'))
    expect(onClearSort).toHaveBeenCalledTimes(1)
  })

  it('未排序列点 × → disabled 不触发 onClearSort', () => {
    const onClearSort = vi.fn<() => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={onClearSort}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const clearBtn = screen.getByTestId('matrix-sort-clear-title')
    expect(clearBtn.hasAttribute('disabled')).toBe(true)
  })
})

// ── 5. 底部批量操作（~3 用例） ───────────────────────────────────

describe('ColumnMatrixMenu — 底部批量操作', () => {
  it('点"清除全部过滤" → onClearAllFilters', () => {
    const onClearAllFilters = vi.fn<() => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={onClearAllFilters}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-foot-clear-filters'))
    expect(onClearAllFilters).toHaveBeenCalledTimes(1)
  })

  it('点"清除排序" → onClearSort', () => {
    const onClearSort = vi.fn<() => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={onClearSort}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-foot-clear-sort'))
    expect(onClearSort).toHaveBeenCalledTimes(1)
  })

  it('点"恢复默认列可见性" → onResetColumnVisibility', () => {
    const onResetColumnVisibility = vi.fn<() => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={onResetColumnVisibility}
        onClose={noop}
      />,
    )
    fireEvent.click(screen.getByTestId('matrix-foot-reset-visibility'))
    expect(onResetColumnVisibility).toHaveBeenCalledTimes(1)
  })
})

// ── 6. a11y（~4 用例） ───────────────────────────────────────────

describe('ColumnMatrixMenu — a11y', () => {
  it('role=dialog + aria-modal=false + aria-label', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('false')
    expect(dialog.getAttribute('aria-label')).toBe('列设置')
  })

  it('role=grid + aria-rowcount + 4 columnheader', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const grid = document.querySelector('[role="grid"]')!
    expect(grid.getAttribute('aria-rowcount')).toBe(String(COLUMNS.length + 1))
    const columnheaders = grid.querySelectorAll('[role="columnheader"]')
    expect(columnheaders.length).toBe(4) // 列名 + 可见性 + 过滤 + 排序
    expect(columnheaders[0].textContent).toBe('列名')
    expect(columnheaders[1].textContent).toBe('可见性')
    expect(columnheaders[2].textContent).toBe('过滤')
    expect(columnheaders[3].textContent).toBe('排序')
  })

  it('每行 rowheader + 3 gridcell', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const titleRow = document.querySelector('[data-matrix-row="title"]')!
    expect(titleRow.querySelector('[role="rowheader"]')).toBeTruthy()
    const gridcells = titleRow.querySelectorAll('[role="gridcell"]')
    expect(gridcells.length).toBe(3)
  })

  it('排序 radiogroup ARIA 完整（label + 3 radio + aria-checked）', () => {
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={SORT_TITLE_ASC}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const radiogroup = document.querySelector('[data-matrix-row="title"] [role="radiogroup"]')!
    expect(radiogroup.getAttribute('aria-label')).toContain('排序方向')
    const radios = radiogroup.querySelectorAll('[role="radio"]')
    expect(radios.length).toBe(2) // ↑ ↓
  })
})

// ── 7. 键盘 + 焦点（~3 用例） ─────────────────────────────────────

describe('ColumnMatrixMenu — 键盘 + 焦点', () => {
  it('ESC 触发 onClose', () => {
    const onClose = vi.fn<() => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={onClose}
      />,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点击外部触发 onClose', () => {
    const onClose = vi.fn<() => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={onClose}
      />,
    )
    // 模拟点击 body 之外（panel 之外）
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('panel 内点击不触发 onClose', () => {
    const onClose = vi.fn<() => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={onClose}
      />,
    )
    const panel = document.querySelector('[data-column-matrix-menu]') as HTMLElement
    fireEvent.mouseDown(panel)
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ── 8. 关闭按钮（~1 用例） ────────────────────────────────────────

describe('ColumnMatrixMenu — 关闭按钮', () => {
  it('点 × 关闭按钮触发 onClose', () => {
    const onClose = vi.fn<() => void>()
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={COLUMN_MENUS_BASE}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={EMPTY_FILTERS}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByTestId('column-matrix-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ── 9. 摘要文本溢出（~3 用例） ────────────────────────────────────

describe('ColumnMatrixMenu — 摘要文本溢出处理', () => {
  it('filterSummary 长文本不截断 DOM 内容（CSS 截断由 dt-styles 处理）', () => {
    const longSummary = '类型: 电影, 电视剧, 综艺, 动漫, 纪录片, 短片, 真人秀'
    const customMenus = new Map([
      ...COLUMN_MENUS_BASE,
      ['title', { filterContent: <input />, filterSummary: longSummary } as ColumnMenuConfig],
    ])
    const filtersWithTitle: ReadonlyMap<string, FilterValue> = new Map([
      ['title', { kind: 'text', value: 'x' } as FilterValue],
    ])
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={customMenus}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={filtersWithTitle}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const summary = screen.getByTestId('matrix-filter-summary-title')
    expect(summary.textContent).toBe(longSummary)
    expect(summary.getAttribute('title')).toBe(longSummary)
  })

  it('多列同时已过滤 → 每列独立摘要', () => {
    const customMenus = new Map([
      ...COLUMN_MENUS_BASE,
      ['title', { filterContent: <input />, filterSummary: '黑客' } as ColumnMenuConfig],
      ['type', { filterContent: <select />, filterSummary: '电影+2 项…' } as ColumnMenuConfig],
    ])
    const filters: ReadonlyMap<string, FilterValue> = new Map([
      ['title', { kind: 'text', value: '黑客' } as FilterValue],
      ['type', { kind: 'enum', value: ['movie', 'series', 'variety'] } as FilterValue],
    ])
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={customMenus}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={filters}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    expect(screen.getByTestId('matrix-filter-summary-title').textContent).toBe('黑客')
    expect(screen.getByTestId('matrix-filter-summary-type').textContent).toBe('电影+2 项…')
  })

  it('特殊字符不破坏 title 属性', () => {
    const customMenus = new Map([
      ...COLUMN_MENUS_BASE,
      ['title', { filterContent: <input />, filterSummary: '"特殊" & <字符>' } as ColumnMenuConfig],
    ])
    const filters: ReadonlyMap<string, FilterValue> = new Map([
      ['title', { kind: 'text', value: 'x' } as FilterValue],
    ])
    render(
      <ColumnMatrixMenu
        open={true}
        columns={COLUMNS}
        columnMenus={customMenus}
        columnsValue={ALL_VISIBLE}
        currentSort={NO_SORT}
        currentFilters={filters}
        anchorRef={makeAnchorRef()}
        onColumnsChange={noop}
        onClearColumnFilter={noop}
        onSort={noop}
        onClearSort={noop}
        onClearAllFilters={noop}
        onResetColumnVisibility={noop}
        onClose={noop}
      />,
    )
    const summary = screen.getByTestId('matrix-filter-summary-title')
    expect(summary.getAttribute('title')).toBe('"特殊" & <字符>')
  })
})
