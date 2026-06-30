'use client'

/**
 * NavMoreMenu.tsx — "更多 ▼" 导航下拉（HANDOFF-49-D-B：迁移到共享 `<DropdownMenu>` primitive）
 *
 * 收敛前自带 hover-intent / 键盘 / a11y / 进场逻辑，现全部下沉到 `<DropdownMenu>`（arch-reviewer 契约）。
 * 本组件只负责：① 业务数据（MORE_CATS → items）② trigger 外观（"更多"按钮 + chevron + active 下划线）。
 * 进场动画对齐 Motion Spec（opacity + translateY(-6px) · fast ease-out · 受 --motion-scale）由 primitive 提供。
 */

import { useTranslations } from 'next-intl'
import { DropdownMenu } from '@/components/primitives/dropdown-menu'
import type { DropdownMenuItem } from '@/components/primitives/dropdown-menu'
import { ALL_CATEGORIES, MORE_TYPE_PARAMS } from '@/lib/categories'

// 扩展分类（6 种，"更多 ▼" 下拉内），单源 lib/categories.ts（I-6）
const MORE_CATS = ALL_CATEGORIES.filter((c) =>
  (MORE_TYPE_PARAMS as readonly string[]).includes(c.typeParam),
)

const MORE_KEYS = new Set<string>(MORE_TYPE_PARAMS)

export interface MoreMenuProps {
  readonly locale: string
  readonly currentType: string | null
  readonly label: string
}

export function MoreMenu({ locale, currentType, label }: MoreMenuProps) {
  const t = useTranslations('nav')
  const active = currentType !== null && MORE_KEYS.has(currentType)

  // 业务数据 → 数据驱动 items（label 在此 t() 算好传入，primitive 不碰 i18n）
  const items: DropdownMenuItem[] = MORE_CATS.map((cat) => ({
    key: cat.typeParam,
    label: t(cat.labelKey),
    href: `/${locale}/${cat.typeParam}`,
    active: currentType === cat.typeParam,
    testId: `nav-more-${cat.typeParam}`,
  }))

  return (
    <DropdownMenu
      testIdPrefix="nav-more"
      items={items}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          data-testid="nav-more-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
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
              transition: 'transform calc(var(--duration-fast) * var(--motion-scale, 1)) var(--easing-ease-out)',
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
      )}
    />
  )
}
