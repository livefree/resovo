'use client'

/**
 * RelatedVideos — HANDOFF-17/28 对齐 docs/frontend_design_spec_20260423.md §14
 *
 * variant="grid"   （默认）全宽网格，用于全宽布局（历史兼容）
 * variant="sidebar" 侧栏纵向列表，位于 VideoDetailClient 1fr+320px 侧栏
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { VideoGrid } from '@/components/video/VideoGrid'
import { SafeImage } from '@/components/media'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import { apiClient } from '@/lib/api-client'
import { getVideoDetailHref } from '@/lib/video-route'
import type { Video, VideoCard, ApiListResponse } from '@resovo/types'

interface RelatedVideosProps {
  video: Video
  /** 'grid'（默认）= 全宽网格；'sidebar' = 侧栏纵向列表 */
  variant?: 'grid' | 'sidebar'
}

// ── SidebarList ───────────────────────────────────────────────────────────────

function SidebarList({ video }: { video: Video }) {
  const [items, setItems] = useState<VideoCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient
      .get<ApiListResponse<VideoCard>>(
        `/videos/trending?type=${video.type}&limit=8&exclude=${video.id}`,
        { skipAuth: true },
      )
      .then((res) => setItems(res.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [video.type, video.id])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px' }}>
            <Skeleton shape="rect" style={{ width: '60px', flexShrink: 0, aspectRatio: '2/3', borderRadius: '6px' }} delay={i >= 2 ? 300 : undefined} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
              <Skeleton shape="text" height={13} delay={i >= 2 ? 300 : undefined} />
              <Skeleton shape="text" height={12} className="w-2/3" delay={300} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>暂无相关推荐</p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {items.map((item) => {
        const href = getVideoDetailHref(item)
        return (
          <Link
            key={item.id}
            href={href}
            style={{ display: 'flex', gap: '12px', textDecoration: 'none' }}
          >
            <div
              style={{
                width: '60px',
                flexShrink: 0,
                aspectRatio: '2 / 3',
                borderRadius: '6px',
                overflow: 'hidden',
              }}
            >
              <SafeImage
                src={item.coverUrl}
                alt={item.title}
                width={60}
                height={90}
                aspect="2:3"
                blurHash={item.posterBlurhash ?? undefined}
                imgClassName="object-cover"
                fallback={{ title: item.title, type: item.type, seed: item.id }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--fg-default)',
                  lineHeight: 1.4,
                  marginBottom: '4px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {item.title}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>
                {[item.year, item.rating !== null ? `★ ${item.rating.toFixed(1)}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ── RelatedVideos ─────────────────────────────────────────────────────────────

export function RelatedVideos({ video, variant = 'grid' }: RelatedVideosProps) {
  const query = `type=${video.type}&limit=12&exclude=${video.id}`
  const isSidebar = variant === 'sidebar'

  return (
    <section data-testid="related-videos">
      {!isSidebar && (
        <div
          className="border-t max-w-feature mx-auto px-6 py-8"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--fg-default)' }}>
            相关推荐
          </h2>
          <VideoGrid
            query={query}
            variant="portrait"
            gridCols="grid-cols-3 sm:grid-cols-4 md:grid-cols-6"
            stagger
            data-testid="related-videos-grid"
          />
        </div>
      )}

      {isSidebar && (
        <>
          <h2
            className="text-sm font-semibold"
            style={{ color: 'var(--fg-default)', marginBottom: '12px' }}
          >
            相关推荐
          </h2>
          <SidebarList video={video} />
        </>
      )}
    </section>
  )
}

function RelatedVideosSkeleton() {
  return (
    <div
      className="border-t"
      style={{ borderColor: 'var(--border-default)' }}
    >
      <div className="max-w-feature mx-auto px-6 py-8">
        <Skeleton shape="text" width={96} height={20} className="mb-4" />
        <VideoGrid.Skeleton
          gridCols="grid-cols-3 sm:grid-cols-4 md:grid-cols-6"
          testId="related-videos-skeleton"
        />
      </div>
    </div>
  )
}

RelatedVideos.Skeleton = RelatedVideosSkeleton
