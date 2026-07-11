'use client'

/**
 * useHotSearchTerms — 热门搜索词 + 热门内容数据源（SEARCH-FE-4）
 *
 * 取站内真实周热门（`/videos/trending?period=week`）作为热搜词与发现内容的来源，
 * 使热门搜索与真实内容库关联（点击必命中、随热度更新），替代硬编码占位清单。
 * 降级链：trending 有数据 → 用真实标题；trending 空 / fetch 失败 → 降级静态
 * `nav.hotSearchTerms`；全空 → terms 空（消费方隐藏热搜区）。
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiClient } from '@/lib/api-client'
import type { VideoCard, ApiListResponse } from '@resovo/types'

const HOT_LIMIT = 8

export interface HotSearchData {
  /** 热搜词（trending 标题，降级静态 nav.hotSearchTerms） */
  terms: string[]
  /** 热门内容（trending 视频，供发现区 / 无结果推荐区消费；fetch 失败时为空） */
  videos: VideoCard[]
  loading: boolean
}

export function useHotSearchTerms(limit = HOT_LIMIT): HotSearchData {
  const tNav = useTranslations('nav')
  const staticTerms = (tNav.raw('hotSearchTerms') as string[] | undefined) ?? []

  const [videos, setVideos] = useState<VideoCard[]>([])
  const [trendingTerms, setTrendingTerms] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<ApiListResponse<VideoCard>>(`/videos/trending?period=week&limit=${limit}`, { skipAuth: true })
      .then((res) => {
        if (cancelled) return
        setVideos(res.data)
        setTrendingTerms(res.data.map((v) => v.title).filter(Boolean))
      })
      .catch(() => {
        // fetch 失败 → videos 留空，词走静态降级（下方 terms 派生）
        if (!cancelled) setTrendingTerms([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [limit])

  // trending 有词用真实标题，否则降级静态清单
  const terms = trendingTerms && trendingTerms.length > 0 ? trendingTerms : staticTerms

  return { terms, videos, loading }
}
