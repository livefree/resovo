/**
 * BrowseGrid.tsx — 分类浏览视频网格（客户端组件）
 * 复用 VideoCard，URL 参数变化时重新获取数据
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { VideoCard } from '@/components/video/VideoCard'
import { SortBar } from './SortBar'
import { apiClient } from '@/lib/api-client'
import type { VideoCard as VideoCardType, ApiListResponse } from '@/types'
import { useTranslations } from 'next-intl'

// ── 翻译 URL 参数 → /search API 参数 ─────────────────────────────

function buildSearchQuery(params: URLSearchParams): string {
  const parts: string[] = []
  const mapping: Record<string, string> = {
    type:       'type',
    country:    'country',
    lang:       'lang',
    year:       'year',
    rating_min: 'rating_min',
    status:     'status',
    sort:       'sort',
    page:       'page',
  }
  for (const [urlKey, apiKey] of Object.entries(mapping)) {
    const value = params.get(urlKey)
    if (value) parts.push(`${apiKey}=${encodeURIComponent(value)}`)
  }
  parts.push('limit=24')
  return parts.join('&')
}

const PAGE_SIZE = 24

// ── 组件 ──────────────────────────────────────────────────────────

export function BrowseGrid() {
  const t = useTranslations('browse')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [videos, setVideos] = useState<VideoCardType[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const currentPage = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (page <= 1) {
      params.delete('page')
    } else {
      params.set('page', String(page))
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const fetchData = useCallback(() => {
    setLoading(true)
    const query = buildSearchQuery(searchParams)
    apiClient
      .get<ApiListResponse<VideoCardType>>(`/search?${query}`, { skipAuth: true })
      .then((res) => {
        setVideos(res.data)
        setTotal(res.pagination.total)
      })
      .catch(() => {
        setVideos([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [searchParams])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="max-w-screen-xl mx-auto w-full px-4">
      <SortBar total={total} />

      {loading ? (
        <div
          className="grid gap-4 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
          data-testid="browse-grid"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg animate-pulse"
              style={{ aspectRatio: '2/3', background: 'var(--secondary)' }}
            />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div
          className="py-20 text-center"
          style={{ color: 'var(--muted-foreground)' }}
          data-testid="browse-empty"
        >
          {t('noResults')}
        </div>
      ) : (
        <div
          className="grid gap-4 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
          data-testid="browse-grid"
        >
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-3 mt-8"
          data-testid="browse-pagination"
        >
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--secondary)',
              color: 'var(--foreground)',
            }}
            data-testid="pagination-prev"
          >
            ‹ 上一页
          </button>
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--secondary)',
              color: 'var(--foreground)',
            }}
            data-testid="pagination-next"
          >
            下一页 ›
          </button>
        </div>
      )}
    </div>
  )
}
