/**
 * useDanmaku.ts — 弹幕数据 Hook
 * CHG-22: 从 GET /videos/:id/danmaku 获取弹幕，sessionStorage 缓存 30 分钟
 */

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'

// ── 类型 ──────────────────────────────────────────────────────────

/** CCL 兼容的弹幕条目（API 返回格式） */
export interface DanmakuComment {
  time: number       // 秒（整数）
  type: 0 | 1 | 2   // 0=scroll, 1=top, 2=bottom
  color: string      // #rrggbb
  text: string
}

// ── 缓存 ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000  // 30 min

function cacheKey(shortId: string, ep: number): string {
  return `danmaku:${shortId}:${ep}`
}

function readCache(key: string): DanmakuComment[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data: DanmakuComment[]; expiry: number }
    if (Date.now() > parsed.expiry) {
      sessionStorage.removeItem(key)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function writeCache(key: string, data: DanmakuComment[]): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, expiry: Date.now() + CACHE_TTL_MS }))
  } catch {
    // 隐私模式等情况下 sessionStorage 不可用，静默降级
  }
}

// ── Hook ──────────────────────────────────────────────────────────

export interface UseDanmakuResult {
  comments: DanmakuComment[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useDanmaku(
  shortId: string | null,
  episodeNumber = 1
): UseDanmakuResult {
  const [comments, setComments] = useState<DanmakuComment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDanmaku = useCallback(async () => {
    if (!shortId) return

    const key = cacheKey(shortId, episodeNumber)
    const cached = readCache(key)
    if (cached) {
      setComments(cached)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await apiClient.getDanmaku(shortId, episodeNumber)
      setComments(res.data)
      writeCache(key, res.data)
    } catch {
      setError('弹幕加载失败')
      setComments([])
    } finally {
      setIsLoading(false)
    }
  }, [shortId, episodeNumber])

  useEffect(() => {
    setComments([])
    void fetchDanmaku()
  }, [fetchDanmaku])

  return { comments, isLoading, error, refetch: fetchDanmaku }
}
