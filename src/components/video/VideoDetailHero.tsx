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

      <div className="relative max-w-screen-xl mx-auto px-4 py-8 flex flex-col sm:flex-row gap-6">
        {/* 封面图 */}
        <div
          className="shrink-0 rounded-xl overflow-hidden shadow-lg"
          style={{ width: 180, aspectRatio: '2/3' }}
        >
          {video.coverUrl ? (
            <Image
              src={video.coverUrl}
              alt={video.title}
              width={180}
              height={270}
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

        {/* 基础信息 */}
        <div className="flex-1 space-y-3">
          {/* 标题 */}
          <h1
            className="text-2xl sm:text-3xl font-bold leading-tight"
            style={{ color: 'var(--foreground)' }}
            data-testid="detail-title"
          >
            {video.title}
          </h1>

          {/* 英文标题 */}
          {video.titleEn && (
            <p className="text-base" style={{ color: 'var(--muted-foreground)' }}>
              {video.titleEn}
            </p>
          )}

          {/* 类型标签行 */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs font-semibold"
              style={{ background: 'var(--gold)', color: 'black' }}
            >
              {TYPE_LABELS[video.type] ?? video.type}
            </span>

            {video.rating !== null && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--gold)' }}
              >
                ★ {video.rating.toFixed(1)}
              </span>
            )}

            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
            >
              {STATUS_LABELS[video.status] ?? video.status}
            </span>

            {video.year && (
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {video.year}
              </span>
            )}

            {video.country && (
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {video.country}
              </span>
            )}

            {video.episodeCount > 1 && (
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {video.episodeCount} 集
              </span>
            )}
          </div>

          {/* 简介 */}
          {video.description && (
            <p
              className="text-sm leading-relaxed line-clamp-4 max-w-prose"
              style={{ color: 'var(--muted-foreground)' }}
              data-testid="detail-description"
            >
              {video.description}
            </p>
          )}

          {/* 立即观看按钮 */}
          <Link
            href={watchHref}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--gold)', color: 'black' }}
            data-testid="detail-watch-btn"
          >
            ▶ 立即观看
          </Link>
        </div>
      </div>
    </section>
  )
}
