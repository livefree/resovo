'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { apiClient } from '@/lib/api-client'
import { ALL_CATEGORIES, MAIN_TYPE_PARAMS } from '@/lib/categories'
import type { CountByTypeItem } from '@resovo/types'

// ── Icon components ───────────────────────────────────────────────────────────

function MovieIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="20" x="2" y="2" rx="2" />
      <line x1="7" x2="7" y1="2" y2="22" /><line x1="17" x2="17" y1="2" y2="22" />
      <line x1="2" x2="22" y1="12" y2="12" />
      <line x1="2" x2="7" y1="7" y2="7" /><line x1="17" x2="22" y1="7" y2="7" />
      <line x1="2" x2="7" y1="17" y2="17" /><line x1="17" x2="22" y1="17" y2="17" />
    </svg>
  )
}

function SeriesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="15" rx="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  )
}

function AnimeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function VarietyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
    </svg>
  )
}

function DocumentaryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

const ICON_MAP: Record<string, React.ComponentType> = {
  movie:       MovieIcon,
  series:      SeriesIcon,
  anime:       AnimeIcon,
  tvshow:      VarietyIcon,
  documentary: DocumentaryIcon,
}

// ── count badge formatter ─────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 1000)}K+`
  if (n >= 1000) return `${n.toLocaleString()}+`
  return `${n}`
}

// ── main component ────────────────────────────────────────────────────────────

const MAIN_CATS = ALL_CATEGORIES.filter((c) =>
  (MAIN_TYPE_PARAMS as readonly string[]).includes(c.typeParam)
)

export function CategoryShortcutsClient() {
  const locale = useLocale()
  const t = useTranslations('nav')
  const [countMap, setCountMap] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    apiClient
      .get<{ data: CountByTypeItem[] }>('/videos/count-by-type', { skipAuth: true })
      .then((res) => {
        const map = new Map<string, number>()
        for (const item of res.data) {
          map.set(item.type, item.count)
        }
        setCountMap(map)
      })
      .catch(() => {
        // badge 不渲染，卡片结构不受影响
      })
  }, [])

  return (
    <section aria-label="分类捷径">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '12px',
        }}
      >
        {MAIN_CATS.map(({ typeParam, videoType, labelKey }) => {
          const Icon = ICON_MAP[typeParam]
          const count = countMap.get(videoType)

          return (
            <Link
              key={typeParam}
              href={`/${locale}/${typeParam}`}
              data-testid={`category-shortcut-${typeParam}`}
              className="flex flex-col items-center transition-colors group"
              style={{
                padding: '16px 18px',
                borderRadius: '12px',
                textDecoration: 'none',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                gap: '12px',
                position: 'relative',
              }}
            >
              {/* 图标盒 44px */}
              <span
                aria-hidden="true"
                className="flex items-center justify-center"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'var(--accent-muted)',
                  color: 'var(--accent-default)',
                  flexShrink: 0,
                }}
              >
                {Icon && <Icon />}
              </span>

              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--fg-muted)',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {t(labelKey as Parameters<typeof t>[0])}
              </span>

              {/* count badge */}
              {count !== undefined && (
                <span
                  aria-label={`${formatCount(count)} 个视频`}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '99px',
                    background: 'var(--accent-muted)',
                    color: 'var(--accent-default)',
                    lineHeight: 1.4,
                  }}
                >
                  {formatCount(count)}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
