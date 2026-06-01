'use client'

/**
 * use-matrix-keyboard.ts — ColumnMatrixMenu grid 键盘导航 + Tab focus trap（DTR-A 拆自 column-matrix-menu.tsx）
 *
 * D-149-12 a11y：ArrowUp/Down/Left/Right 在 grid 内 focusable cell 间移动焦点；
 * Tab 在 popover 内循环（focus trap）。逻辑纯依赖 panelRef + document.activeElement，
 * 整体搬出为 hook，零行为变化。
 */
import { useCallback } from 'react'

export function useMatrixKeyboard(panelRef: React.RefObject<HTMLDivElement | null>): {
  readonly handleGridKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  readonly handleTabKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
} {
  // 键盘语义：ArrowUp/Down/Left/Right 在 grid 内 cell 间移动焦点（D-149-12）
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key
    if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') return
    const panel = panelRef.current
    if (!panel) return
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(
        '[data-cell-focusable="true"]:not([aria-disabled="true"]):not([disabled])',
      ),
    )
    if (focusables.length === 0) return
    const active = document.activeElement as HTMLElement
    const idx = focusables.indexOf(active)
    if (idx < 0) return
    e.preventDefault()
    const activeRow = parseInt(active.dataset.gridRow ?? '0', 10)
    const activeCol = parseInt(active.dataset.gridCol ?? '0', 10)
    // 找同列上/下 或 同行左/右 最近 focusable
    let target: HTMLElement | undefined
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      const sameColFocusables = focusables.filter((el) => parseInt(el.dataset.gridCol ?? '0', 10) === activeCol)
      const sameColIdx = sameColFocusables.indexOf(active)
      const delta = key === 'ArrowDown' ? 1 : -1
      target = sameColFocusables[sameColIdx + delta]
    } else {
      const sameRowFocusables = focusables.filter((el) => parseInt(el.dataset.gridRow ?? '0', 10) === activeRow)
      const sameRowIdx = sameRowFocusables.indexOf(active)
      const delta = key === 'ArrowRight' ? 1 : -1
      target = sameRowFocusables[sameRowIdx + delta]
    }
    target?.focus()
  }, [panelRef])

  // Tab 循环 focus trap
  const handleTabKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('button:not([disabled]), [role="switch"]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute('disabled'))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (e.shiftKey) {
      if (active === first) {
        e.preventDefault()
        last?.focus()
      }
    } else {
      if (active === last) {
        e.preventDefault()
        first?.focus()
      }
    }
  }, [panelRef])

  return { handleGridKeyDown, handleTabKeyDown }
}
