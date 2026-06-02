'use client'

/**
 * header-menu.tsx — DataTable 表头集成菜单 popover（CHG-DESIGN-02 Step 3/7）
 *
 * 真源：reference.md §4.4 + 设计稿 datatable.jsx DTHeaderMenu
 * arch-reviewer 决议：本步 wire 升降序 / 清除排序 / 过滤区块（含已过滤指示 + 清除过滤）
 *                  / 隐藏列；honors 现有 ColumnMenuConfig 的全部 4 个 gate
 *                  （canSort / canHide / isFiltered / onClearFilter）。
 *   - "固定到左" 推迟到 column.stickyLeft 运行时落地（避免 types-only 暴露）
 *
 * 范式：完全对照 ColumnSettingsPanel — portal 渲染、ESC + 点击外部关闭、
 *      anchorRef.getBoundingClientRect 计算位置、focus 首项。
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ColumnDescriptor, ColumnMenuConfig, ColumnPreference, TableSortState } from './types'
import { useRenderableSlot } from './react-node-utils'

export interface HeaderMenuProps {
  readonly open: boolean
  /** ColumnDescriptor 而非 TableColumn<T>（逆变隔离，与 ColumnSettingsPanel 同惯例） */
  readonly column: ColumnDescriptor | null
  /**
   * 列的 columnMenu 配置（gate + filter slot）。
   * canSort=false 隐藏升降序；canHide=false 隐藏"隐藏此列"按钮；
   * isFiltered=true 显示"已过滤"指示 + （配合 onClearFilter）"清除过滤" 按钮；
   * filterContent 提供时渲染过滤区块。
   */
  readonly columnMenu?: ColumnMenuConfig
  readonly anchorRef: React.RefObject<HTMLElement | null>
  readonly currentSort: TableSortState
  readonly columnsValue: ReadonlyMap<string, ColumnPreference>
  readonly onSort: (field: string, direction: 'asc' | 'desc') => void
  readonly onClearSort: () => void
  readonly onHide: (field: string) => void
  readonly onClose: () => void
  /**
   * ADR-150 阶段 2 / EP-1 Step 4 双范式接入：
   * 提供时整段替换内部 sort+filter+hide 三段松散结构，直接渲染传入的 DataTableAutoFilter 内容。
   * 由 data-table.tsx 在 menuColumn.filterable === true 时计算并注入。
   * 保留 portal + 定位 + ESC + 焦点 + click-outside 关闭。
   */
  readonly autoFilterContent?: React.ReactNode
}

// CHG-VSR-DTAF-VIEWPORT：popover 视口感知定位。
// top（向下展开）/ bottom（flip-up 向上展开，CSS bottom 锚定表头上沿）互斥；maxHeight = 所选方向可用空间。
interface Pos { top?: number; bottom?: number; left: number; maxHeight: number }
// fallback 上限沿用 autofilter CSS max-height 480（无视口约束时维持原行为）
const DEFAULT_MAX_HEIGHT = 480
const DEFAULT_POS: Pos = { top: 0, left: 0, maxHeight: DEFAULT_MAX_HEIGHT }
// 视口边距（popover 与视口边缘留白）+ 锚点间隙
const VIEWPORT_MARGIN = 8
const ANCHOR_GAP = 4
// footer 落点离视口底的安全余量：向下展开时 footer 须距视口底 ≥ 此值，否则 flip-up。
// 防 footer「应用」按钮压到视口底部 / 右下角叠层（dev 工具浮标 / 分页条等）被拦截点击。
const SAFE_BOTTOM_GAP = 56
// 上方有此可用空间则允许 flip-up（即便上方放不全也优于把 footer 压到视口底）。
const MIN_FLIP_SPACE = 160

