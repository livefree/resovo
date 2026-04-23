'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { apiClient } from '@/lib/api-client'
import { SafeImage } from '@/components/media'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import { getVideoDetailHref } from '@/lib/video-route'
import { KenBurnsLayer } from './KenBurnsLayer'
import { BannerCarouselMobile } from './BannerCarouselMobile'
import type { LocalizedBannerCard, ApiListResponse, VideoType } from '@resovo/types'

const PALETTE_SIZE = 6
const AUTO_ADVANCE_MS = 5000

const SPEC_LABEL: Record<string, string> = {
  '4k': '4K',
  'hdr': 'HDR',
  'dolby': '杜比',
  'subtitled': '中字',
}

const TYPE_LABEL: Record<string, string> = {
  movie: '电影', series: '剧集', anime: '动漫',
  tvshow: '综艺', documentary: '纪录片', short: '短剧',
  sports: '体育', music: '音乐', news: '新闻', kids: '少儿', other: '其他',
}

// ── HeroV2 ────────────────────────────────────────────────────────────────────

export function HeroV2() {
  const locale = useLocale()
  const t = useTranslations()
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

  useEffect(() => {
    if (banners.length <= 1) return
    timerRef.current = setTimeout(() => {
      setActiveIndex((i) => (i + 1) % banners.length)
    }, AUTO_ADVANCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [activeIndex, banners.length])

  if (!loaded) return <HeroV2Skeleton />
  if (banners.length === 0) return null

  const banner = banners[activeIndex]
  const { watchHref, detailHref } = buildBannerHrefs(banner)
  const isExternal = banner.linkType === 'external'

  return (
    <div
      ref={containerRef}
      data-testid="hero-banner"
      className="relative w-full"
      style={{ '--banner-accent': 'var(--banner-accent-0)' } as React.CSSProperties}
    >
      {/* ── PC 布局（md 以上） ───────────────────────────────────────── */}
      <section
        className="hidden md:block relative w-full overflow-hidden"
        style={{ height: 520 }}
        aria-label="Hero banner"
      >
        {/* Background image */}
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

        {/* Scrim — left-to-right */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black/85 via-black/[.45] to-transparent" />
        {/* Scrim — bottom-to-top (canvas fade) */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[var(--bg-canvas)] via-[var(--bg-canvas)]/20 to-transparent" />

        {/* Content */}
        <div className="relative h-full max-w-screen-xl mx-auto px-6 flex flex-col justify-end pb-14 z-10">
          <HeroContent
            banner={banner}
            watchHref={watchHref}
            detailHref={detailHref}
            isExternal={isExternal}
            t={t}
          />

          {/* Horizontal dots */}
          {banners.length > 1 && (
            <div className="flex gap-1.5 mt-5" role="tablist" aria-label="Banner 导航">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={i === activeIndex}
                  aria-label={`Banner ${i + 1}: ${b.title}`}
                  onClick={() => goTo(i)}
                  data-testid={`banner-dot-${i}`}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === activeIndex ? 24 : 6,
                    background: i === activeIndex ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.35)', // eslint-disable-line resovo/no-hardcoded-color -- hero-scrim overlay: M1 token 迁移
                    transition: 'width 300ms ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right-side vertical progress bars */}
        {banners.length > 1 && (
          <div className="absolute right-6 bottom-14 flex flex-col gap-3 z-10" aria-hidden="true">
            {banners.map((_, i) => (
              <div
                key={i}
                className="w-10 h-[3px] rounded-sm overflow-hidden relative bg-white/25"
              >
                <div
                  className="absolute top-0 left-0 h-full bg-white transition-all duration-300"
                  style={{ width: i === activeIndex ? '60%' : '0%' }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 移动布局（md 以下） ─────────────────────────────────────────── */}
      <div className="md:hidden relative">
        <BannerCarouselMobile
          banners={banners}
          activeIndex={activeIndex}
          onSelect={goTo}
        />
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 z-10">
          <HeroContent
            banner={banner}
            watchHref={watchHref}
            detailHref={detailHref}
            isExternal={isExternal}
            t={t}
            compact
          />
        </div>
      </div>
    </div>
  )
}

// ── 内容块 ─────────────────────────────────────────────────────────────────────

type TranslateFn = ReturnType<typeof useTranslations>

interface HeroContentProps {
  banner: LocalizedBannerCard
  watchHref: string
  detailHref: string | null
  isExternal: boolean
  t: TranslateFn
  compact?: boolean
}

function HeroContent({ banner, watchHref, detailHref, isExternal, t, compact }: HeroContentProps) {
  if (compact) {
    return (
      <div className="space-y-3">
        <h2 className="text-2xl font-extrabold text-white leading-tight drop-shadow-xl line-clamp-2">
          {banner.title}
        </h2>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <WatchCta watchHref={watchHref} isExternal={isExternal} label={t('hero.watchNow')} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Featured label */}
      <div className="flex items-center gap-2 mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white/85">
        <span className="inline-block w-5 h-px bg-white/60" />
        {t('hero.featuredLabel')}
      </div>

      {/* Title */}
      <h1
        className="font-black text-white line-clamp-2"
        // eslint-disable-next-line resovo/no-hardcoded-color -- textShadow scrim: M1 token 迁移
        style={{
          fontSize: 56,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          textShadow: '0 2px 24px rgba(0,0,0,.4)',
          margin: '0 0 16px 0',
        }}
      >
        {banner.title}
      </h1>

      {/* Meta row */}
      <MetaRow banner={banner} />

      {/* Blurb */}
      {banner.blurb && (
        <p className="text-[15px] leading-[1.55] line-clamp-2 mb-6 text-white/85" style={{ maxWidth: 520 }}>
          {banner.blurb}
        </p>
      )}

      {/* CTA */}
      <div className="flex gap-3 items-center">
        <WatchCta watchHref={watchHref} isExternal={isExternal} label={t('hero.watchNow')} />

        {!isExternal && detailHref && (
          <Link
            href={detailHref}
            data-testid="hero-detail-btn"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[14px] font-semibold text-white bg-white/10 border border-white/25 backdrop-blur-sm"
          >
            <InfoIcon />
            {t('hero.details')}
          </Link>
        )}

        {!isExternal && (
          <button
            type="button"
            className="w-11 h-11 rounded-full inline-flex items-center justify-center text-white text-xl font-light bg-white/10 border border-white/25 backdrop-blur-sm"
            aria-label={t('hero.addToWatchlist')}
          >
            +
          </button>
        )}
      </div>
    </div>
  )
}

// ── Meta row ─────────────────────────────────────────────────────────────────

function MetaRow({ banner }: { banner: LocalizedBannerCard }) {
  const parts: React.ReactNode[] = []
  const sep = (key: string) => (
    <span key={key} className="text-white/50">·</span>
  )

  if (banner.rating != null) {
    parts.push(
      <span key="rating" className="flex items-center gap-1 text-[14px] font-bold">
        <span className="text-base">★</span>
        {/* eslint-disable-next-line resovo/no-hardcoded-color -- rating star amber: maps to --status-warning pending M1 token */}
        <span style={{ color: '#fde68a' }}>{banner.rating.toFixed(1)}</span>
      </span>
    )
  }

  if (banner.year) {
    if (parts.length > 0) parts.push(sep(`sep-year`))
    parts.push(
      <span key="year" className="text-[13px] text-white/85">{banner.year}</span>
    )
  }

  if (banner.videoType && TYPE_LABEL[banner.videoType]) {
    if (parts.length > 0) parts.push(sep(`sep-type`))
    parts.push(
      <span key="type" className="text-[13px] text-white/85">{TYPE_LABEL[banner.videoType]}</span>
    )
  }

  if (banner.episodeCount != null && banner.episodeCount > 1) {
    if (parts.length > 0) parts.push(sep(`sep-ep`))
    parts.push(
      <span key="ep" className="text-[13px] text-white/85">{banner.episodeCount}集</span>
    )
  }

  const specs = banner.specs?.filter((s) => SPEC_LABEL[s])
  const hasSpecs = specs && specs.length > 0
  const hasMeta = parts.length > 0 || hasSpecs

  if (!hasMeta) return null

  return (
    <div className="flex items-center gap-3 mb-3.5 flex-wrap">
      {parts}
      {hasSpecs && (
        <div className="flex gap-1.5 ml-1">
          {specs.map((s) => (
            <span
              key={s}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white bg-white/15 border border-white/25 backdrop-blur-sm"
            >
              {SPEC_LABEL[s]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── CTA helper ────────────────────────────────────────────────────────────────

function WatchCta({ watchHref, isExternal, label }: { watchHref: string; isExternal: boolean; label: string }) {
  const cls = "inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-[15px] text-[#111] bg-white hover:bg-white/90 transition-colors"
  // eslint-disable-next-line resovo/no-hardcoded-color -- CTA play button text is always #111 on white bg: M1 token 迁移
  const style = { boxShadow: '0 8px 24px rgba(0,0,0,.3)' } // eslint-disable-line resovo/no-hardcoded-color -- button shadow: M1 token

  if (isExternal) {
    return (
      <a href={watchHref} target="_blank" rel="noopener noreferrer" data-testid="hero-watch-btn" className={cls} style={style}>
        <PlayIcon />
        {label}
      </a>
    )
  }
  return (
    <Link href={watchHref} data-testid="hero-watch-btn" className={cls} style={style}>
      <PlayIcon />
      {label}
    </Link>
  )
}

// ── Banner href builder ───────────────────────────────────────────────────────

function buildBannerHrefs(banner: LocalizedBannerCard): { watchHref: string; detailHref: string | null } {
  if (banner.linkType === 'external') {
    return { watchHref: banner.linkTarget, detailHref: null }
  }
  if (banner.linkTarget.startsWith('/')) {
    return { watchHref: banner.linkTarget, detailHref: banner.linkTarget }
  }
  const watchHref = `/watch/${banner.linkTarget}?ep=1`
  const detailHref = banner.videoType
    ? getVideoDetailHref({
        type: banner.videoType as VideoType,
        slug: banner.videoSlug ?? null,
        shortId: banner.linkTarget,
      })
    : watchHref
  return { watchHref, detailHref }
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function HeroV2Skeleton() {
  return (
    <div
      className="relative w-full"
      data-testid="hero-banner-skeleton"
      aria-hidden="true"
    >
      <div className="hidden md:block" style={{ height: 520 }}>
        <Skeleton shape="rect" className="w-full h-full" />
      </div>
      <div className="md:hidden" style={{ aspectRatio: '5/6' }}>
        <Skeleton shape="rect" className="w-full h-full" />
      </div>
    </div>
  )
}

HeroV2.Skeleton = HeroV2Skeleton
