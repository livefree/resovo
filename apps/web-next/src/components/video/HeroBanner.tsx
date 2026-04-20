'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { getVideoDetailHref } from '@/lib/video-route'
import { SafeImage } from '@/components/media'
import type { VideoCard, ApiListResponse } from '@resovo/types'

export function HeroBanner() {
  const [featured, setFeatured] = useState<VideoCard | null>(null)

  useEffect(() => {
    apiClient
      .get<ApiListResponse<VideoCard>>('/videos/trending?period=week&limit=1', { skipAuth: true })
      .then((res) => {
        if (res.data.length > 0) setFeatured(res.data[0])
      })
      .catch(() => {
        // 静默失败，HeroBanner 不显示内容
      })
  }, [])

  if (!featured) {
    return (
      <div
        className="relative w-full flex items-end"
        style={{ height: 420, background: 'var(--bg-surface-sunken)' }}
        data-testid="hero-banner"
        aria-label="Hero banner"
      >
        <div className="absolute inset-0 animate-pulse" style={{ background: 'var(--bg-surface-sunken)' }} />
      </div>
    )
  }

  const href = featured.slug
    ? `/watch/${featured.slug}-${featured.shortId}?ep=1`
    : `/watch/${featured.shortId}?ep=1`

  return (
    <div
      className="relative w-full overflow-hidden flex items-end"
      style={{ minHeight: '65vh', maxHeight: '800px', background: 'var(--bg-canvas)' }}
      data-testid="hero-banner"
    >
      {featured.coverUrl && (
        <div className="absolute inset-0" aria-hidden>
          <SafeImage
            src={featured.coverUrl}
            alt=""
            width={1920}
            height={1080}
            priority
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', aspectRatio: 'unset' }}
            imgClassName="object-cover"
            fallback={{ seed: featured.id }}
          />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-canvas)] via-[var(--bg-canvas)]/20 to-transparent" />

      <div className="relative w-full max-w-screen-xl mx-auto px-4 pb-16 z-10">
        <div className="max-w-2xl space-y-4">
          {featured.rating !== null && (
            <span className="inline-block px-2.5 py-1 bg-black/50 backdrop-blur-md rounded border border-white/10 text-sm font-bold text-[var(--accent-default)]">
              ★ {featured.rating.toFixed(1)} {featured.year && `· ${featured.year}`}
            </span>
          )}
          <h2 className="text-4xl md:text-5xl xl:text-6xl font-extrabold text-white leading-tight drop-shadow-xl line-clamp-2">
            {featured.title}
          </h2>
          {featured.titleEn && (
            <p className="text-lg text-white/70 font-medium tracking-wide drop-shadow-md">
              {featured.titleEn}
            </p>
          )}

          <div className="pt-6 flex flex-wrap items-center gap-4">
            <Link
              href={href}
              data-testid="hero-watch-btn"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-black bg-[var(--accent-default)] hover:scale-105 transition-transform duration-300 shadow-[0_0_20px_rgba(232,184,75,0.4)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              立即播放
            </Link>

            <Link
              href={getVideoDetailHref(featured)}
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full font-bold text-white bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors duration-300"
            >
              详情信息
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
