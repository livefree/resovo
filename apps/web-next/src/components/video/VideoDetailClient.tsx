'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { extractShortId } from '@/lib/video-detail'
import { DetailHero } from '@/components/detail/DetailHero'
import { EpisodePicker } from '@/components/detail/EpisodePicker'
import { RelatedVideos } from '@/components/detail/RelatedVideos'
import type { Video, ApiResponse } from '@resovo/types'

interface Props {
  slug: string
  showEpisodes?: boolean
}

function VideoDetailClientSkeleton() {
  return (
    <div>
      <div className="detail-cascade-1">
        <DetailHero.Skeleton />
      </div>
    </div>
  )
}

export function VideoDetailClient({ slug, showEpisodes }: Props) {
  const searchParams = useSearchParams()
  const [video, setVideo] = useState<Video | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [activeEpisode, setActiveEpisode] = useState(() => {
    const ep = Number(searchParams.get('ep'))
    return ep >= 1 ? ep : 1
  })

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

  if (!video) return <VideoDetailClientSkeleton />

  return (
    <>
      <div className="detail-cascade-1">
        <DetailHero video={video} episode={activeEpisode} />
      </div>
      {showEpisodes && video.episodeCount > 1 && (
        <div className="detail-cascade-2">
          <EpisodePicker video={video} onEpisodeChange={setActiveEpisode} />
        </div>
      )}
      <div className="detail-cascade-3">
        <RelatedVideos video={video} />
      </div>
    </>
  )
}

VideoDetailClient.Skeleton = VideoDetailClientSkeleton
