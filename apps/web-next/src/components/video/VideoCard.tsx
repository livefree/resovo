'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getVideoDetailHref } from '@/lib/video-route'
import { reportBrokenImage } from '@/lib/report-broken-image'
import { usePlayerStore } from '@/stores/playerStore'
import { FloatingPlayButton } from './FloatingPlayButton'
import { StackedPosterFrame } from '@/components/primitives/media/StackedPosterFrame'
import { TagLayer } from '@/components/primitives/media/TagLayer'
import { videoCardToTagProps } from '@/lib/tag-mapping'
import { getStackLevel } from '@/lib/video-stack-level'
import type { VideoCard as VideoCardType } from '@resovo/types'

interface VideoCardProps {
  video: VideoCardType
  className?: string
}


function VideoCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('block', className)} data-testid="video-card-skeleton" aria-hidden="true">
      <div
        className="rounded-lg animate-pulse"
        style={{
          aspectRatio: '2/3',
          background: 'var(--bg-surface-sunken)',
        }}
      />
      <div className="mt-2 space-y-1.5">
        <div
          className="rounded animate-pulse"
          style={{ height: 14, background: 'var(--bg-surface-sunken)' }}
        />
        <div
          className="rounded animate-pulse w-2/3"
          style={{ height: 12, background: 'var(--bg-surface-sunken)' }}
        />
      </div>
    </div>
  )
}

export function VideoCard({ video, className }: VideoCardProps) {
  const enter = usePlayerStore((s) => s.enter)
  const router = useRouter()
  const detailHref = getVideoDetailHref(video)
  const watchHref = `/watch/${video.slug ? `${video.slug}-${video.shortId}` : video.shortId}?ep=1`

  function handlePosterClick() {
    enter({
      shortId: video.shortId,
      slug: video.slug,
      episode: 1,
      transition: 'fast-takeover',
    })
    // Update URL so refresh/share/back land on /watch — ADR-042 + ADR-048 §2
    router.push(watchHref)
  }

  return (
    <article className={cn('group relative block', className)} data-testid="video-card">
      {/* 图片区 — PosterAction: 点击触发 Fast Takeover 直达播放器 */}
      {/* no overflow-hidden: StackedPosterFrame box-shadow must be visible outside its bounds */}
      <div className="relative rounded-lg">
        <StackedPosterFrame
          src={video.coverUrl}
          alt={video.title}
          width={200}
          height={300}
          aspect="2:3"
          blurHash={video.posterBlurhash ?? undefined}
          fallback={{ title: video.title, type: video.type, seed: video.id }}
          onLoadFail={({ src }) =>
            reportBrokenImage({ videoId: video.id, imageKind: 'poster', url: src })
          }
          stackLevel={getStackLevel(video.type)}
          className="w-full"
        />

        <button
          type="button"
          className="absolute inset-0 cursor-pointer z-20"
          aria-label={`播放《${video.title}》第 1 集`}
          onClick={handlePosterClick}
        />

        <div className="absolute inset-0 rounded-lg overflow-hidden bg-black/0 group-hover:bg-black/40 transition-colors duration-300 pointer-events-none z-20" />

        <FloatingPlayButton />

        <TagLayer {...videoCardToTagProps(video)} />
      </div>

      {/* 文字区 — MetaAction: 点击跳详情页 */}
      <div className="mt-2 space-y-0.5 relative z-10">
        <Link
          href={detailHref}
          aria-label={`${video.title} 详情页`}
          className="block group-hover:text-[var(--accent-default)] transition-colors"
        >
          <p
            className="text-sm font-medium line-clamp-1"
            style={{ color: 'var(--fg-default)' }}
          >
            {video.title}
          </p>
        </Link>
        {video.year && (
          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            {video.year}
            {video.episodeCount > 1 && ` · ${video.episodeCount}集`}
          </p>
        )}
      </div>
    </article>
  )
}

VideoCard.Skeleton = VideoCardSkeleton
