'use client'

/**
 * TopTenRow — 首页 TOP10 排行区块（HANDOFF-22）
 *
 * 数据源：GET /home/top10 → Top10Response
 * 布局：水平滚动竖版卡片（2:3 比例，var(--shelf-card-w-portrait) 170px）
 * Rank badge：图片右下角叠加，1–3 号 32px/700，4–10 号 20px/600，颜色 var(--fg-muted)
 *   badge 通过 aspectRatio:2/3 的绝对定位层固定在图片范围内，不遮挡标题文字
 * 副标题：由 sortStrategy 字段驱动 i18n key
 * 无数据：渲染 MIN_SLOTS(4) 个 EmptyPlaceholderCard
 */

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { VideoCard } from '@/components/video/VideoCard'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import type { Top10Response, Top10Item } from '@resovo/types'

// ── 常量 ──────────────────────────────────────────────────────────────────────

const MIN_SLOTS = 4

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopTenRowProps {
  readonly title: string
  readonly subtitle?: string
  readonly viewAllHref?: string
  readonly viewAllLabel?: string
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

// ── 子组件 ────────────────────────────────────────────────────────────────────

function EmptyPlaceholderCard({ width }: { readonly width: string }) {
  return (
    <div
      aria-hidden="true"
      data-testid="top10-empty-slot"
      style={{
        width,
        flexShrink: 0,
        aspectRatio: '2/3',
        borderRadius: '8px',
        border: '1px dashed var(--border-default)',
        background: 'var(--bg-surface-sunken)',
        opacity: 'var(--shelf-empty-opacity)',
        pointerEvents: 'none',
      }}
    />
  )
}

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

function RowHeader({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel,
}: {
  readonly title: string
  readonly subtitle?: string
  readonly viewAllHref?: string
  readonly viewAllLabel?: string
}) {
  return (
    <div className="flex items-start justify-between" style={{ marginBottom: '20px' }}>
      <div>
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
        {subtitle && (
          <p style={{ fontSize: '12px', color: 'var(--fg-muted)', marginTop: '2px' }}>
            {subtitle}
          </p>
        )}
      </div>
      {viewAllHref && viewAllLabel && (
        <Link
          href={viewAllHref}
          className="transition-opacity hover:opacity-70"
          style={{
            fontSize: '13px',
            color: 'var(--accent-default)',
            textDecoration: 'none',
            fontWeight: 500,
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          {viewAllLabel} →
        </Link>
      )}
    </div>
  )
}

function TrackSkeleton() {
  return (
    <div
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
          style={{ width: 'var(--shelf-card-w-portrait)', flexShrink: 0, aspectRatio: '2/3' }}
          delay={i >= 2 ? 300 : undefined}
        />
      ))}
    </div>
  )
}

function Top10Track({ items }: { readonly items: Top10Item[] }) {
  const slots = Math.max(items.length, MIN_SLOTS)
  const empties = Math.max(0, slots - items.length)
  const { trackRef, canLeft, canRight, scrollPrev, scrollNext } = useScrollTrack()

  return (
    <div className="relative">
      {canLeft && <TrackNavButton direction="prev" onClick={scrollPrev} />}
      <div
        ref={trackRef}
        data-testid="top10-track"
        style={{
          display: 'flex',
          gap: 'var(--shelf-gap)',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          paddingBottom: 'var(--shelf-bottom-padding)',
        }}
      >
        {items.map((item) => (
          <div
            key={item.video.id}
            style={{
              width: 'var(--shelf-card-w-portrait)',
              flexShrink: 0,
              scrollSnapAlign: 'start',
              position: 'relative',
            }}
          >
            {/* badge 定位层：仅覆盖图片区域（2:3），确保不遮挡图片下方标题文字 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                aspectRatio: '2/3',
                zIndex: 5,
                pointerEvents: 'none',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  fontSize: item.rank <= 3 ? '32px' : '20px',
                  fontWeight: item.rank <= 3 ? 700 : 600,
                  lineHeight: 1,
                  color: 'var(--fg-muted)',
                  WebkitTextStroke: '1px var(--bg-canvas)',
                  userSelect: 'none',
                }}
              >
                {item.rank}
              </span>
            </div>
            <VideoCard video={item.video} />
          </div>
        ))}
        {Array.from({ length: empties }).map((_, i) => (
          <EmptyPlaceholderCard key={`empty-${i}`} width="var(--shelf-card-w-portrait)" />
        ))}
      </div>
      {canRight && <TrackNavButton direction="next" onClick={scrollNext} />}
    </div>
  )
}

// ── TopTenRow ─────────────────────────────────────────────────────────────────

export function TopTenRow({ title, subtitle, viewAllHref, viewAllLabel }: TopTenRowProps) {
  const [items, setItems] = useState<Top10Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient
      .get<{ data: Top10Response }>('/home/top10', { skipAuth: true })
      .then((res) => setItems(res.data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section>
      <RowHeader title={title} subtitle={subtitle} viewAllHref={viewAllHref} viewAllLabel={viewAllLabel} />
      {loading ? <TrackSkeleton /> : <Top10Track items={items} />}
    </section>
  )
}
