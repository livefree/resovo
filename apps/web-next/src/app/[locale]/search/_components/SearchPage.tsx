'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { VideoCard } from '@/components/video/VideoCard'
import { VideoGrid } from '@/components/video/VideoGrid'
import { SearchSuggestions } from '@/components/search/SearchSuggestions'
import { SearchEmptyState } from '@/components/search/SearchEmptyState'
import type { SearchResult } from '@resovo/types'

// ── SearchPage ────────────────────────────────────────────────────────────────

export function SearchPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(!!initialQuery)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: SearchResult[] }>(
        `/search?q=${encodeURIComponent(q.trim())}&limit=40`,
        { skipAuth: true }
      )
      setResults(res.data)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始 query 触发搜索
  useEffect(() => {
    if (initialQuery) void doSearch(initialQuery)
  }, [initialQuery, doSearch])

  // 输入防抖 300ms 搜索
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!query.trim()) { setResults([]); return }
    searchTimerRef.current = setTimeout(() => void doSearch(query), 300)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [query, doSearch])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setShowSuggestions(false)
    const q = query.trim()
    router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname)
  }

  function handleSuggestionSelect(text: string) {
    setQuery(text)
    setShowSuggestions(false)
    router.replace(`${pathname}?q=${encodeURIComponent(text)}`)
  }

  const hasQuery = !!query.trim()
  const hasResults = results.length > 0

  return (
    <div data-testid="search-page" className="min-h-screen" style={{ background: 'var(--bg-canvas)' }}>
      {/* 搜索栏 */}
      <div
        className="sticky top-0 z-40 border-b px-4 py-3"
        style={{ background: 'var(--bg-canvas)', borderColor: 'var(--border-default)' }}
      >
        <div className="max-w-screen-md mx-auto relative">
          <form onSubmit={handleSubmit} role="search">
            <div className="flex items-center gap-3 rounded-xl border px-4 py-2"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
            >
              <span className="text-base shrink-0" style={{ color: 'var(--fg-muted)' }} aria-hidden="true">
                🔍
              </span>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true) }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onFocus={() => setShowSuggestions(true)}
                placeholder="搜索电影、剧集、演员、导演…"
                aria-label="搜索"
                data-testid="search-input"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--fg-default)' }}
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  aria-label="清除搜索"
                  onClick={() => { setQuery(''); setResults([]) }}
                  className="shrink-0 p-1 rounded text-xs hover:bg-[var(--bg-surface-sunken)]"
                  style={{ color: 'var(--fg-muted)' }}
                >
                  ✕
                </button>
              )}
            </div>
          </form>

          {showSuggestions && hasQuery && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50">
              <SearchSuggestions query={query} onSelect={handleSuggestionSelect} />
            </div>
          )}
        </div>
      </div>

      {/* 内容区 */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        {loading ? (
          <SearchEmptyState.Skeleton />
        ) : hasQuery && hasResults ? (
          <section>
            <p className="mb-4 text-sm" style={{ color: 'var(--fg-muted)' }}>
              找到 {results.length} 个结果
            </p>
            <div
              className="grid gap-4 lg:gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 video-grid-stagger"
              data-testid="search-results-grid"
            >
              {results.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </section>
        ) : (
          <SearchEmptyState hasQuery={hasQuery} />
        )}
      </div>
    </div>
  )
}

/**
 * 具名导出 Skeleton 组件（不通过 SearchPage.Skeleton 静态属性）
 * 原因：SearchPage 是 'use client'，在 Next 15 server 端被编译为 Client Reference，
 * 静态属性 `.Skeleton` 在 server 端访问返回 undefined，导致 Suspense fallback SSR 500。
 * 与 commit 9fcaaf1 的 VideoDetailClientSkeleton 修复同一 pattern。
 */
export function SearchPageSkeleton() {
  return (
    <VideoGrid.Skeleton
      gridCols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      testId="search-results-skeleton"
    />
  )
}
