import { VideoGrid } from '@/components/video/VideoGrid'

interface SearchEmptyStateProps {
  hasQuery: boolean
}

function SearchResultsSkeleton() {
  return (
    <VideoGrid.Skeleton gridCols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" testId="search-results-skeleton" />
  )
}

/**
 * 搜索空状态：
 * - hasQuery=true：无搜索结果，展示推荐内容
 * - hasQuery=false：未输入，展示热门内容
 */
export function SearchEmptyState({ hasQuery }: SearchEmptyStateProps) {
  return (
    <div className="pt-4" data-testid="search-empty-state">
      {hasQuery && (
        <p className="mb-6 text-sm" style={{ color: 'var(--fg-muted)' }}>
          未找到相关内容，为你推荐：
        </p>
      )}
      <section>
        <h3 className="mb-4 text-base font-semibold" style={{ color: 'var(--fg-default)' }}>
          {hasQuery ? '热门推荐' : '热门内容'}
        </h3>
        <VideoGrid
          query="period=week&limit=20"
          variant="portrait"
          layout="grid"
          stagger
          data-testid="search-recommended-grid"
        />
      </section>
    </div>
  )
}

SearchEmptyState.Skeleton = SearchResultsSkeleton
