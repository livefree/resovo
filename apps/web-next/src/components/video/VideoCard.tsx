'use client'

import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { getVideoDetailHref } from '@/lib/video-route'
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

export function VideoCard({ video, className }: VideoCardProps) {
  const detailHref = getVideoDetailHref(video)
  const watchHref = `/watch/${video.slug ? video.slug + '-' + video.shortId : video.shortId}?ep=1`

  return (
    <div className={cn('group relative block', className)} data-testid="video-card">
      <div className="relative overflow-hidden rounded-lg" style={{ aspectRatio: '2/3' }}>
        <Link href={detailHref} className="absolute inset-0 z-0" aria-label={video.title} />

        {video.coverUrl ? (
          <Image
            src={video.coverUrl}
            alt={video.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background: 'var(--bg-surface-sunken)' }}
          >
            <span className="text-4xl opacity-30">🎬</span>
          </div>
        )}

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

      <div className="mt-2 space-y-0.5 relative z-10">
        <Link href={detailHref} className="after:absolute after:inset-0">
          <p
            className="text-sm font-medium line-clamp-1 group-hover:text-[var(--accent-default)] transition-colors"
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
    </div>
  )
}
