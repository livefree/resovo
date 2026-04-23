'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { apiClient } from '@/lib/api-client'
import { SafeImage } from '@/components/media'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import { getVideoDetailHref } from '@/lib/video-route'
import { KenBurnsLayer } from './KenBurnsLayer'
import { BannerCarouselMobile } from './BannerCarouselMobile'
import type { LocalizedBannerCard, ApiListResponse, VideoType } from '@resovo/types'

// 轮播主色调色板索引，对应 globals.css --banner-accent-{N}
const PALETTE_SIZE = 6

const AUTO_ADVANCE_MS = 5000

// ── HeroBanner ────────────────────────────────────────────────────────────────

export function HeroBanner() {
  const locale = useLocale()
  const [banners, setBanners] = useState<LocalizedBannerCard[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiClient
      .get<ApiListResponse<LocalizedBannerCard>>(`/banners?locale=${encodeURIComponent(locale)}`, { skipAuth: true })
      .then((res) => { setBanners(res.data); setLoaded(true) })
      .catch(() => { setLoaded(true) })
  }, [locale])

  // 更新 --banner-accent CSS 变量（指向调色板 token）
  useEffect(() => {
    const el = containerRef.current
    if (!el || banners.length === 0) return
    el.style.setProperty('--banner-accent', `var(--banner-accent-${activeIndex % PALETTE_SIZE})`)
  }, [activeIndex, banners.length])

  const goTo = useCallback((index: number) => {
    setActiveIndex(index)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setActiveIndex((i) => (i + 1) % Math.max(banners.length, 1))
    }, AUTO_ADVANCE_MS)
  }, [banners.length])

  // 自动轮播
  useEffect(() => {
    if (banners.length <= 1) return
    timerRef.current = setTimeout(() => {
      setActiveIndex((i) => (i + 1) % banners.length)
    }, AUTO_ADVANCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [activeIndex, banners.length])

  if (!loaded) return <HeroBannerSkeleton />
  if (banners.length === 0) return null

  const banner = banners[activeIndex]

  function buildWatchHref(b: LocalizedBannerCard): string {
    if (b.linkType === 'external') return b.linkTarget
    return b.linkTarget.startsWith('/') ? b.linkTarget : `/watch/${b.linkTarget}?ep=1`
  }

  return (
    <div
      ref={containerRef}
      data-testid="hero-banner"
      className="relative w-full"
      style={{ '--banner-accent': 'var(--banner-accent-0)' } as React.CSSProperties}
    >
      {/* ── PC 布局（md 以上） ───────────────────────────────────── */}
      <div
        className="hidden md:flex relative w-full overflow-hidden items-end"
        style={{ height: 'min(520px, 60vh)' }}
        aria-label="Hero banner"
      >
        <div className="absolute inset-0 overflow-hidden">
          <KenBurnsLayer key={activeIndex} direction={(activeIndex % 2) as 0 | 1}>
            <SafeImage
              src={banner.imageUrl}
              alt={banner.title}
              width={1920}
              height={1080}
              priority
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', aspectRatio: 'unset' }}
              imgClassName="object-cover"
              fallback={{ seed: banner.id }}
            />
          </KenBurnsLayer>
        </div>

        {/* 渐变叠层 */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-canvas)] via-[var(--bg-canvas)]/20 to-transparent pointer-events-none" />

        {/* HANDOFF-13: max-w-feature(1200px) + px-6(24px) + pb-14(56px) — spec §10.2 */}
        <div className="relative w-full max-w-feature mx-auto px-6 pb-14 z-10">
          <BannerContent banner={banner} />
          {banners.length > 1 && (
            <BannerDots banners={banners} activeIndex={activeIndex} onSelect={goTo} />
          )}
        </div>
      </div>

      {/* ── 移动布局（md 以下） ─────────────────────────────────── */}
      <div className="md:hidden relative">
        <BannerCarouselMobile
          banners={banners}
          activeIndex={activeIndex}
          onSelect={goTo}
        />
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 z-10">
          <BannerContent banner={banner} compact />
          {banners.length > 1 && (
            <BannerDots banners={banners} activeIndex={activeIndex} onSelect={goTo} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── 内容块 ─────────────────────────────────────────────────────────────────

interface BannerContentProps {
  banner: LocalizedBannerCard
  compact?: boolean
}

function buildBannerHrefs(banner: LocalizedBannerCard): { watchHref: string; detailHref: string | null } {
  if (banner.linkType === 'external') {
    return { watchHref: banner.linkTarget, detailHref: null }
  }
  // 内部视频：linkTarget 可能是 shortId 或完整路径
  if (banner.linkTarget.startsWith('/')) {
    return { watchHref: banner.linkTarget, detailHref: banner.linkTarget }
  }
  const watchHref = `/watch/${banner.linkTarget}?ep=1`
  // 有 videoType 时用 getVideoDetailHref 构造精确 detail 路径
  const detailHref = banner.videoType
    ? getVideoDetailHref({
        type: banner.videoType as VideoType,
        slug: banner.videoSlug ?? null,
        shortId: banner.linkTarget,
      })
    : watchHref // 降级：无 videoType 时 detail 也指向 /watch
  return { watchHref, detailHref }
}

function BannerContent({ banner, compact }: BannerContentProps) {
  const isExternal = banner.linkType === 'external'
  const { watchHref, detailHref } = buildBannerHrefs(banner)

  return (
    <div className={compact ? 'space-y-3' : 'max-w-2xl space-y-4'}>
      <h2
        className={compact
          ? 'text-2xl font-extrabold text-white leading-tight drop-shadow-xl line-clamp-2'
          : 'text-4xl md:text-5xl font-extrabold text-white leading-tight drop-shadow-xl line-clamp-2'}
      >
        {banner.title}
      </h2>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        {isExternal ? (
          <a
            href={watchHref}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="hero-watch-btn"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-transform hover:scale-105"
            style={{ background: 'var(--banner-accent, var(--accent-default))', color: 'var(--accent-fg)', transition: 'background 1s ease' }}
          >
            <PlayIcon />
            立即观看
          </a>
        ) : (
          <>
            <Link
              href={watchHref}
              data-testid="hero-watch-btn"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-transform hover:scale-105"
              style={{ background: 'var(--banner-accent, var(--accent-default))', color: 'var(--accent-fg)', transition: 'background 1s ease' }}
            >
              <PlayIcon />
              立即播放
            </Link>
            {detailHref && !compact && (
              <Link
                href={detailHref}
                data-testid="hero-detail-btn"
                className="inline-flex items-center px-6 py-3 rounded-full font-bold text-sm text-white bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
              >
                详情信息
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

// ── 指示点 ────────────────────────────────────────────────────────────────────

interface BannerDotsProps {
  banners: LocalizedBannerCard[]
  activeIndex: number
  onSelect: (i: number) => void
}

function BannerDots({ banners, activeIndex, onSelect }: BannerDotsProps) {
  return (
    <div className="flex gap-1.5 mt-4" role="tablist" aria-label="Banner 导航">
      {banners.map((b, i) => (
        <button
          key={b.id}
          type="button"
          role="tab"
          aria-selected={i === activeIndex}
          aria-label={`Banner ${i + 1}: ${b.title}`}
          onClick={() => onSelect(i)}
          data-testid={`banner-dot-${i}`}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width: i === activeIndex ? 24 : 6,
            background: i === activeIndex
              ? 'var(--banner-accent, var(--accent-default))'
              : 'var(--banner-dot-inactive)',
            transition: 'width 300ms ease, background 1s ease',
          }}
        />
      ))}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function HeroBannerSkeleton() {
  return (
    <div
      className="relative w-full"
      data-testid="hero-banner-skeleton"
      aria-hidden="true"
    >
      {/* PC skeleton */}
      <div className="hidden md:block" style={{ height: 'min(520px, 60vh)' }}>
        <Skeleton shape="rect" className="w-full h-full" />
      </div>
      {/* Mobile skeleton */}
      <div className="md:hidden" style={{ aspectRatio: '5/6' }}>
        <Skeleton shape="rect" className="w-full h-full" />
      </div>
    </div>
  )
}

HeroBanner.Skeleton = HeroBannerSkeleton
