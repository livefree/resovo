'use client'

/**
 * SearchEmptyState — 搜索页非结果态（SEARCH-FE-4 重构）
 *
 * 两态按搜索语境分设计（消除「空态=分类页矩阵、结果态=列表」的布局突变）：
 *   - 无结果态（hasQuery=true）：查询回显 +「清除筛选 / 清空重搜」补救 +「你可能想看」list 推荐
 *     （SearchResultRow × trending，与搜索结果同布局）。
 *   - 空态（hasQuery=false）：热搜 chips（点击即搜，接真实周热门）+「为你发现」热门内容 grid。
 * 数据源：useHotSearchTerms（/videos/trending?period=week，降级静态 nav.hotSearchTerms）。
 */

import { useTranslations } from 'next-intl'
import { useRouter, usePathname, useSearchParams, useParams } from 'next/navigation'
import { VideoGrid } from '@/components/video/VideoGrid'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import { SearchResultRow } from '@/components/search/SearchResultRow'
import { useHotSearchTerms } from '@/hooks/useHotSearchTerms'
import { FILTER_KEYS, hasFacet } from '@/components/search/search-params'
import type { SearchResult } from '@resovo/types'

interface SearchEmptyStateProps {
  /** 是否有搜索意图（有 q 或有 facet）——true 走无结果态，false 走空态。 */
  hasQuery: boolean
}

/**
 * 列表行骨架——匹配 SearchResultRow 布局（封面 2:3 + 标题/meta/CTA 条），
 * 消除加载态（网格）→ 结果态（列表）的布局跳变（SEARCH-FE-3）。
 */
function SearchResultsSkeleton() {
  return (
    <div
      data-testid="search-results-skeleton"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--search-result-gap)' }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 'var(--search-result-padding)',
            padding: 'var(--search-result-padding)',
            borderRadius: 'var(--radius-base)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Skeleton
            width="var(--search-result-cover-w)"
            style={{ aspectRatio: '2/3', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton width="70%" height="18px" />
            <Skeleton width="40%" height="13px" />
            <div style={{ display: 'flex', gap: 'var(--search-cta-gap)', marginTop: 'auto', paddingTop: '4px' }}>
              <Skeleton width="72px" height="30px" style={{ borderRadius: 'var(--radius-sm)' }} />
              <Skeleton width="64px" height="30px" style={{ borderRadius: 'var(--radius-sm)' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 区块标题 ────────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-base font-semibold" style={{ color: 'var(--fg-default)' }}>
      {children}
    </h3>
  )
}

// ── 无结果态 ────────────────────────────────────────────────────────────────

function NoResultsState({
  query,
  hasActiveFacet,
  recommended,
  locale,
  onClearFilters,
  onClearAll,
}: {
  query: string
  hasActiveFacet: boolean
  recommended: SearchResult[]
  locale: string
  onClearFilters: () => void
  onClearAll: () => void
}) {
  const t = useTranslations('search')
  return (
    <div className="pt-4" data-testid="search-empty-state">
      {/* 回显 + 补救 */}
      <div
        style={{
          padding: 'var(--search-result-padding)',
          borderRadius: 'var(--radius-base)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--fg-default)', margin: 0 }}>
          {query ? t('noResultsTitle', { query }) : t('noResultsGeneric')}
        </p>
        <p style={{ fontSize: '13px', color: 'var(--fg-muted)', margin: '6px 0 0' }}>
          {t('noResultsHint')}
        </p>
        <div style={{ display: 'flex', gap: 'var(--search-cta-gap)', marginTop: '12px', flexWrap: 'wrap' }}>
          {hasActiveFacet && (
            <button
              type="button"
              data-testid="search-clear-filters"
              onClick={onClearFilters}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                background: 'transparent',
                color: 'var(--fg-default)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {t('clearFilters')}
            </button>
          )}
          <button
            type="button"
            data-testid="search-clear-all"
            onClick={onClearAll}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--fg-default)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {t('clearQuery')}
          </button>
        </div>
      </div>

      {/* list 推荐（与搜索结果同布局） */}
      {recommended.length > 0 && (
        <section>
          <SectionHeading>{t('mayLike')}</SectionHeading>
          <div
            data-testid="search-recommended-list"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--search-result-gap)' }}
          >
            {recommended.map((v) => (
              <SearchResultRow key={v.id} result={v} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── 空态 ────────────────────────────────────────────────────────────────────

function EmptyPromptState({ terms, onPickTerm }: { terms: string[]; onPickTerm: (term: string) => void }) {
  const t = useTranslations('search')
  return (
    <div className="pt-4" data-testid="search-empty-state">
      {/* 热搜词 chips（搜索页身份感，区别分类页） */}
      {terms.length > 0 && (
        <section style={{ marginBottom: 'var(--space-6)' }} data-testid="search-hot-terms">
          <SectionHeading>{t('hotSearches')}</SectionHeading>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {terms.map((term, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPickTerm(term)}
                className="transition-colors hover:bg-[var(--bg-surface-sunken)]"
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  color: 'var(--fg-default)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 热门内容发现区（grid） */}
      <section>
        <SectionHeading>{t('discover')}</SectionHeading>
        <VideoGrid
          query="period=week&limit=20"
          layout="grid"
          stagger
          data-testid="search-recommended-grid"
        />
      </section>
    </div>
  )
}

// ── SearchEmptyState ────────────────────────────────────────────────────────

export function SearchEmptyState({ hasQuery }: SearchEmptyStateProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = useParams()
  const locale = (params.locale as string) ?? 'en'

  const { terms, videos } = useHotSearchTerms()

  const query = (searchParams.get('q') ?? '').trim()
  const activeFacet = hasFacet(new URLSearchParams(searchParams.toString()))

  function clearFilters() {
    const p = new URLSearchParams(searchParams.toString())
    for (const k of FILTER_KEYS) p.delete(k)
    p.delete('page')
    router.replace(`${pathname}?${p.toString()}`)
  }

  // 清空重搜：清除全部搜索条件（q + facet + page）→ 回到空态
  function clearAll() {
    router.replace(pathname)
  }

  function pickTerm(term: string) {
    router.push(`${pathname}?q=${encodeURIComponent(term)}`)
  }

  if (hasQuery) {
    return (
      <NoResultsState
        query={query}
        hasActiveFacet={activeFacet}
        recommended={videos}
        locale={locale}
        onClearFilters={clearFilters}
        onClearAll={clearAll}
      />
    )
  }

  return <EmptyPromptState terms={terms} onPickTerm={pickTerm} />
}

SearchEmptyState.Skeleton = SearchResultsSkeleton
