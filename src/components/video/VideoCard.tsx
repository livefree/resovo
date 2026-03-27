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
  const detailHref = video.slug
    ? `/${video.type}/${video.slug}-${video.shortId}`
    : `/${video.type}/${video.shortId}`

  const watchHref = `/watch/${video.slug ? video.slug + '-' + video.shortId : video.shortId}?ep=1`

  return (
    <div
      className={cn('group relative block', className)}
      data-testid="video-card"
    >
      {/* 封面图（2:3 比例） */}
      <div
        className="relative overflow-hidden rounded-lg"
        style={{ aspectRatio: '2/3' }}
      >
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
            style={{ background: 'var(--secondary)' }}
          >
            <span className="text-4xl opacity-30">🎬</span>
          </div>
        )}

        {/* 悬停遮罩 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 pointer-events-none" />

        {/* 播放直达按钮 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 pointer-events-none">
          <Link
            href={watchHref}
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 pointer-events-auto hover:bg-[var(--accent)] hover:scale-110"
            aria-label="Play Now"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" className="ml-1">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </Link>
        </div>

        {/* 类型标签 */}
        <span
          className="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded font-medium pointer-events-none z-10"
          style={{ background: 'var(--gold)', color: 'black' }}
        >
          {TYPE_LABELS[video.type] ?? video.type}
        </span>

        {/* 评分 */}
        {video.rating !== null && (
          <span
            className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded font-medium pointer-events-none z-10"
            style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--gold)' }}
          >
            ★ {video.rating.toFixed(1)}
          </span>
        )}
      </div>

      {/* 标题 */}
      <div className="mt-2 space-y-0.5 relative z-10">
        <Link href={detailHref} className="after:absolute after:inset-0">
          <p
            className="text-sm font-medium line-clamp-1 group-hover:text-[var(--accent)] transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
            {video.title}
          </p>
        </Link>
        {video.year && (
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {video.year}
            {video.episodeCount > 1 && ` · ${video.episodeCount}集`}
          </p>
        )}
      </div>
    </div>
  )
}
