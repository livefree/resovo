'use client'

import { useRef, useState, useId } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface MegaMenuItem {
  key: string
  label: string
  href: string
  active?: boolean
}

export interface MegaMenuProps {
  trigger: React.ReactNode
  items: MegaMenuItem[]
  /** Called on open state change (for trigger aria-expanded sync) */
  onOpenChange?: (open: boolean) => void
  className?: string
}

const OPEN_DELAY_MS  = 120
const CLOSE_DELAY_MS = 240

export function MegaMenu({ trigger, items, onOpenChange, className }: MegaMenuProps) {
  const [open, setOpen] = useState(false)
  const openTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuId = useId()
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const menuRef    = useRef<HTMLDivElement | null>(null)

  function cancelTimers() {
    if (openTimer.current)  clearTimeout(openTimer.current)
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }

  function scheduleOpen() {
    cancelTimers()
    openTimer.current = setTimeout(() => {
      setOpen(true)
      onOpenChange?.(true)
    }, OPEN_DELAY_MS)
  }

  function scheduleClose() {
    cancelTimers()
    closeTimer.current = setTimeout(() => {
      setOpen(false)
      onOpenChange?.(false)
    }, CLOSE_DELAY_MS)
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      cancelTimers()
      setOpen(true)
      onOpenChange?.(true)
      requestAnimationFrame(() => {
        const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')
        first?.focus()
      })
    }
    if (e.key === 'Escape') {
      cancelTimers()
      setOpen(false)
      onOpenChange?.(false)
    }
  }

  const FOCUSABLE = 'button:not([disabled]),a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      cancelTimers()
      setOpen(false)
      onOpenChange?.(false)
      triggerRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    }
  }

  return (
    <div
      ref={triggerRef}
      className={cn('relative', className)}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onKeyDown={handleTriggerKeyDown}
    >
      {/* Trigger slot — caller controls content & aria-expanded */}
      <div aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}>
        {trigger}
      </div>

      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          data-testid="mega-menu-panel"
          onMouseEnter={cancelTimers}
          onMouseLeave={scheduleClose}
          onKeyDown={handleMenuKeyDown}
          className="absolute top-full left-0 pt-2 z-50"
          style={{ animation: `menuFadeIn ${OPEN_DELAY_MS}ms ease` }}
        >
          <div
            className="rounded-lg border shadow-xl p-1.5 min-w-[140px] flex flex-col gap-0.5"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
            }}
          >
            {items.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                role="menuitem"
                tabIndex={0}
                data-testid={`mega-menu-item-${item.key}`}
                onClick={() => {
                  cancelTimers()
                  setOpen(false)
                  onOpenChange?.(false)
                }}
                className={cn(
                  'px-3 py-2 rounded-md text-sm transition-colors',
                  'hover:bg-[var(--bg-surface-sunken)] hover:text-[var(--fg-default)]',
                  item.active
                    ? 'font-semibold text-[var(--accent-default)] bg-[var(--bg-surface-sunken)]'
                    : 'text-[var(--fg-muted)]',
                )}
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
