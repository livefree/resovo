'use client'

/**
 * TopTenRow — 首页 TOP10 排行区块（HANDOFF-22）
 *
 * 数据源：GET /home/top10 → Top10Response
 * 布局：水平滚动竖版卡片（2:3 比例，var(--shelf-card-w-portrait) 170px）
 * Rank badge：左下角叠加，1–3 号 32px/700，4–10 号 20px/600，颜色 var(--fg-muted)
 * 副标题：由 sortStrategy 字段驱动 i18n key
 * 无数据：渲染 MIN_SLOTS(4) 个 EmptyPlaceholderCard
 */

import { useEffect, useState } from 'react'
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

// ── 子组件 ────────────────────────────────────────────────────────────────────

interface EmptyCardProps {
  readonly width: string
}

function EmptyPlaceholderCard({ width }: EmptyCardProps) {
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
    <div
      className="flex items-start justify-between"
      style={{ marginBottom: '20px' }}
    >
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
          <p
            style={{
              fontSize: '12px',
              color: 'var(--fg-muted)',
              marginTop: '2px',
            }}
          >
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

function RankBadge({ rank }: { readonly rank: number }) {
  const isTop3 = rank <= 3
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        bottom: '4px',
        left: '4px',
        fontSize: isTop3 ? '32px' : '20px',
        fontWeight: isTop3 ? 700 : 600,
        lineHeight: 1,
        color: 'var(--fg-muted)',
        zIndex: 2,
        userSelect: 'none',
        pointerEvents: 'none',
        textShadow: '0 1px 3px rgba(0,0,0,0.6)',
      }}
    >
      {rank}
    </span>
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
          style={{
            width: 'var(--shelf-card-w-portrait)',
            flexShrink: 0,
            aspectRatio: '2/3',
          }}
          delay={i >= 2 ? 300 : undefined}
        />
      ))}
    </div>
  )
}

function Top10Track({ items }: { readonly items: Top10Item[] }) {
  const slots = Math.max(items.length, MIN_SLOTS)
  const empties = Math.max(0, slots - items.length)

  return (
    <div
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
          className="relative"
          style={{
            width: 'var(--shelf-card-w-portrait)',
            flexShrink: 0,
            scrollSnapAlign: 'start',
          }}
        >
          <RankBadge rank={item.rank} />
          <VideoCard video={item.video} />
        </div>
      ))}
      {Array.from({ length: empties }).map((_, i) => (
        <EmptyPlaceholderCard
          key={`empty-${i}`}
          width="var(--shelf-card-w-portrait)"
        />
      ))}
    </div>
  )
}

// ── TopTenRow ─────────────────────────────────────────────────────────────────

export function TopTenRow({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel,
}: TopTenRowProps) {
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
      <RowHeader
        title={title}
        subtitle={subtitle}
        viewAllHref={viewAllHref}
        viewAllLabel={viewAllLabel}
      />
      {loading ? (
        <TrackSkeleton />
      ) : (
        <Top10Track items={items} />
      )}
    </section>
  )
}
