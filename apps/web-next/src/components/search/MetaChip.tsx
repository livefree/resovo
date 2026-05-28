'use client'

import { useRouter } from 'next/navigation'
import { formatCountryName } from '@resovo/types'
import { cn } from '@/lib/utils'

type MetaChipType = 'director' | 'actor' | 'writer' | 'genre' | 'year' | 'country'

interface MetaChipProps {
  label: string
  type: MetaChipType
  className?: string
}

const TYPE_PARAM_MAP: Record<MetaChipType, string> = {
  director: 'director',
  actor:    'actor',
  writer:   'writer',
  genre:    'genre',
  year:     'year',
  country:  'country',
}

export function MetaChip({ label, type, className }: MetaChipProps) {
  const router = useRouter()

  // CHG-366 / plan §10.4.3：country chip 显示本地化名称，但保留原 ISO code 作为
  // 搜索 query（搜索后端按 ISO code 索引；显示层本地化不影响 URL 真源）
  const displayLabel = type === 'country' ? formatCountryName(label, 'zh-CN', label) : label
  const showOriginalTitle = type === 'country' && displayLabel !== label

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const param = TYPE_PARAM_MAP[type]
    router.push(`/search?${param}=${encodeURIComponent(label)}`)
  }

  return (
    <button
      onClick={(e) => handleClick(e)}
      data-testid={`meta-chip-${type}`}
      title={showOriginalTitle ? label : undefined}
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs transition-colors',
        'hover:bg-[var(--bg-surface-sunken)] cursor-pointer',
        className
      )}
      style={{ color: 'var(--fg-muted)', border: '1px solid var(--border-default)' }}
    >
      {displayLabel}
    </button>
  )
}
