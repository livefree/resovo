'use client'

/**
 * BrowseCard — Browse 页专用 portrait 卡片（HANDOFF-15）
 *
 * 职责：在分类浏览网格中展示视频封面 + 标题，点击跳转至 detail 页。
 * 不依赖 useParams / usePlayerStore，与 VideoCard（播放器集成版本）解耦。
 * VideoCard 仍用于首页 Shelf、搜索结果等需要 Fast Takeover 的场景。
 */

import Link from 'next/link'
import { getVideoDetailHref } from '@/lib/video-route'
import { SafeImage } from '@/components/media'
import type { VideoCard as VideoCardType } from '@resovo/types'

interface BrowseCardProps {
  video: VideoCardType
}

export function BrowseCard({ video }: BrowseCardProps) {
  const detailHref = getVideoDetailHref(video)

  return (
    <Link
      href={detailHref}
      data-testid="browse-card"
      className="group block"
      style={{ textDecoration: 'none' }}
    >
      {/* 封面 */}
      <div
        className="relative rounded-lg overflow-hidden"
        style={{ aspectRatio: '2/3' }}
      >
        <SafeImage
          src={video.coverUrl}
          alt={video.title}
          width={200}
          height={300}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', aspectRatio: 'unset' }}
          imgClassName="object-cover transition-transform duration-300 group-hover:scale-105"
          fallback={{ seed: video.id }}
        />
      </div>

      {/* 标题 */}
      <div style={{ marginTop: 'var(--space-2)' }}>
        <p
          className="line-clamp-2"
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--fg-default)',
            lineHeight: '1.4',
          }}
        >
          {video.title}
        </p>
        {video.year && (
          <p
            style={{
              fontSize: '12px',
              color: 'var(--fg-muted)',
              marginTop: 'var(--space-0-5)',
            }}
          >
            {video.year}
          </p>
        )}
      </div>
    </Link>
  )
}
