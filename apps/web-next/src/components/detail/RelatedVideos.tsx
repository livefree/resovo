import { VideoGrid } from '@/components/video/VideoGrid'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import type { Video } from '@resovo/types'

interface RelatedVideosProps {
  video: Video
}

export function RelatedVideos({ video }: RelatedVideosProps) {
  const query = `type=${video.type}&limit=12&exclude=${video.id}`

  return (
    <section
      className="max-w-screen-xl mx-auto px-4 py-8 border-t"
      style={{ borderColor: 'var(--border-default)' }}
      data-testid="related-videos"
    >
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
    </section>
  )
}

function RelatedVideosSkeleton() {
  return (
    <div
      className="max-w-screen-xl mx-auto px-4 py-8 border-t"
      style={{ borderColor: 'var(--border-default)' }}
    >
      <Skeleton shape="text" width={96} height={20} className="mb-4" />
      <VideoGrid.Skeleton
        gridCols="grid-cols-3 sm:grid-cols-4 md:grid-cols-6"
        testId="related-videos-skeleton"
      />
    </div>
  )
}

RelatedVideos.Skeleton = RelatedVideosSkeleton
