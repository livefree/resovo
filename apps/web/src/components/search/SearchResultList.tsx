/**
 * SearchResultList.tsx — 搜索结果列表（客户端组件）
 * 读取 URL 参数 → 调用 /search → 渲染 ResultCard 列表
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { ResultCard } from './ResultCard'
import { apiClient } from '@/lib/api-client'
import type { SearchResult, ApiListResponse } from '@/types'

// ── URL 参数 → API 查询字符串 ──────────────────────────────────────

const TYPE_ALIAS: Record<string, string> = { tvshow: 'variety' }

function buildSearchQuery(params: URLSearchParams): string {
  const parts: string[] = []
  const keys = ['q', 'type', 'year', 'rating_min', 'lang', 'director', 'actor', 'writer', 'country', 'sort', 'page']
  for (const key of keys) {
    let value = params.get(key)
    if (!value) continue
    if (key === 'type') value = TYPE_ALIAS[value] ?? value
    parts.push(`${key}=${encodeURIComponent(value)}`)
  }
  parts.push('limit=20')
  return parts.join('&')
}

// ── 组件 ──────────────────────────────────────────────────────────

export function SearchResultList() {
  const searchParams = useSearchParams()
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const fetchResults = useCallback(() => {
    const query = buildSearchQuery(searchParams)
    // 至少有一个参数才发请求
    if (!query.replace('limit=20', '').trim()) {
      setResults([])
      setTotal(0)
      setHasSearched(false)
      return
    }
    setLoading(true)
    setHasSearched(true)
    apiClient
      .get<ApiListResponse<SearchResult>>(`/search?${query}`, { skipAuth: true })
      .then((res) => {
        setResults(res.data)
        setTotal(res.pagination.total)
      })
      .catch(() => {
        setResults([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [searchParams])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  if (!hasSearched) {
    return (
      <div
        className="py-20 text-center text-sm"
        style={{ color: 'var(--muted-foreground)' }}
        data-testid="search-empty-hint"
      >
        输入关键词或选择筛选条件开始搜索
      </div>
    )
  }

  if (loading) {
    return (
      <div className="divide-y" style={{ borderColor: 'var(--border)' }} data-testid="search-result-list">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-3 animate-pulse">
            <div className="shrink-0 rounded" style={{ width: 128, aspectRatio: '16/9', background: 'var(--secondary)' }} />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 rounded" style={{ background: 'var(--secondary)', width: '60%' }} />
              <div className="h-3 rounded" style={{ background: 'var(--secondary)', width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div
        className="py-20 text-center text-sm"
        style={{ color: 'var(--muted-foreground)' }}
        data-testid="search-no-results"
      >
        未找到相关内容
      </div>
    )
  }

  return (
    <div className="px-4 pb-8" data-testid="search-result-list">
      {/* 结果总数 */}
      <p
        className="text-xs py-2 border-b"
        style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}
        data-testid="search-result-count"
      >
        共 {total} 个结果
      </p>

      {/* 结果列表 */}
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {results.map((result) => (
          <ResultCard key={result.id} result={result} />
        ))}
      </div>
    </div>
  )
}
