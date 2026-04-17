/**
 * SortBar.tsx — 排序条 + 结果计数（客户端组件）
 */

'use client'

import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const SORT_OPTIONS = [
  { value: 'relevance', labelKey: 'browse.sort.relevance' },
  { value: 'rating',    labelKey: 'browse.sort.rating' },
  { value: 'latest',    labelKey: 'browse.sort.latest' },
] as const

interface SortBarProps {
  total: number
}

export function SortBar({ total }: SortBarProps) {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentSort = searchParams.get('sort') ?? 'relevance'

  function handleSort(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    params.set('sort', value)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center justify-between py-3 px-4 max-w-screen-xl mx-auto w-full">
      {/* 结果计数 */}
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }} data-testid="result-count">
        {t('browse.results', { count: total })}
      </p>

      {/* 排序选项 */}
      <div className="flex items-center gap-1">
        <span className="text-xs mr-1" style={{ color: 'var(--muted-foreground)' }}>
          {t('browse.sort.label')}
        </span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSort(opt.value)}
            data-testid={`sort-${opt.value}`}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs transition-colors',
              currentSort === opt.value
                ? 'font-semibold'
                : 'hover:bg-[var(--secondary)]'
            )}
            style={
              currentSort === opt.value
                ? { background: 'var(--secondary)', color: 'var(--foreground)' }
                : { color: 'var(--muted-foreground)' }
            }
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
