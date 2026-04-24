'use client'

/**
 * FeaturedRow — 首页精选推荐区块（HANDOFF-22）
 *
 * 数据源：GET /home/modules?slot=featured → HomeModule[]
 * 布局：1.6fr + 3×1fr CSS grid（共 4 列，首列较宽）
 *
 * 策略：
 *   - Section 始终以"精选推荐"身份渲染，不替换为其他 section
 *   - 无运营模块时：以趋势视频填充 grid（保持标题与布局不变）
 *   - 有运营模块时：显示编辑精选内容（当前仍以趋势填位，TODO: 待后端实现）
 *   - loading 时：FeaturedGridSkeleton，骨架尺寸与实际 grid 一致，无闪烁
 *
 * TODO(featured-videos-endpoint): 待后端实现 /home/featured-videos 批量端点（类似 /home/top10）
 * 以返回运营选定的 VideoCard 列表，替换当前趋势视频填位逻辑。
 */

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { VideoCard } from '@/components/video/VideoCard'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import type { HomeModule, VideoCard as VideoCardType, ApiResponse } from '@resovo/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeaturedRowProps {
  readonly title: string
  readonly viewAllHref?: string
  readonly viewAllLabel?: string
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
    <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
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

export function FeaturedRow({ title, viewAllHref, viewAllLabel }: FeaturedRowProps) {
  const [videos, setVideos] = useState<VideoCardType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    // 并行请求：模块检查 + 趋势视频（作为填位内容）
    Promise.all([
      apiClient.get<ApiResponse<HomeModule[]>>('/home/modules?slot=featured', { skipAuth: true }),
      apiClient.get<{ data: VideoCardType[] }>('/videos/trending?period=week&limit=4', { skipAuth: true }),
    ])
      .then(([_modulesRes, trendingRes]) => {
        // TODO(featured-videos-endpoint): 当 _modulesRes.data.length > 0 时
        // 改用精选端点返回的 VideoCard 列表替换 trendingRes
        setVideos(trendingRes.data)
      })
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section>
      <RowHeader title={title} viewAllHref={viewAllHref} viewAllLabel={viewAllLabel} />
      {loading ? <FeaturedGridSkeleton /> : <FeaturedGrid videos={videos} />}
    </section>
  )
}
