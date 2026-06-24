'use client'

/**
 * SearchPage — HANDOFF-23 重构
 *
 * 对齐 docs/frontend_design_spec_20260423.md §13.2：
 *   - 列表行布局（封面 var(--search-result-cover-w)=120px 2:3 + 右侧信息区）
 *   - API 高亮字段渲染（parseHighlight，禁止 dangerouslySetInnerHTML）
 *   - 服务端分页（limit=20，page 参数由 URL 驱动）
 *   - Tab 切换触发新 API 请求（不做前端过滤）
 *
 * Token 消费（spec §13.2）：
 *   输入框高度    → var(--search-input-h)         56px
 *   输入框 padding → var(--search-input-padding)   14px 20px
 *   Tab 间距      → var(--search-tab-gap)          24px
 *   结果卡间距    → var(--search-result-gap)       20px
 *   结果卡 padding → var(--search-result-padding)  20px
 *   封面宽度      → var(--search-result-cover-w)   120px
 *   CTA 组间距    → var(--search-cta-gap)          8px
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams, usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { ChipType } from '@/components/primitives/chip-type'
import { SafeImage } from '@/components/media'
import { Pagination } from '@/components/primitives/pagination'
import { SearchEmptyState } from '@/components/search/SearchEmptyState'
import { parseHighlight } from '@/lib/parse-highlight'
import { getVideoDetailHref } from '@/lib/video-route'
import { VideoGrid } from '@/components/video/VideoGrid'
import { FilterArea } from '@/components/shared/filter/FilterArea'
import { GridSortBar } from '@/components/shared/filter/GridSortBar'
import type { SearchResult, ApiListResponse, VideoType } from '@resovo/types'
import { ALL_CATEGORIES } from '@/lib/categories'

// ── 常量 ──────────────────────────────────────────────────────────────────────

/** type 维选项值集合（派生自 ALL_CATEGORIES，ADR-048 前台 SSOT；注入共享 FilterArea） */
const TYPE_OPTIONS: readonly VideoType[] = ALL_CATEGORIES.map((c) => c.videoType as VideoType)

/** /search 转发的筛选维度（统一 FilterArea 写入 URL；GridSortBar 写 sort，40A 后端已支持） */
const FORWARDED_FILTERS = ['type', 'genre', 'country', 'lang', 'year', 'sort'] as const

const PAGE_SIZE = 20

// ── SearchResultRow ──────────────────────────────────────────────────────────

interface SearchResultRowProps {
  result: SearchResult
  locale: string
}

function SearchResultRow({ result, locale }: SearchResultRowProps) {
  const t = useTranslations('search')
  const detailHref = getVideoDetailHref(result)
  const watchSlug = result.slug ? `${result.slug}-${result.shortId}` : result.shortId
  const watchHref = `/${locale}/watch/${watchSlug}?ep=1`

  const displayTitle = result.highlight?.title
    ? parseHighlight(result.highlight.title)
    : result.title

  return (
    <article
      data-testid="search-result-row"
      style={{
        display: 'flex',
        gap: 'var(--search-result-padding)',
        padding: 'var(--search-result-padding)',
        borderRadius: 'var(--radius-base)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* 封面 */}
      <Link href={detailHref} style={{ flexShrink: 0, display: 'block' }}>
        <div
          style={{
            width: 'var(--search-result-cover-w)',
            aspectRatio: '2/3',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          <SafeImage
            src={result.coverUrl ?? undefined}
            blurHash={result.posterBlurhash ?? undefined}
            aspect="2:3"
            width={120}
            height={180}
            alt={result.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      </Link>

      {/* 信息区 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* 标题（含高亮） */}
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--fg-default)',
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {displayTitle}
          {result.titleEn && (
            <span
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 400,
                color: 'var(--fg-muted)',
                marginTop: '2px',
              }}
            >
              {result.titleEn}
            </span>
          )}
        </h3>

        {/* meta 行：类型 Chip + 年份 + 评分 */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <ChipType type={result.type} size="sm" />
          {result.year && (
            <span style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>{result.year}</span>
          )}
          {result.rating !== null && (
            <span style={{ fontSize: '13px', color: 'var(--gold)', fontWeight: 500 }}>
              ★ {result.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* CTA 按钮 */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--search-cta-gap)',
            marginTop: 'auto',
            paddingTop: '4px',
          }}
        >
          <Link
            href={watchHref}
            data-testid="search-row-watch"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-default)',
              color: 'var(--fg-on-accent)',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            {t('watchNow')}
          </Link>
          <Link
            href={detailHref}
            data-testid="search-row-detail"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--fg-default)',
              fontSize: '13px',
              fontWeight: 400,
              textDecoration: 'none',
            }}
          >
            {t('details')}
          </Link>
        </div>
      </div>
    </article>
  )
}

// ── SearchPage ────────────────────────────────────────────────────────────────

