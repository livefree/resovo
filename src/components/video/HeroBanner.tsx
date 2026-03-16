/**
 * HeroBanner.tsx — 首页 Hero 轮播（客户端组件）
 * 展示最新热门内容的特色封面 + 标题 + 简介
 */

'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import type { VideoCard, ApiListResponse } from '@/types'

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
    // 占位状态（加载中或无数据）
    return (
      <div
        className="relative w-full flex items-end"
        style={{ height: 420, background: 'var(--secondary)' }}
        data-testid="hero-banner"
        aria-label="Hero banner"
      >
        <div className="absolute inset-0 animate-pulse" style={{ background: 'var(--secondary)' }} />
      </div>
    )
  }

  const href = featured.slug
    ? `/watch/${featured.slug}-${featured.shortId}?ep=1`
    : `/watch/${featured.shortId}?ep=1`

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 420 }}
      data-testid="hero-banner"
    >
      {/* 背景图 */}
      {featured.coverUrl && (
        <Image
          src={featured.coverUrl}
          alt={featured.title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      )}

      {/* 渐变遮罩 */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.85) 40%, transparent 100%)' }}
      />

      {/* 内容 */}
      <div className="relative h-full max-w-screen-xl mx-auto px-4 flex flex-col justify-end pb-10">
        <div className="max-w-lg">
          {featured.rating !== null && (
            <span className="text-sm font-medium" style={{ color: '#f5c518' }}>
              ★ {featured.rating.toFixed(1)} · {featured.year ?? ''}
            </span>
          )}
          <h2 className="mt-1 text-3xl font-bold text-white leading-tight line-clamp-2">
            {featured.title}
          </h2>
          {featured.titleEn && (
            <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {featured.titleEn}
            </p>
          )}
          <Link
            href={href}
            data-testid="hero-watch-btn"
            className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-black transition-opacity hover:opacity-90"
            style={{ background: 'var(--gold)' }}
          >
            ▶ 立即观看
          </Link>
        </div>
      </div>
    </div>
  )
}
