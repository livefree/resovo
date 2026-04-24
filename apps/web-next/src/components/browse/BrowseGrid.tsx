'use client'

/**
 * BrowseGrid — HANDOFF-15 对齐 docs/frontend_design_spec_20260423.md §12.4
 *
 * 从 URL searchParams 读取 page + 筛选条件，请求 API 后渲染 5 列网格 + 分页控件。
 *
 * Token 消费（spec §12.4）：
 *   网格列数       → 5
 *   网格 gap       → var(--browse-grid-gap)       20px
 *   分页-网格间距  → var(--browse-pagination-mt)  48px
 *   分页项 gap     → var(--browse-pagination-gap) 8px
 *   分页按钮尺寸   → var(--browse-pagination-btn) 36px
 */

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { BrowseCard } from './BrowseCard'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import { Pagination } from '@/components/primitives/pagination'
import type { VideoCard as VideoCardType, VideoType, ApiListResponse } from '@resovo/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 24
const SKELETON_COUNT = 10

// ── BrowseGridSkeleton ────────────────────────────────────────────────────────

function BrowseGridSkeleton() {
  return (
    <div
      data-testid="browse-grid-skeleton"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 'var(--browse-grid-gap)',
      }}
    >
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <Skeleton
          key={i}
          shape="rect"
          style={{ aspectRatio: '2/3', width: '100%' }}
          delay={i >= 4 ? 300 : undefined}
        />
      ))}
    </div>
  )
}

// ── BrowseGrid ────────────────────────────────────────────────────────────────

interface BrowseGridProps {
  /** 分类页传入，强制覆盖 URL 中的 type 参数（唯一权威防线） */
  initialType?: VideoType
}

export function BrowseGrid({ initialType }: BrowseGridProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const searchKey = searchParams.toString()
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))

  const [videos, setVideos] = useState<VideoCardType[]>([])
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    const params = new URLSearchParams(searchKey)
    params.set('limit', String(PAGE_SIZE))
    if (!params.has('page')) params.set('page', '1')
    // initialType 为唯一权威，无条件覆盖 URL 中的 type 参数
    if (initialType) params.set('type', initialType)

    apiClient
      .get<ApiListResponse<VideoCardType>>(`/videos?${params.toString()}`, { skipAuth: true })
      .then((res) => {
        setVideos(res.data)
        setTotal(res.pagination.total)
      })
      .catch(() => {
        setVideos([])
        setTotal(0)
      })
      .finally(() => setLoaded(true))
  }, [searchKey, initialType]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function navigate(targetPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (targetPage <= 1) {
      params.delete('page')
    } else {
      params.set('page', String(targetPage))
    }
    router.push((pathname ?? '') + '?' + params.toString())
  }

  if (!loaded) {
    return <BrowseGridSkeleton />
  }

  if (total === 0) {
    return (
      <div
        data-testid="browse-empty"
        className="flex items-center justify-center py-12 text-sm"
        style={{ color: 'var(--fg-muted)' }}
      >
        暂无相关内容
      </div>
    )
  }

  return (
    <div>
      <div
        data-testid="browse-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 'var(--browse-grid-gap)',
        }}
      >
        {videos.map((video) => (
          <BrowseCard key={video.id} video={video} />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination
          data-testid="browse-pagination"
          page={page}
          totalPages={totalPages}
          onPrev={() => navigate(page - 1)}
          onNext={() => navigate(page + 1)}
        />
      )}
    </div>
  )
}
