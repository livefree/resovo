/**
 * ActiveFilterStrip.tsx — 激活筛选条（展示当前生效的筛选标签，支持单删和清除全部）
 */

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ActiveFilterStripProps {
  className?: string
}

const PARAM_LABELS: Record<string, string> = {
  q:          '搜索',
  type:       '类型',
  year:       '年份',
  rating_min: '评分',
  lang:       '字幕',
  director:   '导演',
  actor:      '演员',
  writer:     '编剧',
  country:    '地区',
}

const TRACKED_PARAMS = Object.keys(PARAM_LABELS)

export function ActiveFilterStrip({ className }: ActiveFilterStripProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeFilters = TRACKED_PARAMS
    .filter((key) => searchParams.has(key))
    .map((key) => ({
      key,
      value: searchParams.get(key)!,
      label: `${PARAM_LABELS[key]}: ${searchParams.get(key)!}`,
    }))

  if (activeFilters.length === 0) return null

  function removeFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(key)
    params.delete('page')
    router.push(`?${params.toString()}`, { scroll: false })
  }

  function clearAll() {
    router.push('?', { scroll: false })
  }

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 px-4 py-2 border-b', className)}
      style={{ borderColor: 'var(--border)' }}
      data-testid="active-filter-strip"
    >
      {activeFilters.map((filter) => (
        <span
          key={filter.key}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{
            background: 'var(--secondary)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          }}
          data-testid={`active-filter-${filter.key}`}
        >
          {filter.label}
          <button
            onClick={() => removeFilter(filter.key)}
            className="ml-0.5 transition-colors hover:opacity-70"
            aria-label={`Remove ${filter.key} filter`}
            data-testid={`remove-filter-${filter.key}`}
          >
            ×
          </button>
        </span>
      ))}

      {activeFilters.length > 1 && (
        <button
          onClick={clearAll}
          className="text-xs px-2 py-0.5 rounded transition-colors hover:bg-[var(--secondary)]"
          style={{ color: 'var(--muted-foreground)' }}
          data-testid="clear-all-filters"
        >
          清除全部
        </button>
      )}
    </div>
  )
}
