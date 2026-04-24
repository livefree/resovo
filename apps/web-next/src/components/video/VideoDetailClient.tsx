'use client'

/**
 * VideoDetailClient — HANDOFF-17 对齐 docs/frontend_design_spec_20260423.md §14
 *
 * 布局：
 *   Hero（max-w-feature，双栏 280px+1fr）
 *   EpisodePicker（max-w-feature，repeat(10,1fr)，选集范围切换）
 *   下方双栏（1fr + --detail-sidebar-w 320px，gap --detail-sidebar-gap 40px）
 *     主列：（占位，HANDOFF-18 Watch 页补充更多区块）
 *     侧栏：RelatedVideos（竖向列表）
 *
 * section 间距：var(--detail-section-gap) 48px
 */

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

export function VideoDetailClientSkeleton() {
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
      {/* Hero 区 */}
      <div className="detail-cascade-1">
        <DetailHero video={video} episode={activeEpisode} />
      </div>

      {/* 选集区 */}
      {showEpisodes && video.episodeCount > 1 && (
        <div className="detail-cascade-2" style={{ marginTop: 0 }}>
          <EpisodePicker video={video} onEpisodeChange={setActiveEpisode} />
        </div>
      )}

      {/* 下方区：主内容 + 侧栏 */}
      <div
        className="max-w-feature mx-auto px-6"
        style={{ paddingTop: 'var(--detail-section-gap)', paddingBottom: 'var(--detail-section-gap)' }}
      >
        {/* mobile=单列，≥1024=1fr + 侧栏 */}
        <div className="detail-lower-grid items-start">
          {/* 主列 — 未来 HANDOFF-18 可在此添加更多区块（评论/来源列表等） */}
          <div className="min-w-0">
            {/* 占位：后续任务补充主列内容 */}
          </div>

          {/* 侧栏：相关推荐 */}
          <aside className="detail-cascade-3">
            <RelatedVideos video={video} variant="sidebar" />
          </aside>
        </div>
      </div>
    </>
  )
}

VideoDetailClient.Skeleton = VideoDetailClientSkeleton
