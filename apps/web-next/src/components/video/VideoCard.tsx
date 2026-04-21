'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getVideoDetailHref } from '@/lib/video-route'
import { SafeImage } from '@/components/media'
import { reportBrokenImage } from '@/lib/report-broken-image'
import { usePlayerStore } from '@/stores/playerStore'
import { FloatingPlayButton } from './FloatingPlayButton'
import type { VideoCard as VideoCardType } from '@resovo/types'

interface VideoCardProps {
  video: VideoCardType
  className?: string
}

const TYPE_LABELS: Record<string, string> = {
  movie:       '电影',
  series:      '剧集',
  anime:       '动漫',
  variety:     '综艺',
  documentary: '纪录片',
  short:       '短剧',
  sports:      '体育',
  music:       '音乐',
  news:        '新闻',
  kids:        '少儿',
  other:       '其他',
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
  const detailHref = getVideoDetailHref(video)

  function handlePosterClick() {
    enter({
      shortId: video.shortId,
      slug: video.slug,
      episode: 1,
      transition: 'fast-takeover',
    })
  }

  return (
    <article className={cn('group relative block', className)} data-testid="video-card">
      {/* 图片区 — PosterAction: 点击触发 Fast Takeover 直达播放器 */}
      <div className="relative rounded-lg overflow-hidden">
        <SafeImage
          src={video.coverUrl}
          alt={video.title}
          width={200}
          height={300}
          aspect="2:3"
          blurHash={video.posterBlurhash ?? undefined}
          className="pointer-events-none"
          imgClassName="transition-transform duration-300 group-hover:scale-105"
          fallback={{ title: video.title, type: video.type, seed: video.id }}
          onLoadFail={({ src }) =>
            reportBrokenImage({ videoId: video.id, imageKind: 'poster', url: src })
          }
        />

        <button
          type="button"
          className="absolute inset-0 cursor-pointer"
          aria-label={`播放《${video.title}》第 1 集`}
          onClick={handlePosterClick}
        />

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 pointer-events-none" />

        <FloatingPlayButton />

        <span
          className="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded font-medium pointer-events-none z-10"
          style={{ background: 'var(--accent-default)', color: 'var(--accent-fg)' }}
        >
          {TYPE_LABELS[video.type] ?? video.type}
        </span>

        {video.rating !== null && (
          <span
            className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded font-medium pointer-events-none z-10"
            style={{ background: 'var(--bg-overlay)', color: 'var(--accent-default)' }}
          >
            ★ {video.rating.toFixed(1)}
          </span>
        )}
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
