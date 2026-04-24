'use client'

/**
 * FeaturedRow — 首页特色推荐区块（HANDOFF-22）
 *
 * 数据源：GET /home/modules?slot=featured → HomeModule[]
 * 布局：1.6fr + 3×1fr CSS grid（共 4 列，首列较宽）
 * 降级：无运营数据时降级为普通 ShelfRow（/videos/trending?period=week&limit=5）
 *
 * TODO(featured-videos-endpoint): 当 featured modules 存在时，当前实现以趋势视频补位
 * 展示 1.6fr + 3×1fr 布局。后续需实现服务端聚合端点（/home/featured-videos）
 * 以返回精确的运营选定视频 VideoCard 列表，类似 /home/top10 的设计。
 */

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { VideoCard } from '@/components/video/VideoCard'
import { ShelfRow } from '@/components/video/Shelf'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import type { HomeModule, VideoCard as VideoCardType, ApiResponse } from '@resovo/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeaturedRowProps {
  readonly title: string
  readonly viewAllHref?: string
  readonly viewAllLabel?: string
  readonly fallbackTitle: string
  readonly fallbackViewAllHref?: string
  readonly fallbackViewAllLabel?: string
}

// ── 子组件 ────────────────────────────────────────────────────────────────────

function RowHeader({
  title,
  viewAllHref,
  viewAllLabel,
}: {
  readonly title: string
  readonly viewAllHref?: string
  readonly viewAllLabel?: string
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ marginBottom: '20px' }}
    >
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
      {viewAllHref && viewAllLabel && (
        <a
          href={viewAllHref}
          style={{
            fontSize: '13px',
            color: 'var(--accent-default)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          {viewAllLabel} →
        </a>
      )}
    </div>
  )
}

function FeaturedGridSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
        gap: 'var(--shelf-gap)',
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton
          key={i}
          shape="rect"
          style={{ aspectRatio: '2/3' }}
          delay={i >= 2 ? 300 : undefined}
        />
      ))}
    </div>
  )
}

function FeaturedGrid({ videos }: { readonly videos: VideoCardType[] }) {
  const MIN_SLOTS = 4
  const displayed = videos.slice(0, MIN_SLOTS)

  return (
    <div
      data-testid="featured-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
        gap: 'var(--shelf-gap)',
      }}
    >
      {displayed.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
      {displayed.length < MIN_SLOTS &&
        Array.from({ length: MIN_SLOTS - displayed.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            aria-hidden="true"
            style={{
              aspectRatio: '2/3',
              borderRadius: '8px',
              border: '1px dashed var(--border-default)',
              background: 'var(--bg-surface-sunken)',
              opacity: 'var(--shelf-empty-opacity)',
              pointerEvents: 'none',
            }}
          />
        ))}
    </div>
  )
}

// ── FeaturedRow ───────────────────────────────────────────────────────────────

export function FeaturedRow({
  title,
  viewAllHref,
  viewAllLabel,
  fallbackTitle,
  fallbackViewAllHref,
  fallbackViewAllLabel,
}: FeaturedRowProps) {
  const [modules, setModules] = useState<HomeModule[] | null>(null)
  const [videos, setVideos] = useState<VideoCardType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient
      .get<ApiResponse<HomeModule[]>>('/home/modules?slot=featured', { skipAuth: true })
      .then(async (res) => {
        const activeModules = res.data
        setModules(activeModules)

        if (activeModules.length > 0) {
          // TODO(featured-videos-endpoint): 以趋势视频补位展示 1.6fr + 3×1fr 布局
          // 待后端实现 /home/featured-videos 批量 UUID→VideoCard 端点后替换
          const trendingRes = await apiClient.get<{ data: VideoCardType[] }>(
            '/videos/trending?period=week&limit=4',
            { skipAuth: true },
          )
          setVideos(trendingRes.data)
        }
      })
      .catch(() => {
        setModules([])
        setVideos([])
      })
      .finally(() => setLoading(false))
  }, [])

  // 无运营数据 → 降级为普通 ShelfRow
  if (!loading && (modules === null || modules.length === 0)) {
    return (
      <ShelfRow
        template="poster-row"
        query="period=week&limit=5"
        title={fallbackTitle}
        viewAllHref={fallbackViewAllHref}
        viewAllLabel={fallbackViewAllLabel}
      />
    )
  }

  return (
    <section>
      <RowHeader title={title} viewAllHref={viewAllHref} viewAllLabel={viewAllLabel} />
      {loading ? (
        <FeaturedGridSkeleton />
      ) : (
        <FeaturedGrid videos={videos} />
      )}
    </section>
  )
}
