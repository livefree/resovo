'use client'

/**
 * ShelfRow — HANDOFF-14 对齐 docs/frontend_design_spec_20260423.md §11
 *   （CARD-SIZE-FEATURED-NORMALIZE / ADR-214 D-214-8：top10-row / featured-grid 死模板已删，仅存 poster-row）
 *
 * template：
 *   poster-row     — 横向滚动，portrait 卡 var(--card-w) 170px，2:3 比例
 *   （注：首页 TOP10 用独立 TopTenRow 组件、精选用 FeaturedRow→CardGrid standard，非本组件模板）
 *
 * Token 消费：
 *   横滚 gap       → var(--card-gap)        16px（CARD-SIZE-SCROLL：DB 注入）
 *   bottom padding → var(--shelf-bottom-padding)   8px
 *   portrait 宽    → var(--card-w)          170px
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
import { useBrand } from '@/hooks/useBrand'
import { VideoCard } from './VideoCard'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import type { VideoCard as VideoCardType, ApiListResponse, HomeShelfResponse, HomeShelfSection } from '@resovo/types'

// ── 常量 ──────────────────────────────────────────────────────────────────────

const MIN_SLOTS = 4  // --shelf-empty-min-slots

// ── Types ─────────────────────────────────────────────────────────────────────

// CARD-SIZE-FEATURED-NORMALIZE：模板收敛单值 'poster-row'（top10-row/featured-grid 死路径已删）。
// prop 保留以兼容现有调用点（page.tsx / ShelfRow.test 显式传 "poster-row"），避免无谓 churn。
type ShelfTemplate = 'poster-row'

interface ShelfRowProps {
  readonly template: ShelfTemplate
  /** API query string，例如 "type=movie&period=week&limit=10"（shelfSection 提供时作为降级路径） */
  readonly query: string
  /**
   * 提供时优先消费公开聚合 `GET /home/shelf?section=...`（ADR-184，pinned 头部 +
   * 候选快照合成 + brand 透传）；items 空或请求失败时降级 `query` 趋势路径
   * （方案 §7.1「站内兜底趋势」消费侧兜底）。缺省时行为不变（纯趋势消费）。
   */
  readonly shelfSection?: HomeShelfSection
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
        gap: 'var(--card-gap)',
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
          gap: 'var(--card-gap)',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          paddingBottom: 'var(--shelf-bottom-padding)',
        }}
      >
        {videos.map((video) => (
          <div
            key={video.id}
            style={{ width: 'var(--card-w)', flexShrink: 0, scrollSnapAlign: 'start' }}
          >
            <VideoCard video={video} />
          </div>
        ))}
        {Array.from({ length: empties }).map((_, i) => (
          <EmptyPlaceholderCard key={`empty-${i}`} width="var(--card-w)" aspectRatio="2/3" />
        ))}
      </div>
      {canRight && <TrackNavButton direction="next" onClick={scrollNext} />}
    </div>
  )
}

// ── ShelfRow ──────────────────────────────────────────────────────────────────

export function ShelfRow({
  // template 收敛单值 'poster-row'（CARD-SIZE-FEATURED-NORMALIZE）→ 不再分支，故不解构使用
  query,
  shelfSection,
  title,
  viewAllHref,
  viewAllLabel,
  badge,
  'data-testid': testId,
}: ShelfRowProps) {
  const { brand } = useBrand()
  const [videos, setVideos] = useState<VideoCardType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 迟到响应守卫（CHG-HOME-AUTOFILL-UI-FIX 同款教训：链式降级窗口期 props 可变）
    let cancelled = false
    setLoading(true)

    const fetchTrending = () =>
      apiClient
        .get<ApiListResponse<VideoCardType>>(`/videos/trending?${query}`, { skipAuth: true })
        .then((res) => { if (!cancelled) setVideos(res.data) })
        .catch(() => { if (!cancelled) setVideos([]) })

    // shelfSection 提供时优先聚合消费（ADR-184）；空/失败降级趋势（§7.1 消费侧兜底）
    const load = shelfSection
      ? apiClient
          .get<{ data: HomeShelfResponse }>(
            brand.slug
              ? `/home/shelf?section=${shelfSection}&brand_slug=${encodeURIComponent(brand.slug)}`
              : `/home/shelf?section=${shelfSection}`,
            { skipAuth: true },
          )
          .then((res) => {
            if (cancelled) return
            if (res.data.items.length === 0) return fetchTrending()
            setVideos(res.data.items.map((item) => item.video))
          })
          .catch(() => fetchTrending())
      : fetchTrending()

    load.finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query, shelfSection, brand.slug])

  const cardWidth = 'var(--card-w)'
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
      ) : (
        <PosterTrack videos={videos} testId={testId} />
      )}
    </section>
  )
}

// Re-export card width + cardWidth as named constants for other consumers
export { MIN_SLOTS as SHELF_MIN_SLOTS }
