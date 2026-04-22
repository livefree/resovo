'use client'

import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
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
import { Skeleton } from '@/components/primitives/feedback/Skeleton'

interface VideoCardProps {
  video: VideoCardType
  className?: string
}


function VideoCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('block', className)} data-testid="video-card-skeleton" aria-hidden="true">
      {/* Cover — matches StackedPosterFrame 2:3 aspect-ratio + rounded-lg */}
      <Skeleton shape="rect" className="rounded-lg w-full" style={{ aspectRatio: '2/3' }} />
      <div className="mt-2 space-y-1.5">
        {/* Title — text-sm line-height ~14px */}
        <Skeleton shape="text" height={14} delay={300} />
        {/* Subtitle — text-xs, 2/3 width */}
        <Skeleton shape="text" height={12} className="w-2/3" delay={300} />
      </div>
    </div>
  )
}

export function VideoCard({ video, className }: VideoCardProps) {
  const enter = usePlayerStore((s) => s.enter)
  const router = useRouter()
  const params = useParams()
  const locale = (params.locale as string) ?? 'en'
  const detailHref = getVideoDetailHref(video)
  const watchSlug = video.slug ? `${video.slug}-${video.shortId}` : video.shortId
  const watchHref = `/${locale}/watch/${watchSlug}?ep=1`

  function handlePosterClick() {
    enter({
      shortId: video.shortId,
      slug: video.slug,
      episode: 1,
      transition: 'fast-takeover',
    })
    router.push(watchHref)
  }

  return (
    <article className={cn('group relative block', className)} data-testid="video-card">
      {/* 图片区 — PosterAction: 点击触发 Fast Takeover 直达播放器 */}
      {/* no overflow-hidden: StackedPosterFrame box-shadow must be visible outside its bounds */}
      {/* group/poster scopes FloatingPlayButton & overlay hover to image area only */}
      <div className="relative rounded-lg group/poster">
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

        <div className="absolute inset-0 rounded-lg overflow-hidden bg-black/0 group-hover/poster:bg-black/40 transition-colors duration-300 pointer-events-none z-20" />

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
