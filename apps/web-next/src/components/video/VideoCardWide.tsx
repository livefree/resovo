/** @deprecated 全站已统一为竖版卡片（VideoCard 2:3），此组件保留但不得新引用 */
'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getVideoDetailHref } from '@/lib/video-route'
import { SafeImage } from '@/components/media'
import { reportBrokenImage } from '@/lib/report-broken-image'
import type { VideoCard as VideoCardType } from '@resovo/types'

interface VideoCardWideProps {
  video: VideoCardType
  className?: string
}

const STATUS_LABELS: Record<string, string> = {
  ongoing:   '连载中',
  completed: '已完结',
}

export function VideoCardWide({ video, className }: VideoCardWideProps) {
  const detailHref = getVideoDetailHref(video)
  const watchHref = `/watch/${video.slug ? video.slug + '-' + video.shortId : video.shortId}?ep=1`

  return (
    <div className={cn('group relative block', className)} data-testid="video-card-wide">
      <div className="relative rounded-lg overflow-hidden">
        <SafeImage
          src={video.coverUrl}
          alt={video.title}
          width={320}
          height={180}
          aspect="16:9"
          className="pointer-events-none"
          imgClassName="transition-transform duration-300 group-hover:scale-105"
          fallback={{ title: video.title, type: video.type, seed: video.id }}
          onLoadFail={({ src }) =>
            reportBrokenImage({ videoId: video.id, imageKind: 'poster', url: src })
          }
        />

        <Link href={detailHref} className="absolute inset-0" aria-label={video.title} />

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 pointer-events-none" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 pointer-events-none">
          <Link
            href={watchHref}
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 pointer-events-auto hover:bg-[var(--accent-default)] hover:scale-110"
            aria-label="Play Now"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" className="ml-1">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </Link>
        </div>

        <span
          className="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded font-medium pointer-events-none z-10"
          style={{
            background: video.status === 'ongoing' ? 'var(--accent-default)' : 'var(--bg-overlay)',
            color: video.status === 'ongoing' ? 'black' : 'var(--fg-muted)',
          }}
        >
          {STATUS_LABELS[video.status] ?? video.status}
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

      <div className="mt-2 space-y-0.5 relative z-10">
        <Link href={detailHref} className="after:absolute after:inset-0">
          <p
            className="text-sm font-medium line-clamp-1 group-hover:text-[var(--accent-default)] transition-colors"
            style={{ color: 'var(--fg-default)' }}
          >
            {video.title}
          </p>
        </Link>
        <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
          {video.year && `${video.year} · `}
          {video.episodeCount > 1 ? `全 ${video.episodeCount} 集` : '电影'}
        </p>
      </div>
    </div>
  )
}
