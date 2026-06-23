'use client'

import { useEffect, useState } from 'react'
import { VideoCard } from './VideoCard'
import { apiClient } from '@/lib/api-client'
import type { VideoCard as VideoCardType, ApiListResponse } from '@resovo/types'

// 前台卡片网格统一 gap（CARD-SIZING-B 口径冻结 16px）→ 复用 --page-inline-gap 真源
const GRID_GAP_STYLE: React.CSSProperties = { gap: 'var(--page-inline-gap)' }

interface VideoGridProps {
  query: string
  gridCols?: string
  layout?: 'grid' | 'scroll'
  /** PC 端 stagger fade（分类页 Sibling 过渡用） */
  stagger?: boolean
  'data-testid'?: string
}

function VideoGridSkeleton({
  gridCols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  testId,
}: {
  gridCols?: string
  testId?: string
}) {
  return (
    <div className={`grid ${gridCols}`} style={GRID_GAP_STYLE} data-testid={testId ?? 'video-grid-skeleton'}>
      {Array.from({ length: 10 }).map((_, i) => (
        <VideoCard.Skeleton key={i} />
      ))}
    </div>
  )
}

export function VideoGrid({
  query,
  gridCols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  layout = 'grid',
  stagger = false,
  'data-testid': testId,
}: VideoGridProps) {
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

  const scrollContainerStyle: React.CSSProperties = {
    display: 'flex',
    overflowX: 'auto',
    gap: 'var(--page-inline-gap)',
    scrollSnapType: 'x mandatory',
    scrollbarWidth: 'none',
    paddingBottom: '4px',
  }

  const cardWidth = 'var(--shelf-card-w-portrait)'

  if (loading) {
    if (layout === 'scroll') {
      return (
        <div style={scrollContainerStyle} data-testid={testId}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg animate-pulse shrink-0"
              style={{
                width: cardWidth,
                aspectRatio: '2/3',
                background: 'var(--bg-surface-sunken)',
                scrollSnapAlign: 'start',
              }}
            />
          ))}
        </div>
      )
    }

    return (
      <div className={`grid ${gridCols}`} style={GRID_GAP_STYLE} data-testid={testId}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg animate-pulse"
            style={{
              aspectRatio: '2/3',
              background: 'var(--bg-surface-sunken)',
            }}
          />
        ))}
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div data-testid={testId} className="py-8 text-center" style={{ color: 'var(--fg-muted)' }}>
        暂无数据
      </div>
    )
  }

  if (layout === 'scroll') {
    return (
      <div style={scrollContainerStyle} data-testid={testId}>
        {videos.map((video) => (
          <div
            key={video.id}
            className="shrink-0"
            style={{ width: cardWidth, scrollSnapAlign: 'start' }}
          >
            <VideoCard video={video} />
          </div>
        ))}
      </div>
    )
  }

  const gridClass = `grid ${gridCols}${stagger ? ' video-grid-stagger' : ''}`

  return (
    <div className={gridClass} style={GRID_GAP_STYLE} data-testid={testId}>
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  )
}

VideoGrid.Skeleton = VideoGridSkeleton
