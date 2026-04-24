'use client'

/**
 * ShelfRow — HANDOFF-14 对齐 docs/frontend_design_spec_20260423.md §11
 *
 * 4 种 template：
 *   poster-row     — 横向滚动，portrait 卡 170px，2:3 比例
 *   landscape-row  — 横向滚动，portrait 卡 170px，2:3 比例（HANDOFF-20 统一竖版）
 *   top10-row      — 横向滚动，portrait 卡 170px + 排名数字叠层
 *   featured-grid  — 5 列网格，portrait 卡
 *
 * Token 消费：
 *   card gap       → var(--shelf-gap)              16px
 *   bottom padding → var(--shelf-bottom-padding)   8px
 *   portrait 宽    → var(--shelf-card-w-portrait)  170px
 *   landscape 宽   → var(--shelf-card-w-landscape) 300px
 *   top10 宽       → var(--shelf-card-w-top10)     170px
 *   empty opacity  → var(--shelf-empty-opacity)    0.32
 *
 * 不变量：
 *   - 数据为 0 时轨道仍存在，渲染 MIN_SLOTS(4) 个 EmptyPlaceholderCard
 *   - 数据 < MIN_SLOTS 时补足至 MIN_SLOTS
 *   - EmptyPlaceholderCard：静态、不可点击、opacity var(--shelf-empty-opacity)
 */

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { VideoCard } from './VideoCard'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import type { VideoCard as VideoCardType, ApiListResponse } from '@resovo/types'

// ── 常量 ──────────────────────────────────────────────────────────────────────

const MIN_SLOTS = 4  // --shelf-empty-min-slots

// ── Types ─────────────────────────────────────────────────────────────────────

type ShelfTemplate = 'featured-grid' | 'top10-row' | 'poster-row' | 'landscape-row'

interface ShelfRowProps {
  readonly template: ShelfTemplate
  /** API query string，例如 "type=movie&period=week&limit=10" */
  readonly query: string
  readonly title: string
  readonly viewAllHref?: string
  readonly viewAllLabel?: string
  readonly badge?: string
  /** forwarded to the track container for e2e / unit test selection */
  readonly 'data-testid'?: string
}

// ── EmptyPlaceholderCard ───────────────────────────────────────────────────────

interface EmptyCardProps {
  readonly width: string
  readonly aspectRatio: string
}

function EmptyPlaceholderCard({ width, aspectRatio }: EmptyCardProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="shelf-empty-slot"
      style={{
        width,
        flexShrink: 0,
        aspectRatio,
        borderRadius: '8px',
        border: '1px dashed var(--border-default)',
        background: 'var(--bg-surface-sunken)',
        opacity: 'var(--shelf-empty-opacity)',
        pointerEvents: 'none',
      }}
    />
  )
}

// ── EmptyCardGrid（grid 版本，宽 100%）────────────────────────────────────────

function EmptyPlaceholderCardGrid({ aspectRatio }: { readonly aspectRatio: string }) {
  return (
    <div
      aria-hidden="true"
      data-testid="shelf-empty-slot"
      style={{
        aspectRatio,
        borderRadius: '8px',
        border: '1px dashed var(--border-default)',
        background: 'var(--bg-surface-sunken)',
        opacity: 'var(--shelf-empty-opacity)',
        pointerEvents: 'none',
      }}
    />
  )
}

// ── RowHeader ─────────────────────────────────────────────────────────────────

interface RowHeaderProps {
  readonly title: string
  readonly badge?: string
  readonly viewAllHref?: string
  readonly viewAllLabel?: string
}

function RowHeader({ title, badge, viewAllHref, viewAllLabel }: RowHeaderProps) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ marginBottom: '20px' }}
    >
      {/* 左侧：标题 + badge */}
      <div className="flex items-center" style={{ gap: '10px' }}>
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--fg-default)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h2>
        {badge && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '99px',
              background: 'var(--accent-muted)',
              color: 'var(--accent-default)',
              letterSpacing: '0.04em',
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* 右侧：查看全部 */}
      {viewAllHref && viewAllLabel && (
        <Link
          href={viewAllHref}
          className="transition-opacity hover:opacity-70"
          style={{
            fontSize: '13px',
            color: 'var(--accent-default)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          {viewAllLabel} →
        </Link>
      )}
    </div>
  )
}

// ── 水平滚动 hook ─────────────────────────────────────────────────────────────

function useScrollTrack() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const node: HTMLDivElement = el
    function update() {
      setCanLeft(node.scrollLeft > 4)
      setCanRight(node.scrollLeft < node.scrollWidth - node.clientWidth - 4)
    }
    update()
    node.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => {
      node.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])

  function scrollPrev() { trackRef.current?.scrollBy({ left: -540, behavior: 'smooth' }) }
  function scrollNext() { trackRef.current?.scrollBy({ left: 540, behavior: 'smooth' }) }

  return { trackRef, canLeft, canRight, scrollPrev, scrollNext }
}

// ── TrackNavButton ────────────────────────────────────────────────────────────

function TrackNavButton({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'prev' ? '向左滚动' : '向右滚动'}
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        [direction === 'prev' ? 'left' : 'right']: '-16px',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        color: 'var(--fg-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 10,
        fontSize: '20px',
        lineHeight: 1,
      }}
    >
      {direction === 'prev' ? '‹' : '›'}
    </button>
  )
}

// ── Skeleton track ────────────────────────────────────────────────────────────

function HorizontalTrackSkeleton({ cardWidth, aspectRatio, testId }: {
  readonly cardWidth: string
  readonly aspectRatio: string
  readonly testId?: string
}) {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        gap: 'var(--shelf-gap)',
        paddingBottom: 'var(--shelf-bottom-padding)',
        overflowX: 'hidden',
      }}
    >
      {Array.from({ length: MIN_SLOTS }).map((_, i) => (
        <Skeleton
          key={i}
          shape="rect"
          style={{ width: cardWidth, flexShrink: 0, aspectRatio }}
          delay={i >= 2 ? 300 : undefined}
        />
      ))}
    </div>
  )
}

