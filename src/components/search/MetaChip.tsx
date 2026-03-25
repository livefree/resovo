/**
 * MetaChip.tsx — 元数据标签（可点击跳转搜索）
 * 点击导演/演员/编剧名 → 跳转到对应搜索页
 */

'use client'

import { useRouter } from 'next/navigation'
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
  genre: 'genre',
  year:     'year',
  country:  'country',
}

export function MetaChip({ label, type, className }: MetaChipProps) {
  const router = useRouter()

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
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs transition-colors',
        'hover:bg-[var(--secondary)] cursor-pointer',
        className
      )}
      style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
    >
      {label}
    </button>
  )
}
