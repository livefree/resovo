'use client'

/**
 * DropdownMenu — 共享桌面下拉菜单 primitive（HANDOFF-49-D，arch-reviewer claude-opus-4-8 契约）
 *
 * 合并 NavMoreMenu（hover-intent 双延时 + 触屏 toggle + 几何桥接区防死区）与
 * MegaMenu（键盘 ArrowDown/Esc + a11y）能力，作为唯一桌面下拉范式。
 *
 * 职责边界（不越界）：
 *   - 不碰 i18n：label 由调用方传入已本地化文本。
 *   - 不碰路由：item.active 由调用方算好传入。
 *   - 不碰 trigger 外观：下划线 / chevron 由 trigger render-prop 自渲，组件仅回传 { open, toggle }。
 *
 * 进场动画对齐 Motion Spec：opacity + translateY(-6px) · fast 120ms ease-out（受 --motion-scale）。
 * prefers-reduced-motion：`.dropdown-panel` 类在 globals.css reduce 区置 transition: none。
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { DropdownMenuProps } from './types'

const DEFAULT_OPEN_DELAY_MS = 120
const DEFAULT_CLOSE_DELAY_MS = 240

/** 几何桥接区：填补 trigger 与面板间隙，hover 指针穿越不离开 wrapper（防 hover-intent 死区）。 */
const BRIDGE_PADDING_TOP = '8px'
const ENTRANCE_OFFSET = 'translateY(-6px)'
const PANEL_TRANSITION =
  'opacity calc(var(--duration-fast) * var(--motion-scale, 1)) var(--easing-ease-out), ' +
  'transform calc(var(--duration-fast) * var(--motion-scale, 1)) var(--easing-ease-out)'

/** trigger wrapper 内首个可聚焦元素（Esc 回焦用） */
const FOCUSABLE =
  'button:not([disabled]),a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'

function prefersHover(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
}

export function DropdownMenu({
  trigger,
  items,
  onOpenChange,
  hoverIntent,
  align = 'start',
  minWidthPx = 180,
  testIdPrefix,
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  // 进场 data-state：open 后下一帧切 true 触发 transition（首帧 opacity:0 + translateY(-6px)）
  const [entered, setEntered] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // onOpenChange 存 ref，避免 effect 依赖内联回调反复重订阅
  const onOpenChangeRef = useRef(onOpenChange)
  const menuId = useId()

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  const openDelayMs = hoverIntent?.openDelayMs ?? DEFAULT_OPEN_DELAY_MS
  const closeDelayMs = hoverIntent?.closeDelayMs ?? DEFAULT_CLOSE_DELAY_MS

  const setOpenState = useCallback((next: boolean) => {
    setOpen(next)
    onOpenChangeRef.current?.(next)
  }, [])

  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) {
      clearTimeout(openTimer.current)
      openTimer.current = null
    }
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  // 卸载清理定时器（防泄漏 / setState on unmounted）
  useEffect(
    () => () => {
      if (openTimer.current !== null) clearTimeout(openTimer.current)
      if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    },
    [],
  )

  // 进场：open 时下一帧切 entered=true 触发 transition
  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [open])

  // 点击外部 / Esc 全局关闭（open 时）
  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent) {
      if (wrapperRef.current?.contains(e.target as Node)) return
      setOpenState(false)
    }
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpenState(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, setOpenState])

  function scheduleOpen() {
    if (!prefersHover()) return // hover-intent 仅 hover 设备，触屏走 toggle
    clearTimers()
    openTimer.current = setTimeout(() => {
      setOpenState(true)
      openTimer.current = null
    }, openDelayMs)
  }

  function scheduleClose() {
    if (!prefersHover()) return
    clearTimers()
    closeTimer.current = setTimeout(() => {
      setOpenState(false)
      closeTimer.current = null
    }, closeDelayMs)
  }

  function toggle() {
    clearTimers()
    setOpenState(!open)
  }

  function handleTriggerKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // ArrowDown 打开并聚焦首项（Enter/Space 走 trigger 按钮原生 click → toggle，不在此重复处理避免双触发）
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      clearTimers()
      setOpenState(true)
      requestAnimationFrame(() => {
        menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
      })
    } else if (e.key === 'Escape') {
      clearTimers()
      setOpenState(false)
    }
  }

  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      clearTimers()
      setOpenState(false)
      wrapperRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={cn('relative', className)}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onKeyDown={handleTriggerKeyDown}
    >
      <div aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}>
        {trigger({ open, toggle })}
      </div>

      {open && (
        <div
          // 定位 + 桥接区容器：贴 trigger 底（top-full），paddingTop 充当 hover 桥接区
          className="absolute top-full z-50"
          style={{
            insetInlineStart: align === 'start' ? 0 : 'auto',
            insetInlineEnd: align === 'end' ? 0 : 'auto',
            paddingTop: BRIDGE_PADDING_TOP,
          }}
          onMouseEnter={clearTimers}
          onMouseLeave={scheduleClose}
        >
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            data-testid={`${testIdPrefix}-menu`}
            className="dropdown-panel"
            onKeyDown={handleMenuKeyDown}
            style={{
              minWidth: `${minWidthPx}px`,
              borderRadius: '10px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 8px 24px color-mix(in oklch, var(--color-gray-1000) 12%, transparent)',
              padding: '6px',
              opacity: entered ? 1 : 0,
              transform: entered ? 'translateY(0)' : ENTRANCE_OFFSET,
              transition: PANEL_TRANSITION,
            }}
          >
            {items.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                role="menuitem"
                tabIndex={0}
                data-testid={item.testId ?? `${testIdPrefix}-${item.key}`}
                onClick={() => setOpenState(false)}
                className="block"
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  textDecoration: 'none',
                  color: item.active ? 'var(--accent-default)' : 'var(--fg-default)',
                  background: item.active ? 'var(--accent-muted)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!item.active) e.currentTarget.style.background = 'var(--bg-surface-sunken)'
                }}
                onMouseLeave={(e) => {
                  if (!item.active) e.currentTarget.style.background = 'transparent'
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
