/**
 * VideoCardWide.tsx — 横版视频卡片（16:9 比例）
 * 用于剧集、动漫等场景
 */

import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { VideoCard as VideoCardType } from '@/types'

interface VideoCardWideProps {
  video: VideoCardType
  className?: string
}

const STATUS_LABELS: Record<string, string> = {
  ongoing:   '连载中',
  completed: '已完结',
}

export function VideoCardWide({ video, className }: VideoCardWideProps) {
  const href = video.slug
    ? `/watch/${video.shortId}/${video.slug}`
    : `/watch/${video.shortId}`

  return (
    <Link
      href={href}
      className={cn('group block', className)}
      data-testid="video-card-wide"
    >
      {/* 封面图（16:9 比例） */}
      <div
        className="relative overflow-hidden rounded-lg"
        style={{ aspectRatio: '16/9' }}
      >
        {video.coverUrl ? (
          <Image
            src={video.coverUrl}
            alt={video.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'var(--secondary)' }}
          >
            <span className="text-4xl opacity-30">🎬</span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

        {/* 状态标签 */}
        <span
          className="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded font-medium"
          style={{
            background: video.status === 'ongoing' ? 'var(--gold)' : 'rgba(0,0,0,0.6)',
            color: video.status === 'ongoing' ? 'black' : '#a0a0a0',
          }}
        >
          {STATUS_LABELS[video.status] ?? video.status}
        </span>

        {/* 评分 */}
        {video.rating !== null && (
          <span
            className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded font-medium"
            style={{ background: 'rgba(0,0,0,0.7)', color: '#f5c518' }}
          >
            ★ {video.rating.toFixed(1)}
          </span>
        )}
      </div>

      {/* 标题 + 集数 */}
      <div className="mt-2 space-y-0.5">
        <p
          className="text-sm font-medium line-clamp-1 group-hover:text-[var(--gold)] transition-colors"
          style={{ color: 'var(--foreground)' }}
        >
          {video.title}
        </p>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {video.year && `${video.year} · `}
          {video.episodeCount > 1 ? `全 ${video.episodeCount} 集` : '电影'}
        </p>
      </div>
    </Link>
  )
}
