/**
 * RelatedVideos — HANDOFF-17 对齐 docs/frontend_design_spec_20260423.md §14
 *
 * variant="grid"   （默认）全宽网格，用于全宽布局（历史兼容）
 * variant="sidebar" 侧栏纵向列表，位于 VideoDetailClient 1fr+320px 侧栏
 */

import { VideoGrid } from '@/components/video/VideoGrid'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import type { Video } from '@resovo/types'

interface RelatedVideosProps {
  video: Video
  /** 'grid'（默认）= 全宽网格；'sidebar' = 侧栏纵向列表 */
  variant?: 'grid' | 'sidebar'
}

export function RelatedVideos({ video, variant = 'grid' }: RelatedVideosProps) {
  const query = `type=${video.type}&limit=12&exclude=${video.id}`
  const isSidebar = variant === 'sidebar'

  return (
    <section
      data-testid="related-videos"
      className={isSidebar ? undefined : 'border-t'}
      style={isSidebar ? undefined : { borderColor: 'var(--border-default)' }}
    >
      {!isSidebar && (
        <div className="max-w-feature mx-auto px-6 py-8">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--fg-default)' }}>
            相关推荐
          </h2>
          <VideoGrid
            query={query}
            variant="portrait"
            gridCols="grid-cols-3 sm:grid-cols-4 md:grid-cols-6"
            stagger
            data-testid="related-videos-grid"
          />
        </div>
      )}

      {isSidebar && (
        <>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--fg-default)' }}>
            相关推荐
          </h2>
          <VideoGrid
            query={query}
            variant="portrait"
            gridCols="grid-cols-2"
            stagger
            data-testid="related-videos-grid"
          />
        </>
      )}
    </section>
  )
}

function RelatedVideosSkeleton() {
  return (
    <div
      className="border-t"
      style={{ borderColor: 'var(--border-default)' }}
    >
      <div className="max-w-feature mx-auto px-6 py-8">
        <Skeleton shape="text" width={96} height={20} className="mb-4" />
        <VideoGrid.Skeleton
          gridCols="grid-cols-3 sm:grid-cols-4 md:grid-cols-6"
          testId="related-videos-skeleton"
        />
      </div>
    </div>
  )
}

RelatedVideos.Skeleton = RelatedVideosSkeleton
