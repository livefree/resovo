/**
 * VideoCard.tsx — 竖版视频卡片（2:3 比例）
 * 用于电影网格等场景
 */

import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { VideoCard as VideoCardType } from '@/types'

interface VideoCardProps {
  video: VideoCardType
  className?: string
}

const TYPE_LABELS: Record<string, string> = {
  movie:   '电影',
  series:  '剧集',
  anime:   '动漫',
  variety: '综艺',
}

export function VideoCard({ video, className }: VideoCardProps) {
  const href = video.slug
    ? `/${video.type}/${video.slug}-${video.shortId}`
    : `/${video.type}/${video.shortId}`

  return (
    <Link
      href={href}
      className={cn('group block', className)}
      data-testid="video-card"
    >
      {/* 封面图（2:3 比例） */}
      <div
        className="relative overflow-hidden rounded-lg"
        style={{ aspectRatio: '2/3' }}
      >
        {video.coverUrl ? (
          <Image
            src={video.coverUrl}
            alt={video.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
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

        {/* 悬停遮罩 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

        {/* 类型标签 */}
        <span
          className="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded font-medium"
          style={{ background: 'var(--gold)', color: 'black' }}
        >
          {TYPE_LABELS[video.type] ?? video.type}
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

      {/* 标题 */}
      <div className="mt-2 space-y-0.5">
        <p
          className="text-sm font-medium line-clamp-1 group-hover:text-[var(--gold)] transition-colors"
          style={{ color: 'var(--foreground)' }}
        >
          {video.title}
        </p>
        {video.year && (
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {video.year}
            {video.episodeCount > 1 && ` · ${video.episodeCount}集`}
          </p>
        )}
      </div>
    </Link>
  )
}
