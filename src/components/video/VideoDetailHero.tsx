/**
 * VideoDetailHero.tsx — 视频详情页 Banner（封面 + 基础信息区）
 * Server Component
 */

import Image from 'next/image'
import Link from 'next/link'
import type { Video } from '@/types'

interface VideoDetailHeroProps {
  video: Video
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

const STATUS_LABELS: Record<string, string> = {
  ongoing:   '连载中',
  completed: '已完结',
}

export function VideoDetailHero({ video }: VideoDetailHeroProps) {
  const watchHref = video.slug
    ? `/watch/${video.slug}-${video.shortId}?ep=1`
    : `/watch/${video.shortId}?ep=1`

  return (
    <section
      className="relative"
      style={{ background: 'var(--background)' }}
      data-testid="video-detail-hero"
    >
      {/* 背景渐变模糊封面 */}
      {video.coverUrl && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Image
            src={video.coverUrl}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-10 blur-xl scale-110"
            aria-hidden
          />
        </div>
      )}

      <div className="relative max-w-screen-xl mx-auto px-4 py-10 md:py-16 flex flex-col md:flex-row gap-8 md:gap-12 items-start z-10">
        {/* 封面图与主操作区 (左侧) */}
        <div className="shrink-0 flex flex-col gap-6 w-[200px] md:w-[280px] mx-auto md:mx-0">
          <div
            className="w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            style={{ aspectRatio: '2/3' }}
          >
            {video.coverUrl ? (
              <Image
                src={video.coverUrl}
                alt={video.title}
                fill
                sizes="(max-width: 768px) 200px, 280px"
                className="object-cover w-full h-full"
                data-testid="detail-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: 'var(--secondary)' }}
              >
                <span className="text-5xl opacity-30">🎬</span>
              </div>
            )}
          </div>

          <Link
            href={watchHref}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-bold transition-all shadow-[0_0_20px_rgba(232,184,75,0.3)] hover:shadow-[0_0_30px_rgba(232,184,75,0.6)] hover:scale-105"
            style={{ background: 'var(--accent)', color: 'black' }}
            data-testid="detail-watch-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            立即播放
          </Link>
        </div>

        {/* 基础信息 (右侧主体) */}
        <div className="flex-1 space-y-6 pt-2">
          <div className="space-y-2">
            <h1
              className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight drop-shadow-md"
              style={{ color: 'var(--foreground)' }}
              data-testid="detail-title"
            >
              {video.title}
            </h1>

            {video.titleEn && (
              <p className="text-lg font-medium tracking-wide drop-shadow-sm" style={{ color: 'var(--muted-foreground)' }}>
                {video.titleEn}
              </p>
            )}
          </div>

          {/* 类型标签行 */}
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="px-3 py-1 rounded-md text-sm font-bold tracking-wide"
              style={{ background: 'var(--accent)', color: 'black' }}
            >
              {TYPE_LABELS[video.type] ?? video.type}
            </span>

            {video.rating !== null && (
              <span
                className="px-3 py-1 rounded-md text-sm font-bold border border-white/20 backdrop-blur-sm"
                style={{ color: 'var(--accent)', background: 'rgba(0,0,0,0.4)' }}
              >
                ★ {video.rating.toFixed(1)}
              </span>
            )}

            <span
              className="px-3 py-1 rounded-md text-sm font-medium border"
              style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)', background: 'var(--secondary)' }}
            >
              {STATUS_LABELS[video.status] ?? video.status}
            </span>

            <div className="flex items-center gap-3 text-sm font-medium pl-2 border-l" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
              {video.year && <span>{video.year}</span>}
              {video.country && <span>{video.country}</span>}
              {video.episodeCount > 1 && <span>全 {video.episodeCount} 集</span>}
            </div>
          </div>

          {/* 简介 */}
          {video.description && (
            <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>剧情简介</h3>
              <p
                className="text-base leading-relaxed max-w-4xl"
                style={{ color: 'var(--muted-foreground)' }}
                data-testid="detail-description"
              >
                {video.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
