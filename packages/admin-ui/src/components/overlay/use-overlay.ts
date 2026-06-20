'use client'

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
  /**
   * 容器就绪标志（默认 true）。
   *
   * focus trap 需在 dialog 容器真实挂载后才能绑定。消费方若有 `mounted` 两阶段守卫
   * （createPortal SSR 安全：首帧返回 null、`useEffect` 置 mounted 后才渲染 dialog），
   * 且组件**初始即 `open=true`** —— focus trap effect 首帧跑时 `containerRef` 仍为 null
   * 会早退，而 `open` 不再变化导致 effect 不重跑、focus trap 永久丢失。
   *
   * 这类消费方须传 `ready={mounted}`：mounted false→true 触发 focus trap effect 重跑，
   * 此时容器已挂载。默认 true 保持无两阶段消费方（直接渲染）行为不变。
   */
  readonly ready?: boolean
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
  ready = true,
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
  // 依赖含 ready：消费方两阶段挂载（初始 open=true）时 ready false→true 触发重跑、绑定 trap
  useEffect(() => {
    if (!open || !ready) return
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
  }, [open, ready])

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
