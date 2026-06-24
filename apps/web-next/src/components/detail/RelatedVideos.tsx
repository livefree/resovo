'use client'

/**
 * RelatedVideos — 详情页/播放页共用「一行相关视频横滚」（ADR-214 Amendment A1 D-214-A1-6 / CARD-SIZE-A1-DETAIL/-WATCH）
 *
 * 退役原详情页 320px 侧栏 60px 竖向缩略列表（SidebarList）→ 全宽 ScrollRow 横滚 + VideoCard(navigate)；
 * 详情页（VideoDetailClient）+ 播放页（watch page.tsx，#6 直接复用本组件）统一同款。
 * 数据仅相关 trending（无筛选/排序/加载更多，D-214-A1-6 ④）；VideoCard navigate 整卡纯跳详情、不耦合播放器状态机。
 * 注：组件目录 components/detail 为历史归属，逻辑通用（详情+播放共用）；提取至 shared 为可选后续。
 */

import { useEffect, useState } from 'react'
import { ScrollRow } from '@/components/shared/scroll-row/ScrollRow'
import { VideoCard } from '@/components/video/VideoCard'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import { apiClient } from '@/lib/api-client'
import type { Video, VideoCard as VideoCardType, ApiListResponse } from '@resovo/types'

interface RelatedVideosProps {
  video: Video
}

/** 相关视频取数上限（D-214-A1-6：一行横滚、无加载更多） */
const RELATED_LIMIT = 12
/** 横滚骨架占位卡数 */
const SKELETON_SLOTS = 6

function RelatedSkeleton() {
  return (
    <ScrollRow aria-label="相关推荐加载中">
      {Array.from({ length: SKELETON_SLOTS }).map((_, i) => (
        <Skeleton
          key={i}
          shape="rect"
          style={{ aspectRatio: '2/3' }}
          delay={i >= 2 ? 300 : undefined}
        />
      ))}
    </ScrollRow>
  )
}

export function RelatedVideos({ video }: RelatedVideosProps) {
  const [items, setItems] = useState<VideoCardType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient
      .get<ApiListResponse<VideoCardType>>(
        `/videos/trending?type=${video.type}&limit=${RELATED_LIMIT}&exclude=${video.id}`,
        { skipAuth: true },
      )
      .then((res) => setItems(res.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [video.type, video.id])

  return (
    <section data-testid="related-videos" style={{ marginTop: 'var(--detail-section-gap)' }}>
      <h2
        className="text-sm font-semibold"
        style={{ color: 'var(--fg-default)', marginBottom: '12px' }}
      >
        相关推荐
      </h2>
      {loading ? (
        <RelatedSkeleton />
      ) : items.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>暂无相关推荐</p>
      ) : (
        <ScrollRow aria-label="相关推荐" data-testid="related-scroll">
          {items.map((item) => (
            <VideoCard key={item.id} video={item} interaction="navigate" />
          ))}
        </ScrollRow>
      )}
    </section>
  )
}
