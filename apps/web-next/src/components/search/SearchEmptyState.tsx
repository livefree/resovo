'use client'

import { useTranslations } from 'next-intl'
import { VideoGrid } from '@/components/video/VideoGrid'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'

interface SearchEmptyStateProps {
  hasQuery: boolean
}

/**
 * 列表行骨架——匹配 SearchResultRow 布局（封面 2:3 + 标题/meta/CTA 条），
 * 消除加载态（网格）→ 结果态（列表）的布局跳变。
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

/**
 * 搜索空状态：
 * - hasQuery=true：无搜索结果，展示推荐内容
 * - hasQuery=false：未输入，展示热门内容
 */
export function SearchEmptyState({ hasQuery }: SearchEmptyStateProps) {
  const t = useTranslations('search')
  return (
    <div className="pt-4" data-testid="search-empty-state">
      {hasQuery && (
        <p className="mb-6 text-sm" style={{ color: 'var(--fg-muted)' }}>
          {t('noResultsRecommend')}
        </p>
      )}
      <section>
        <h3 className="mb-4 text-base font-semibold" style={{ color: 'var(--fg-default)' }}>
          {hasQuery ? t('recommendedTitle') : t('hotTitle')}
        </h3>
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

SearchEmptyState.Skeleton = SearchResultsSkeleton
