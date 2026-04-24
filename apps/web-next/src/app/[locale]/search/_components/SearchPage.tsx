'use client'

/**
 * SearchPage — HANDOFF-16 对齐 docs/frontend_design_spec_20260423.md §13.2
 *
 * 完整搜索页：顶部搜索框 + type tab 切换 + 结果卡列表。
 * 快速跳转浮层（SearchOverlay）在 Nav 中，与本页分离（spec §13.3）。
 *
 * Token 消费（spec §13.2）：
 *   页面容器     → max-w-page(1280px) + px-6(24px)
 *   输入框高度   → var(--search-input-h)        56px
 *   输入框间距   → var(--search-input-padding)  14px 20px
 *   输入元素 gap → 12px
 *   Tab-结果间距 → var(--search-tab-gap)         24px
 *   Tab padding  → 10px 14px
 *   Tab 文字 gap → 6px
 *   结果卡 gap   → var(--search-result-gap)      20px
 *   结果卡 pad   → var(--search-result-padding)  20px
 *   结果卡封面宽 → var(--search-result-cover-w)  120px
 *   CTA 组 gap   → var(--search-cta-gap)         8px
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { VideoCard } from '@/components/video/VideoCard'
import { VideoGrid } from '@/components/video/VideoGrid'
import { SearchEmptyState } from '@/components/search/SearchEmptyState'
import type { SearchResult } from '@resovo/types'

// ── Tab 配置 ──────────────────────────────────────────────────────────────────

type SearchTab = 'all' | 'movie' | 'series' | 'anime' | 'variety'

const TABS: Array<{ key: SearchTab; label: string }> = [
  { key: 'all',     label: '全部' },
  { key: 'movie',   label: '电影' },
  { key: 'series',  label: '剧集' },
  { key: 'anime',   label: '动漫' },
  { key: 'variety', label: '综艺' },
]

// ── SearchPage ────────────────────────────────────────────────────────────────

export function SearchPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''
  const initialTab = (searchParams.get('type') as SearchTab | null) ?? 'all'

  const [query, setQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(!!initialQuery)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const doSearch = useCallback(async (q: string, tab: SearchTab) => {
    if (!q.trim()) { setResults([]); setLoading(false); return }
    setLoading(true)
    try {
      const typeParam = tab !== 'all' ? `&type=${tab}` : ''
      const res = await apiClient.get<{ data: SearchResult[] }>(
        `/search?q=${encodeURIComponent(q.trim())}&limit=40${typeParam}`,
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
    if (initialQuery) void doSearch(initialQuery, activeTab)
  }, [initialQuery, doSearch, activeTab])

  // 输入防抖 300ms 搜索
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!query.trim()) { setResults([]); return }
    searchTimerRef.current = setTimeout(() => void doSearch(query, activeTab), 300)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [query, activeTab, doSearch])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    const tabParam = activeTab !== 'all' ? `&type=${activeTab}` : ''
    router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}${tabParam}` : pathname)
  }

  function handleTabChange(tab: SearchTab) {
    setActiveTab(tab)
    const q = query.trim()
    const tabParam = tab !== 'all' ? `&type=${tab}` : ''
    if (q) router.replace(`${pathname}?q=${encodeURIComponent(q)}${tabParam}`)
  }

  const hasQuery = !!query.trim()
  const hasResults = results.length > 0

  return (
    <div data-testid="search-page" className="min-h-screen" style={{ background: 'var(--bg-canvas)' }}>

      {/* 搜索框区 — height: var(--search-input-h), padding: var(--search-input-padding) */}
      <div
        className="sticky top-0 z-40 border-b"
        style={{
          background: 'color-mix(in oklch, var(--bg-canvas) 92%, transparent)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--border-default)',
        }}
      >
        <div className="max-w-page mx-auto px-6">
          <form
            onSubmit={handleSubmit}
            role="search"
            className="flex items-center gap-3"
            style={{
              height: 'var(--search-input-h)',
              padding: 'var(--search-input-padding)',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0"
              style={{ color: 'var(--fg-muted)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>

            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索电影、剧集、演员、导演…"
              aria-label="搜索"
              data-testid="search-input"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--fg-default)', fontSize: '16px' }}
              autoComplete="off"
            />

            {query && (
              <button
                type="button"
                aria-label="清除搜索"
                onClick={() => { setQuery(''); setResults([]) }}
                className="shrink-0 p-1 rounded transition-colors hover:bg-[var(--bg-surface-sunken)]"
                style={{ color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            )}
          </form>
        </div>
      </div>

      {/* 内容区 */}
      <div className="max-w-page mx-auto px-6 py-6">

        {/* Type tab 切换 — spec §13.2 Tab padding 10px 14px, 文字-数字 gap 6px */}
        <div
          className="flex items-center gap-1 overflow-x-auto"
          style={{ marginBottom: 'var(--search-tab-gap)', scrollbarWidth: 'none' }}
          role="tablist"
          aria-label="搜索类型"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            const count = tab.key !== 'all'
              ? results.filter((r) => r.type === tab.key).length
              : results.length
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`search-tab-${tab.key}`}
                onClick={() => handleTabChange(tab.key)}
                style={{
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--accent-default)' : 'var(--fg-muted)',
                  background: isActive ? 'var(--accent-muted)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 150ms ease',
                }}
              >
                {tab.label}
                {hasQuery && hasResults && count > 0 && (
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: isActive ? 'var(--accent-default)' : 'var(--fg-subtle)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* 结果区 */}
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