/**
 * 视口感知定位（CHG-VSR-DTAF-VIEWPORT）：
 *  1. 下方放得下完整 popover **且** footer 距视口底 ≥ SAFE_BOTTOM_GAP → 向下（top 锚定表头下沿）；
 *  2. 否则上方放得下完整 → flip-up（bottom 锚定表头上沿，footer 落表头上方）；
 *  3. 上方有足够可用空间（≥ MIN_FLIP_SPACE）→ flip-up（footer 避视口底部叠层）；
 *  4. 兜底向下贴底 + maxHeight 约束（内部滚动）。
 *  水平方向防右侧溢出 clamp。
 *
 * 导出供单测（纯函数无 DOM 依赖）。naturalH = popover 自然高度（消费方实测，缺省回退 480）。
 */
export function computeHeaderMenuPosition(
  rect: DOMRect, panelW: number, naturalH: number, vw: number, vh: number,
): Pos {
  const spaceBelow = vh - rect.bottom - VIEWPORT_MARGIN
  const spaceAbove = rect.top - VIEWPORT_MARGIN
  let left = rect.left
  if (left + panelW + VIEWPORT_MARGIN > vw) {
    left = Math.max(VIEWPORT_MARGIN, vw - panelW - VIEWPORT_MARGIN)
  }
  const needed = naturalH + ANCHOR_GAP
  const down: Pos = { top: rect.bottom + ANCHOR_GAP, left, maxHeight: Math.max(0, spaceBelow) }
  const up: Pos = { bottom: vh - rect.top + ANCHOR_GAP, left, maxHeight: Math.max(0, spaceAbove) }
  // footer 落点 = rect.bottom + needed；距视口底 ≥ SAFE_BOTTOM_GAP 才向下（避底部叠层）
  if (rect.bottom + needed <= vh - SAFE_BOTTOM_GAP) return down  // 下方放得下且 footer 不贴底
  if (needed <= spaceAbove) return up                            // 上方放得下完整 → flip-up
  if (spaceAbove >= MIN_FLIP_SPACE) return up                    // 上方够用 → flip-up（footer 避底部）
  return down                                                     // 上方也太小 → 向下贴底 + 内滚
}

const PANEL_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 'var(--z-admin-dropdown)' as React.CSSProperties['zIndex'],
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  padding: '4px 0',
  minWidth: '180px',
  maxWidth: '260px',
  outline: 'none',
}

const ITEM_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: 'var(--font-size-sm-tight)',
  color: 'var(--fg-default)',
  background: 'transparent',
  border: 0,
  width: '100%',
  textAlign: 'left',
  fontFamily: 'inherit',
}

const ACTIVE_ITEM_STYLE: React.CSSProperties = {
  ...ITEM_STYLE,
  color: 'var(--admin-accent-on-soft)',
  background: 'var(--admin-accent-soft)',
}

const SEP_STYLE: React.CSSProperties = {
  height: '1px',
  background: 'var(--border-subtle)',
  margin: '4px 0',
}

const FILTER_WRAP_STYLE: React.CSSProperties = {
  padding: '6px 14px 8px',
}

const FILTER_LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--fg-muted)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
}

// materializeNode / isRenderableNode / useRenderableSlot 已抽到 react-node-utils.ts
// （CHG-DESIGN-02 Step 4 fix#: 让 toolbar slots 与 HeaderMenu filterContent 复用同一套）

