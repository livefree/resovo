'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { extractShortId } from '@/lib/video-detail'
import { VideoDetailHero } from './VideoDetailHero'
import { EpisodeGrid } from './EpisodeGrid'
import type { Video, ApiResponse } from '@resovo/types'

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
        <p style={{ color: 'var(--fg-muted)' }}>视频不存在或已下线</p>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="animate-pulse max-w-screen-xl mx-auto px-4 py-8">
        <div className="h-64 rounded-xl" style={{ background: 'var(--bg-surface-sunken)' }} />
      </div>
    )
  }

  return (
    <>
      <VideoDetailHero video={video} />
      {showEpisodes && <EpisodeGrid video={video} />}
    </>
  )
}
