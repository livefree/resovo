/**
 * VideoGrid.tsx — 视频网格（客户端组件）
 * 复用 VideoCard / VideoCardWide，支持分页加载
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
  /** 列数 Tailwind class，如 "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" */
  gridCols?: string
  'data-testid'?: string
}

export function VideoGrid({
  query,
  variant = 'portrait',
  gridCols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
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

  if (loading) {
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
