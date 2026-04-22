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
  { value: 'tvshow', label: '综艺' },
  { value: 'documentary', label: '纪录片' },
  { value: 'short', label: '短剧' },
  { value: 'sports', label: '体育' },
  { value: 'music', label: '音乐' },
  { value: 'news', label: '新闻' },
  { value: 'kids', label: '少儿' },
  { value: 'other', label: '其他' },
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
    // Read from DOM to handle cases where controlled state is out of sync (e.g. Playwright mobile)
    const form = e.currentTarget as HTMLFormElement
    const domQ = (form.querySelector('[data-testid="search-input"]') as HTMLInputElement)?.value ?? inputValue
    const q = (domQ || inputValue).trim()
    const params = new URLSearchParams(searchParams.toString())
    if (q) {
      params.set('q', q)
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
          className="px-5 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 shadow-[0_0_10px_rgba(232,184,75,0.2)]"
          style={{ background: 'var(--accent)', color: 'black' }}
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
                'px-3 py-1 rounded-full text-xs transition-all border outline-none',
                currentType === opt.value
                  ? 'font-bold shadow-sm'
                  : 'hover:bg-[var(--secondary)] hover:border-[var(--muted-foreground)]'
              )}
              style={
                currentType === opt.value
                  ? { background: 'var(--accent)', color: 'black', borderColor: 'var(--accent)' }
                  : { color: 'var(--muted-foreground)', borderColor: 'transparent', background: 'transparent' }
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
                'px-3 py-1 rounded-full text-xs transition-all border outline-none',
                currentSort === opt.value
                  ? 'font-bold shadow-sm'
                  : 'hover:bg-[var(--secondary)] hover:border-[var(--muted-foreground)]'
              )}
              style={
                currentSort === opt.value
                  ? { background: 'var(--accent)', color: 'black', borderColor: 'var(--accent)' }
                  : { color: 'var(--muted-foreground)', borderColor: 'transparent', background: 'transparent' }
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
