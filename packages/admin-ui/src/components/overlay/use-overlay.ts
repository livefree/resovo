/**
 * use-overlay.ts — Drawer / Modal 共用 overlay 行为 hook
 * 真源：ADR-103 §4.6（CHG-SN-2-16）
 *
 * 职责：focus trap + ESC 关闭 + backdrop click 处理 + scroll lock（body overflow:hidden）。
 * 不做：不持有 open 状态（由消费方受控）；不直接渲染 DOM。
 *
 * 不变约束：
 *   - 模块顶层零 window / document 访问（全在 useEffect 内）
 *   - closeOnEscape / closeOnBackdropClick 均默认 true
 */
import { useEffect, useRef, useCallback } from 'react'
import type React from 'react'

export interface UseOverlayOptions {
  readonly open: boolean
  readonly onClose: () => void
  readonly closeOnEscape?: boolean
  readonly closeOnBackdropClick?: boolean
}

export interface UseOverlayReturn {
  readonly containerRef: React.RefObject<HTMLDivElement | null>
  readonly backdropProps: { readonly onClick: (e: React.MouseEvent) => void }
}

export function useOverlay({
  open,
  onClose,
  closeOnEscape = true,
  closeOnBackdropClick = true,
}: UseOverlayOptions): UseOverlayReturn {
  const containerRef = useRef<HTMLDivElement | null>(null)

  // ESC 关闭
  useEffect(() => {
    if (!open || !closeOnEscape) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      try { onClose() } catch { /* consumer errors must not break overlay cleanup */ }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, closeOnEscape, onClose])

  // scroll lock（body overflow:hidden）
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // focus trap：Tab/Shift+Tab 在容器内循环；mount 时 focus 首个可聚焦元素
  useEffect(() => {
    if (!open) return
    const container = containerRef.current
    if (!container) return
    const focusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
    // 首次 open：focus 首个可聚焦元素
    const first = focusable()[0]
    first?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const active = document.activeElement
      if (!container.contains(active)) return
      if (e.shiftKey) {
        if (active === firstEl) { e.preventDefault(); lastEl?.focus() }
      } else {
        if (active === lastEl) { e.preventDefault(); firstEl?.focus() }
      }
    }
    container.addEventListener('keydown', onKeyDown)
    return () => container.removeEventListener('keydown', onKeyDown)
  }, [open])

  const backdropOnClick = useCallback(
    (e: React.MouseEvent) => {
      if (!closeOnBackdropClick) return
      if (e.target === e.currentTarget) onClose()
    },
    [closeOnBackdropClick, onClose],
  )

  return {
    containerRef,
    backdropProps: { onClick: backdropOnClick },
  }
}