export function HeaderMenu({
  open,
  column,
  columnMenu,
  anchorRef,
  currentSort,
  columnsValue,
  onSort,
  onClearSort,
  onHide,
  onClose,
  autoFilterContent,
}: HeaderMenuProps): React.ReactElement | null {
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<Pos>(DEFAULT_POS)
  const panelRef = useRef<HTMLDivElement | null>(null)
  // popover 自然尺寸（开启时实测一次缓存；scroll/resize 仅按锚点重定位、不重测，避免布局抖动）
  const naturalSizeRef = useRef<{ width: number; height: number }>({ width: 320, height: DEFAULT_MAX_HEIGHT })

  useEffect(() => { setMounted(true) }, [])

  // CHG-VSR-DTAF-VIEWPORT：清除高度约束 → 测自然宽高 → 还原（useLayoutEffect 内 paint 前，无闪烁）。
  // 自然高度供 computeHeaderMenuPosition 判定下/上放得下，避免靠下表头使 footer 出屏 / 落底部叠层。
  const measureNatural = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return naturalSizeRef.current
    const prevMaxH = panel.style.maxHeight
    const prevVar = panel.style.getPropertyValue('--dt-autofilter-max-height')
    panel.style.maxHeight = 'none'
    panel.style.removeProperty('--dt-autofilter-max-height')
    const size = { width: panel.offsetWidth, height: panel.offsetHeight }
    panel.style.maxHeight = prevMaxH
    if (prevVar) panel.style.setProperty('--dt-autofilter-max-height', prevVar)
    naturalSizeRef.current = size
    return size
  }, [])

  const reposition = useCallback((measure: boolean) => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const { width, height } = measure ? measureNatural() : naturalSizeRef.current
    setPos(computeHeaderMenuPosition(rect, width, height, window.innerWidth, window.innerHeight))
  }, [anchorRef, measureNatural])

  useLayoutEffect(() => {
    if (!open) return
    reposition(true) // 开启：实测自然尺寸后定位
  }, [open, reposition])

  useEffect(() => {
    if (!open) return
    const onChange = () => reposition(false) // scroll/resize：复用缓存尺寸仅重锚
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange, true)
    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange, true)
    }
  }, [open, reposition])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    const onMouseDown = (e: MouseEvent) => {
      const panel = panelRef.current
      const anchor = anchorRef.current
      if (!panel) return
      if (panel.contains(e.target as Node)) return
      if (anchor?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [open, onClose, anchorRef])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('button, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute('disabled'))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (e.shiftKey) {
      if (active === first) { e.preventDefault(); last?.focus() }
    } else {
      if (active === last) { e.preventDefault(); first?.focus() }
    }
  }, [])

  useEffect(() => {
    if (!open || !mounted) return
    const first = panelRef.current?.querySelector<HTMLElement>('button')
    first?.focus()
  }, [open, mounted])

  // 物化 filterContent + 检测 renderable + useRef 缓存（详见 react-node-utils.ts 注释）
  const filterSlot = useRenderableSlot(columnMenu?.filterContent)

  if (!open || !mounted || !column) return null

  // 排序门控：column.enableSorting + columnMenu.canSort（默认允许）
  const sortable = column.enableSorting === true && columnMenu?.canSort !== false
  const isSortedAsc = currentSort.field === column.id && currentSort.direction === 'asc'
  const isSortedDesc = currentSort.field === column.id && currentSort.direction === 'desc'

  // 隐藏门控：pinned 列不可隐藏；columnMenu.canHide 显式 false 也不可隐藏
  const isPinned = column.pinned === true
  const stored = columnsValue.get(column.id)
  const isVisible = stored !== undefined ? stored.visible : column.defaultVisible !== false
  const hideable = !isPinned && isVisible && columnMenu?.canHide !== false

  // 过滤门控：filterContent（已物化）renderable OR isFiltered=true（"已过滤"标记单独显示也有意义）
  const hasRenderableFilter = filterSlot.renderable
  const filterContent = filterSlot.node
  const isFiltered = columnMenu?.isFiltered === true
  const showFilterSection = hasRenderableFilter || isFiltered
  const canClearFilter = isFiltered && columnMenu?.onClearFilter !== undefined

  // 分隔线条件
  const showSepBeforeFilter = sortable && showFilterSection
  const showSepBeforeHide = (sortable || showFilterSection) && hideable

  // CHG-VSR-DTAF-VIEWPORT：top（向下）/ bottom（flip-up）互斥锚定
  const posStyle: React.CSSProperties = pos.bottom !== undefined
    ? { left: pos.left, bottom: pos.bottom }
    : { left: pos.left, top: pos.top }

  // ADR-150 阶段 2 / EP-1 Step 4：autoFilterContent 提供时整段替换三段松散结构
  // sub 1 HOTFIX（2026-05-24）：PANEL_STYLE minWidth/maxWidth (180/260) 与 autofilter inner
  // 期望 width:320 冲突 → 必须覆盖为 auto/none 让内层 [data-autofilter-popover] CSS 自管尺寸。
  if (autoFilterContent) {
    // 视口约束：outer 兜底 clip + CSS var 驱动内层 [data-autofilter-popover] max-height（取 min(480, 可用)）。
    // CSS 自定义属性键不在 React.CSSProperties 静态类型内 → 经 Record 断言注入。
    const autofilterStyle: React.CSSProperties = {
      ...PANEL_STYLE,
      ...posStyle,
      padding: 0,
      minWidth: 'auto',
      maxWidth: 'none',
      maxHeight: pos.maxHeight,
      overflow: 'hidden',
    }
    ;(autofilterStyle as Record<string, string | number>)['--dt-autofilter-max-height'] =
      `${Math.min(DEFAULT_MAX_HEIGHT, pos.maxHeight)}px`
    return createPortal(
      <div
        ref={panelRef}
        role="menu"
        aria-label="列操作"
        tabIndex={-1}
        style={autofilterStyle}
        onKeyDown={handleKeyDown}
        data-header-menu
        data-autofilter="true"
      >
        {autoFilterContent}
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label="列操作"
      tabIndex={-1}
      // regular menu：视口约束 + 超高内部滚动（短菜单不受影响）
      style={{ ...PANEL_STYLE, ...posStyle, maxHeight: pos.maxHeight, overflowY: 'auto' }}
      onKeyDown={handleKeyDown}
      data-header-menu
    >
      {sortable && (
        <>
          <button
            type="button"
            role="menuitem"
            style={isSortedAsc ? ACTIVE_ITEM_STYLE : ITEM_STYLE}
            onClick={() => { onSort(column.id, 'asc'); onClose() }}
          >
            <span aria-hidden="true">↑</span>
            <span>升序</span>
          </button>
          <button
            type="button"
            role="menuitem"
            style={isSortedDesc ? ACTIVE_ITEM_STYLE : ITEM_STYLE}
            onClick={() => { onSort(column.id, 'desc'); onClose() }}
          >
            <span aria-hidden="true">↓</span>
            <span>降序</span>
          </button>
          {(isSortedAsc || isSortedDesc) && (
            <button
              type="button"
              role="menuitem"
              style={ITEM_STYLE}
              onClick={() => { onClearSort(); onClose() }}
            >
              <span aria-hidden="true">×</span>
              <span>清除排序</span>
            </button>
          )}
        </>
      )}
      {showFilterSection && (
        <>
          {showSepBeforeFilter && <div style={SEP_STYLE} aria-hidden="true" />}
          <div style={FILTER_WRAP_STYLE}>
            <div style={FILTER_LABEL_STYLE}>
              <span>过滤</span>
              {isFiltered && (
                <span
                  data-header-menu-filter-active
                  style={{ marginLeft: '6px', color: 'var(--admin-accent-on-soft)' }}
                >已过滤</span>
              )}
            </div>
            {hasRenderableFilter && filterContent}
            {canClearFilter && (
              <button
                type="button"
                role="menuitem"
                style={{ ...ITEM_STYLE, padding: '6px 0', marginTop: '4px' }}
                onClick={() => {
                  columnMenu?.onClearFilter?.()
                  onClose()
                }}
              >
                <span aria-hidden="true">×</span>
                <span>清除过滤</span>
              </button>
            )}
          </div>
        </>
      )}
      {showSepBeforeHide && <div style={SEP_STYLE} aria-hidden="true" />}
      {hideable && (
        <button
          type="button"
          role="menuitem"
          style={ITEM_STYLE}
          onClick={() => { onHide(column.id); onClose() }}
        >
          <span aria-hidden="true">⊘</span>
          <span>隐藏此列</span>
        </button>
      )}
    </div>,
    document.body,
  )
}