export function SearchPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = useParams()
  const locale = (params.locale as string) ?? 'en'
  const t = useTranslations('search')

  const searchKey = searchParams.toString()
  const urlQuery = searchParams.get('q') ?? ''
  const urlPage = Math.max(1, Number(searchParams.get('page') ?? '1'))

  const [inputValue, setInputValue] = useState(urlQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(!!urlQuery)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 同步 URL q → inputValue（外部跳转时）
  useEffect(() => {
    setInputValue(urlQuery)
  }, [urlQuery])

  // 统一筛选区维度（type/genre/country/lang/year）+ GridSortBar(sort) 全部写 URL，
  // doSearch 据当前 URL 透传给 /search（40A 后端已支持 genre/sort=hot）。
  const doSearch = useCallback(async (sp: URLSearchParams) => {
    const q = (sp.get('q') ?? '').trim()
    if (!q) { setResults([]); setTotal(0); setLoading(false); return }
    setLoading(true)
    try {
      const query = new URLSearchParams()
      query.set('q', q)
      query.set('limit', String(PAGE_SIZE))
      query.set('page', sp.get('page') ?? '1')
      for (const key of FORWARDED_FILTERS) {
        const v = sp.get(key)
        if (v) query.set(key, v)
      }
      const res = await apiClient.get<ApiListResponse<SearchResult>>(
        `/search?${query.toString()}`,
        { skipAuth: true },
      )
      setResults(res.data)
      setTotal(res.pagination.total)
    } catch {
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  // URL params（含筛选/排序）变化驱动搜索
  useEffect(() => {
    void doSearch(new URLSearchParams(searchKey))
  }, [searchKey, doSearch])

  // 输入防抖 300ms → 更新 URL q，重置 page
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const p = new URLSearchParams(searchParams.toString())
      if (val.trim()) {
        p.set('q', val.trim())
      } else {
        p.delete('q')
      }
      p.delete('page')
      router.replace(`${pathname}?${p.toString()}`)
    }, 300)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const p = new URLSearchParams(searchParams.toString())
    if (inputValue.trim()) {
      p.set('q', inputValue.trim())
    } else {
      p.delete('q')
    }
    p.delete('page')
    router.replace(`${pathname}?${p.toString()}`)
  }

  function navigate(targetPage: number) {
    const p = new URLSearchParams(searchParams.toString())
    if (targetPage <= 1) {
      p.delete('page')
    } else {
      p.set('page', String(targetPage))
    }
    router.push(`${pathname}?${p.toString()}`)
  }

  const hasQuery = !!urlQuery.trim()
  const hasResults = results.length > 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div data-testid="search-page" className="min-h-screen" style={{ background: 'var(--bg-canvas)' }}>

      {/* 搜索框区 */}
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
              value={inputValue}
              onChange={handleInputChange}
              placeholder={t('placeholder')}
              aria-label={t('inputAriaLabel')}
              data-testid="search-input"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--fg-default)', fontSize: '16px' }}
              autoComplete="off"
            />

            {inputValue && (
              <button
                type="button"
                aria-label={t('clearAriaLabel')}
                onClick={() => {
                  setInputValue('')
                  setResults([])
                  setTotal(0)
                  const p = new URLSearchParams(searchParams.toString())
                  p.delete('q')
                  p.delete('page')
                  router.replace(`${pathname}?${p.toString()}`)
                }}
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

        {/* 统一筛选区（与分类页完全一致：5 维消费 taxonomy，HANDOFF-40B） */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <FilterArea mode="search" typeOptions={TYPE_OPTIONS} />
        </div>

        {/* 排序条 + 结果计数（替代原 type tab 计数，置于结果区上方左侧） */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <GridSortBar
            total={hasQuery && hasResults ? total : undefined}
            totalLabelKey="filter.countSearch"
          />
        </div>

        {/* 结果区 */}
        {loading ? (
          <SearchEmptyState.Skeleton />
        ) : hasQuery && hasResults ? (
          <section>
            <div
              data-testid="search-results-list"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--search-result-gap)' }}
            >
              {results.map((result) => (
                <SearchResultRow key={result.id} result={result} locale={locale} />
              ))}
            </div>
            {totalPages > 1 && (
              <Pagination
                data-testid="search-pagination"
                page={urlPage}
                totalPages={totalPages}
                onPrev={() => navigate(urlPage - 1)}
                onNext={() => navigate(urlPage + 1)}
              />
            )}
          </section>
        ) : (
          <SearchEmptyState hasQuery={hasQuery} />
        )}
      </div>
    </div>
  )
}

/**
 * 具名导出 Skeleton（SSR 安全，与 SearchPage Client Reference 分离）
 * 见 commit 9fcaaf1 / SearchPageSkeleton 修复同一 pattern。
 */
export function SearchPageSkeleton() {
  return (
    <VideoGrid.Skeleton
      gridCols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      testId="search-results-skeleton"
    />
  )
}
