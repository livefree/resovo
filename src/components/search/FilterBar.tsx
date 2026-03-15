/**
 * FilterBar.tsx — 搜索页顶部筛选栏（搜索框 + 类型快选 + 排序）
 */

'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface FilterBarProps {
  className?: string
}

const TYPE_OPTIONS = [
  { value: '',        label: '全部' },
  { value: 'movie',   label: '电影' },
  { value: 'series',  label: '剧集' },
  { value: 'anime',   label: '动漫' },
  { value: 'variety', label: '综艺' },
]

const SORT_OPTIONS = [
  { value: 'relevance', label: '综合' },
  { value: 'rating',    label: '评分' },
  { value: 'latest',    label: '最新' },
]

export function FilterBar({ className }: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '')

  const currentType = searchParams.get('type') ?? ''
  const currentSort = searchParams.get('sort') ?? 'relevance'

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (inputValue.trim()) {
      params.set('q', inputValue.trim())
    } else {
      params.delete('q')
    }
    params.delete('page')
    router.push(`?${params.toString()}`, { scroll: false })
  }

  function handleTypeSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    if (value) {
      params.set('type', value)
    } else {
      params.delete('type')
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }

  function handleSortSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    if (value && value !== 'relevance') {
      params.set('sort', value)
    } else {
      params.delete('sort')
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div
      className={cn('border-b py-3 px-4 space-y-3', className)}
      style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
      data-testid="search-filter-bar"
    >
      {/* 搜索框 */}
      <form onSubmit={handleSearch} className="flex gap-2" role="search">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="搜索电影、剧集、导演、演员..."
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            background: 'var(--secondary)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          }}
          data-testid="search-input"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: 'var(--gold)', color: 'black' }}
          data-testid="search-submit"
        >
          搜索
        </button>
      </form>

      {/* 类型 + 排序快选行 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* 类型 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs shrink-0" style={{ color: 'var(--muted-foreground)' }}>
            类型
          </span>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleTypeSelect(opt.value)}
              data-testid={`filter-type-${opt.value || 'all'}`}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs transition-colors',
                currentType === opt.value
                  ? 'font-semibold'
                  : 'hover:bg-[var(--secondary)]'
              )}
              style={
                currentType === opt.value
                  ? { background: 'var(--gold)', color: 'black' }
                  : { color: 'var(--muted-foreground)' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 排序 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs shrink-0" style={{ color: 'var(--muted-foreground)' }}>
            排序
          </span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSortSelect(opt.value)}
              data-testid={`sort-${opt.value}`}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs transition-colors',
                currentSort === opt.value
                  ? 'font-semibold'
                  : 'hover:bg-[var(--secondary)]'
              )}
              style={
                currentSort === opt.value
                  ? { background: 'var(--gold)', color: 'black' }
                  : { color: 'var(--muted-foreground)' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
