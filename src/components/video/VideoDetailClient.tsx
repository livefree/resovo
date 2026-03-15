'use client'

/**
 * VideoDetailClient.tsx — CSR 视频详情内容
 * 客户端获取数据，确保 page.route() 可在 E2E 测试中拦截 API 请求
 */

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { extractShortId } from '@/lib/video-detail'
import { VideoDetailHero } from './VideoDetailHero'
import { VideoDetailMeta } from './VideoDetailMeta'
import { EpisodeGrid } from './EpisodeGrid'
import type { Video, ApiResponse } from '@/types'

interface Props {
  slug: string
  showEpisodes?: boolean
}

export function VideoDetailClient({ slug, showEpisodes }: Props) {
  const [video, setVideo] = useState<Video | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const shortId = extractShortId(slug)
    apiClient
      .get<ApiResponse<Video>>(`/videos/${shortId}`)
      .then((res) => setVideo(res.data))
      .catch(() => setNotFound(true))
  }, [slug])

  if (notFound) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'var(--muted-foreground)' }}>视频不存在或已下线</p>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="animate-pulse max-w-screen-xl mx-auto px-4 py-8">
        <div className="h-64 rounded-xl" style={{ background: 'var(--secondary)' }} />
      </div>
    )
  }

  return (
    <>
      <VideoDetailHero video={video} />
      <VideoDetailMeta video={video} />
      {showEpisodes && <EpisodeGrid video={video} />}
    </>
  )
}
