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
import { useTranslations } from 'next-intl'
import { apiClient } from '@/lib/api-client'
import { BrowseCard } from './BrowseCard'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import type { VideoCard as VideoCardType, ApiListResponse } from '@resovo/types'

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

// ── BrowsePagination ──────────────────────────────────────────────────────────

interface BrowsePaginationProps {
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

function BrowsePagination({ page, totalPages, onPrev, onNext }: BrowsePaginationProps) {
  return (
    <div
      data-testid="browse-pagination"
      role="navigation"
      aria-label="分页"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--browse-pagination-gap)',
        marginTop: 'var(--browse-pagination-mt)',
      }}
    >
      <button
        type="button"
        data-testid="pagination-prev"
        disabled={page <= 1}
        onClick={onPrev}
        aria-label="上一页"
        style={{
          width: 'var(--browse-pagination-btn)',
          height: 'var(--browse-pagination-btn)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-base)',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          color: 'var(--fg-default)',
          cursor: page <= 1 ? 'not-allowed' : 'pointer',
          opacity: page <= 1 ? 0.4 : 1,
          fontSize: '18px',
          lineHeight: 1,
        }}
      >
        ‹
      </button>

      <span
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--fg-default)',
          minWidth: '60px', /* page display 最小宽，无对应 space token */
          textAlign: 'center',
        }}
      >
        {page} / {totalPages}
      </span>

      <button
        type="button"
        data-testid="pagination-next"
        disabled={page >= totalPages}
        onClick={onNext}
        aria-label="下一页"
        style={{
          width: 'var(--browse-pagination-btn)',
          height: 'var(--browse-pagination-btn)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-base)',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          color: 'var(--fg-default)',
          cursor: page >= totalPages ? 'not-allowed' : 'pointer',
          opacity: page >= totalPages ? 0.4 : 1,
          fontSize: '18px',
          lineHeight: 1,
        }}
      >
        ›
      </button>
    </div>
  )
}

// ── BrowseGrid ────────────────────────────────────────────────────────────────

export function BrowseGrid() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations() as (key: string) => string

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

    apiClient
      .get<ApiListResponse<VideoCardType>>(`/videos/trending?${params.toString()}`, { skipAuth: true })
      .then((res) => {
        setVideos(res.data)
        setTotal(res.pagination.total)
      })
      .catch(() => {
        setVideos([])
        setTotal(0)
      })
      .finally(() => setLoaded(true))
  }, [searchKey]) // eslint-disable-line react-hooks/exhaustive-deps

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
        {t('noResults')}
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
        <BrowsePagination
          page={page}
          totalPages={totalPages}
          onPrev={() => navigate(page - 1)}
          onNext={() => navigate(page + 1)}
        />
      )}
    </div>
  )
}
