'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

export interface AdminDropdownItem {
  key: string
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface AdminDropdownProps {
  trigger: ReactNode
  items: AdminDropdownItem[]
  /** Menu alignment relative to trigger. Default: 'right' */
  align?: 'left' | 'right'
  'data-testid'?: string
}

interface MenuPosition {
  top: number
  left: number
}

function calcPosition(
  rect: DOMRect,
  align: 'left' | 'right',
): MenuPosition {
  const top = rect.bottom + window.scrollY
  const left = align === 'right'
    ? rect.right + window.scrollX
    : rect.left + window.scrollX
  return { top, left }
}

export function AdminDropdown({
  trigger,
  items,
  align = 'right',
  'data-testid': testId,
}: AdminDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [pos, setPos] = useState<MenuPosition>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function handleMouseDown(e: MouseEvent) {
      if (triggerRef.current && triggerRef.current.contains(e.target as Node)) return
      setIsOpen(false)
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  function handleTriggerClick() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos(calcPosition(rect, align))
    setIsOpen((prev) => !prev)
  }

  const menu = isOpen ? (
    <div
      role="menu"
      style={{
        position: 'absolute',
        top: pos.top,
        left: align === 'right' ? undefined : pos.left,
        right: align === 'right' ? `calc(100vw - ${pos.left}px)` : undefined,
        zIndex: 50,
      }}
      className="w-28 rounded border border-[var(--border)] bg-[var(--bg2)] py-1 shadow-lg"
      data-testid={testId ? `${testId}-menu` : undefined}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            setIsOpen(false)
            item.onClick()
          }}
          className={[
            'block w-full px-3 py-1.5 text-left text-xs',
            item.danger
              ? 'text-red-400 hover:bg-red-500/10 disabled:text-[var(--muted)]'
              : 'text-[var(--text)] hover:bg-[var(--bg3)] disabled:text-[var(--muted)]',
            'disabled:cursor-not-allowed disabled:hover:bg-transparent',
          ].join(' ')}
        >
          {item.label}
        </button>
      ))}
    </div>
  ) : null

  return (
    <div ref={triggerRef} className="relative inline-block" data-testid={testId}
      onClick={handleTriggerClick}
    >
      {trigger}
      {typeof document !== 'undefined' && createPortal(menu, document.body)}
    </div>
  )
}
