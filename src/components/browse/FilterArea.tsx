/**
 * FilterArea.tsx — 展开式多行筛选区（客户端组件）
 * 6行筛选：类型/地区/字幕/年份/评分/状态
 * 行内单选，与 URL 参数双向同步
 */

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

// ── 筛选配置 ──────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()

const FILTER_ROWS = [
  {
    key: 'type',
    options: [
      { value: '', labelKey: 'browse.filter.typeAll' },
      { value: 'movie',   labelKey: 'nav.catMovie' },
      { value: 'series',  labelKey: 'nav.catSeries' },
      { value: 'anime',   labelKey: 'nav.catAnime' },
      { value: 'variety', labelKey: 'nav.catVariety' },
    ],
  },
  {
    key: 'country',
    options: [
      { value: '',   labelKey: 'browse.filter.countryAll' },
      { value: 'CN', label: '中国大陆' },
      { value: 'US', label: 'United States' },
      { value: 'JP', label: '日本' },
      { value: 'KR', label: '韩国' },
      { value: 'GB', label: 'UK' },
      { value: 'FR', label: 'France' },
    ],
  },
  {
    key: 'lang',
    options: [
      { value: '',      labelKey: 'browse.filter.langAll' },
      { value: 'zh-CN', label: '中文简体' },
      { value: 'zh-TW', label: '中文繁体' },
      { value: 'en',    label: 'English' },
      { value: 'ja',    label: '日本語' },
      { value: 'ko',    label: '한국어' },
    ],
  },
  {
    key: 'year',
    options: [
      { value: '', labelKey: 'browse.filter.yearAll' },
      ...Array.from({ length: 8 }, (_, i) => ({
        value: String(CURRENT_YEAR - i),
        label: String(CURRENT_YEAR - i),
      })),
    ],
  },
  {
    key: 'rating_min',
    options: [
      { value: '',    labelKey: 'browse.filter.ratingAll' },
      { value: '9',   labelKey: 'browse.filter.rating9' },
      { value: '8',   labelKey: 'browse.filter.rating8' },
      { value: '7',   labelKey: 'browse.filter.rating7' },
      { value: '6',   labelKey: 'browse.filter.rating6' },
    ],
  },
  {
    key: 'status',
    options: [
      { value: '',          labelKey: 'browse.filter.statusAll' },
      { value: 'ongoing',   labelKey: 'browse.filter.ongoing' },
      { value: 'completed', labelKey: 'browse.filter.completed' },
    ],
  },
]

const FILTER_LABELS: Record<string, string> = {
  type:       'browse.filter.type',
  country:    'browse.filter.country',
  lang:       'browse.filter.lang',
  year:       'browse.filter.year',
  rating_min: 'browse.filter.rating',
  status:     'browse.filter.status',
}

// ── 组件 ──────────────────────────────────────────────────────────

interface FilterAreaProps {
  className?: string
}

export function FilterArea({ className }: FilterAreaProps) {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isExpanded, setIsExpanded] = useState(false)

  // 只在展开时显示 year/rating/status 行
  const visibleRows = isExpanded ? FILTER_ROWS : FILTER_ROWS.slice(0, 3)

  function handleSelect(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    // 重置分页
    params.delete('page')
    if (value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div
      className={cn(
        'sticky top-14 z-40 border-b py-3 px-4',
        'max-w-screen-xl mx-auto w-full',
        className
      )}
      style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
      data-testid="filter-area"
    >
      {visibleRows.map((row) => {
        const currentValue = searchParams.get(row.key) ?? ''
        return (
          <div key={row.key} className="flex items-center gap-2 py-1 flex-wrap">
            <span
              className="text-xs w-12 shrink-0 font-medium"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {t(FILTER_LABELS[row.key] ?? row.key)}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {row.options.map((opt) => {
                const label = opt.label ?? t(opt.labelKey ?? '')
                const isActive = currentValue === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(row.key, opt.value)}
                    data-testid={`filter-${row.key}-${opt.value || 'all'}`}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs transition-all border outline-none',
                      isActive
                        ? 'font-bold shadow-sm'
                        : 'hover:bg-[var(--secondary)] hover:border-[var(--muted-foreground)]'
                    )}
                    style={
                      isActive
                        ? { background: 'var(--accent)', color: 'black', borderColor: 'var(--accent)' }
                        : { color: 'var(--muted-foreground)', borderColor: 'transparent', background: 'transparent' }
                    }
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* 展开/收起 */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        data-testid="filter-expand"
        className="mt-1 text-xs px-2 py-0.5 rounded transition-colors hover:bg-[var(--secondary)]"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {isExpanded ? t('browse.filter.collapse') : t('browse.filter.expand')} {isExpanded ? '▲' : '▼'}
      </button>
    </div>
  )
}
