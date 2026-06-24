'use client'

/**
 * NavMoreMenu.tsx — "更多 ▼" 下拉菜单（从 Nav.tsx 提取，CHG-SN-7-MISC-WEB-NEXT-SIZE）
 *
 * I-5：hover 展开（桌面 pointer:fine）/ click 展开（触屏）
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ALL_CATEGORIES, MORE_TYPE_PARAMS } from '@/lib/categories'

// 扩展分类（6 种，"更多 ▼" 下拉内），单源 lib/categories.ts（I-6）
const MORE_CATS = ALL_CATEGORIES.filter((c) =>
  (MORE_TYPE_PARAMS as readonly string[]).includes(c.typeParam)
)

const MORE_KEYS = new Set<string>(MORE_TYPE_PARAMS)

export interface MoreMenuProps {
  readonly locale: string
  readonly currentType: string | null
  readonly label: string
}

export function MoreMenu({ locale, currentType, label }: MoreMenuProps) {
  const t = useTranslations('nav')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const active = currentType !== null && MORE_KEYS.has(currentType)

  // 点击外部 + ESC 关闭（touch 模式下需要）
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  function handleMouseEnter() {
    // hover 展开仅用于 pointer: fine（桌面鼠标）设备（I-5）
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      setOpen(true)
    }
  }

  function handleMouseLeave() {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      setOpen(false)
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        data-testid="nav-more-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
        className="relative flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap"
        style={{
          padding: 'var(--header-nav-padding)',
          fontSize: '14px',
          fontWeight: 600,
          borderRadius: '8px',
          background: 'transparent',
          border: 'none',
          textDecoration: 'none',
          cursor: 'pointer',
          color: active ? 'var(--accent-default)' : 'var(--fg-muted)',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.color = 'var(--fg-default)'
            e.currentTarget.style.background = 'var(--bg-surface-sunken)'
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.color = 'var(--fg-muted)'
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        {label}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            transition: 'transform 160ms ease-out',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            opacity: 0.7,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {active && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '14px',
              right: '14px',
              bottom: 'calc(-1 * var(--header-underline-offset))',
              height: '2px',
              background: 'var(--accent-default)',
              borderRadius: '1px',
            }}
          />
        )}
      </button>

      {open && (
        // 外层=定位+透明桥接容器：紧贴按钮底部（top-full，无 margin），
        // paddingTop 充当 8px hover 桥接区，避免鼠标穿越间隙离开 wrapper 触发收起。
        <div className="absolute z-50 top-full" style={{ left: 0, paddingTop: '8px' }}>
          <div
            role="menu"
            data-testid="nav-more-menu"
            style={{
              minWidth: '180px',
              borderRadius: '10px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 8px 24px color-mix(in oklch, var(--color-gray-1000) 12%, transparent)',
              padding: '6px',
            }}
          >
            {MORE_CATS.map((cat) => {
              const isActive = currentType === cat.typeParam
              return (
                <Link
                  key={cat.typeParam}
                  href={`/${locale}/${cat.typeParam}`}
                  role="menuitem"
                  data-testid={`nav-more-${cat.typeParam}`}
                  onClick={() => setOpen(false)}
                  className="block transition-colors"
                  style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    textDecoration: 'none',
                    color: isActive ? 'var(--accent-default)' : 'var(--fg-default)',
                    background: isActive ? 'var(--accent-muted)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--bg-surface-sunken)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {t(cat.labelKey)}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