// ── poster-row track ──────────────────────────────────────────────────────────

function PosterTrack({ videos, testId }: { readonly videos: VideoCardType[]; readonly testId?: string }) {
  const slots = Math.max(videos.length, MIN_SLOTS)
  const empties = Math.max(0, slots - videos.length)
  const { trackRef, canLeft, canRight, scrollPrev, scrollNext } = useScrollTrack()

  return (
    <div className="relative">
      {canLeft && <TrackNavButton direction="prev" onClick={scrollPrev} />}
      <div
        ref={trackRef}
        data-testid={testId}
        style={{
          display: 'flex',
          gap: 'var(--shelf-gap)',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          paddingBottom: 'var(--shelf-bottom-padding)',
        }}
      >
        {videos.map((video) => (
          <div
            key={video.id}
            style={{ width: 'var(--shelf-card-w-portrait)', flexShrink: 0, scrollSnapAlign: 'start' }}
          >
            <VideoCard video={video} />
          </div>
        ))}
        {Array.from({ length: empties }).map((_, i) => (
          <EmptyPlaceholderCard key={`empty-${i}`} width="var(--shelf-card-w-portrait)" aspectRatio="2/3" />
        ))}
      </div>
      {canRight && <TrackNavButton direction="next" onClick={scrollNext} />}
    </div>
  )
}

// ── landscape-row track（统一竖版，HANDOFF-20，与 PosterTrack 完全一致）────────

function LandscapeTrack({ videos, testId }: { readonly videos: VideoCardType[]; readonly testId?: string }) {
  return <PosterTrack videos={videos} testId={testId} />
}

// ── top10-row track ───────────────────────────────────────────────────────────

function Top10Track({ videos, testId }: { readonly videos: VideoCardType[]; readonly testId?: string }) {
  const slots = Math.max(videos.length, MIN_SLOTS)
  const empties = Math.max(0, slots - videos.length)
  const { trackRef, canLeft, canRight, scrollPrev, scrollNext } = useScrollTrack()

  return (
    <div className="relative">
      {canLeft && <TrackNavButton direction="prev" onClick={scrollPrev} />}
      <div
        ref={trackRef}
        data-testid={testId}
        style={{
          display: 'flex',
          gap: 'var(--shelf-gap)',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          paddingBottom: 'var(--shelf-bottom-padding)',
        }}
      >
        {videos.map((video, rank) => (
          <div
            key={video.id}
            className="relative"
            style={{ width: 'var(--shelf-card-w-top10)', flexShrink: 0, scrollSnapAlign: 'start' }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: '-4px',
                left: '-8px',
                fontSize: '80px',
                fontWeight: 900,
                lineHeight: 1,
                color: 'var(--fg-default)',
                letterSpacing: '-0.06em',
                WebkitTextStroke: '2px var(--bg-canvas)',
                zIndex: 2,
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              {rank + 1}
            </span>
            <div style={{ paddingLeft: '24px' }}>
              <VideoCard video={video} />
            </div>
          </div>
        ))}
        {Array.from({ length: empties }).map((_, i) => (
          <EmptyPlaceholderCard key={`empty-${i}`} width="var(--shelf-card-w-top10)" aspectRatio="2/3" />
        ))}
      </div>
      {canRight && <TrackNavButton direction="next" onClick={scrollNext} />}
    </div>
  )
}

// ── featured-grid track ───────────────────────────────────────────────────────

function FeaturedGrid({ videos, testId }: { readonly videos: VideoCardType[]; readonly testId?: string }) {
  const slots = Math.max(videos.length, MIN_SLOTS)
  const empties = Math.max(0, slots - videos.length)

  return (
    <div
      data-testid={testId}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 'var(--shelf-gap)',
        paddingBottom: 'var(--shelf-bottom-padding)',
      }}
    >
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
      {Array.from({ length: empties }).map((_, i) => (
        <EmptyPlaceholderCardGrid key={`empty-${i}`} aspectRatio="2/3" />
      ))}
    </div>
  )
}

// ── ShelfRow ──────────────────────────────────────────────────────────────────

export function ShelfRow({
  template,
  query,
  title,
  viewAllHref,
  viewAllLabel,
  badge,
  'data-testid': testId,
}: ShelfRowProps) {
  const [videos, setVideos] = useState<VideoCardType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient
      .get<ApiListResponse<VideoCardType>>(`/videos/trending?${query}`, { skipAuth: true })
      .then((res) => setVideos(res.data))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }, [query])

  const cardWidth = 'var(--shelf-card-w-portrait)'
  const aspectRatio = '2/3'

  return (
    <section>
      <RowHeader
        title={title}
        badge={badge}
        viewAllHref={viewAllHref}
        viewAllLabel={viewAllLabel}
      />

      {loading ? (
        <HorizontalTrackSkeleton
          cardWidth={cardWidth}
          aspectRatio={aspectRatio}
          testId={testId}
        />
      ) : template === 'poster-row' ? (
        <PosterTrack videos={videos} testId={testId} />
      ) : template === 'landscape-row' ? (
        <LandscapeTrack videos={videos} testId={testId} />
      ) : template === 'top10-row' ? (
        <Top10Track videos={videos} testId={testId} />
      ) : (
        <FeaturedGrid videos={videos} testId={testId} />
      )}
    </section>
  )
}

// Re-export card width + cardWidth as named constants for other consumers
export { MIN_SLOTS as SHELF_MIN_SLOTS }
