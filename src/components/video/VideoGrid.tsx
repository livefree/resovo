/**
 * VideoGrid.tsx — 视频网格或横向滚动行（客户端组件）
 * 复用 VideoCard / VideoCardWide，支持 grid 和 scroll 两种布局
 */

'use client'

import { useEffect, useState } from 'react'
import { VideoCard } from './VideoCard'
import { VideoCardWide } from './VideoCardWide'
import { apiClient } from '@/lib/api-client'
import type { VideoCard as VideoCardType, ApiListResponse } from '@/types'

interface VideoGridProps {
  /** API 查询参数字符串，如 "type=movie&period=week&limit=10" */
  query: string
  /** 'portrait'=竖版2:3  'landscape'=横版16:9 */
  variant?: 'portrait' | 'landscape'
  /** 列数 Tailwind class（仅 layout='grid' 时生效） */
  gridCols?: string
  /** 'grid'=固定网格  'scroll'=单排横向滚动 */
  layout?: 'grid' | 'scroll'
  'data-testid'?: string
}

export function VideoGrid({
  query,
  variant = 'portrait',
  gridCols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  layout = 'grid',
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

  // 横向滚动行样式
  const scrollContainerStyle: React.CSSProperties = {
    display: 'flex',
    overflowX: 'auto',
    gap: '16px',
    scrollSnapType: 'x mandatory',
    scrollbarWidth: 'none',
    paddingBottom: '4px',
  }

  const cardWidth = variant === 'portrait' ? '160px' : '280px'

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
                aspectRatio: variant === 'portrait' ? '2/3' : '16/9',
                background: 'var(--secondary)',
                scrollSnapAlign: 'start',
              }}
            />
          ))}
        </div>
      )
    }

    return (
      <div className={`grid gap-4 ${gridCols}`} data-testid={testId}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg animate-pulse"
            style={{
              aspectRatio: variant === 'portrait' ? '2/3' : '16/9',
              background: 'var(--secondary)',
            }}
          />
        ))}
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div data-testid={testId} className="py-8 text-center" style={{ color: 'var(--muted-foreground)' }}>
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
            {variant === 'portrait' ? (
              <VideoCard video={video} />
            ) : (
              <VideoCardWide video={video} />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`grid gap-4 ${gridCols}`} data-testid={testId}>
      {videos.map((video) =>
        variant === 'portrait' ? (
          <VideoCard key={video.id} video={video} />
        ) : (
          <VideoCardWide key={video.id} video={video} />
        )
      )}
    </div>
  )
}
