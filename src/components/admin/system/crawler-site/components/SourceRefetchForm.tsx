'use client'

/**
 * SourceRefetchForm.tsx — 单视频补源采集表单
 * UX-08: 视频搜索下拉 → 展示当前源状态 → [开始补源采集]
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { AdminButton } from '@/components/admin/shared/button/AdminButton'
import { AdminFormField } from '@/components/admin/shared/form/AdminFormField'
import { notify } from '@/components/admin/shared/toast/useAdminToast'
import type { CrawlerSite } from '@/types'

// ── 类型 ─────────────────────────────────────────────────────────

interface VideoSearchItem {
  id: string
  title: string
  year: number | null
  type: string | null
}

interface VideoSearchResponse {
  data: VideoSearchItem[]
  total: number
}

interface RefetchResponse {
  data: {
    sourcesAdded: number
    notFound: string[]
  }
}

interface SourceRefetchFormProps {
  sites: CrawlerSite[]
}

// ── Component ─────────────────────────────────────────────────────

export function SourceRefetchForm({ sites }: SourceRefetchFormProps) {
  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<VideoSearchItem[]>([])
  const [selectedVideo, setSelectedVideo] = useState<VideoSearchItem | null>(null)
  const [selectedSiteKeys, setSelectedSiteKeys] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchVideos = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([])
      return
    }
    setSearching(true)
    try {
      const res = await apiClient.get<VideoSearchResponse>(
        `/admin/videos?q=${encodeURIComponent(q)}&limit=10`
      )
      setSuggestions(res.data ?? [])
    } catch {
      setSuggestions([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (selectedVideo) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void searchVideos(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, selectedVideo, searchVideos])

  function selectVideo(video: VideoSearchItem) {
    setSelectedVideo(video)
    setQuery(video.title)
    setDropdownOpen(false)
    setSuggestions([])
  }

  function clearSelection() {
    setSelectedVideo(null)
    setQuery('')
    setSuggestions([])
  }

  function toggleSite(key: string) {
    setSelectedSiteKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  async function handleRefetch() {
    if (!selectedVideo) {
      notify.warn('请先选择要补源的视频')
      return
    }
    setSubmitting(true)
    try {
      const res = await apiClient.post<RefetchResponse>(
        `/admin/videos/${selectedVideo.id}/refetch-sources`,
        { siteKeys: selectedSiteKeys.length > 0 ? selectedSiteKeys : undefined }
      )
      const { sourcesAdded, notFound } = res.data
      const notFoundMsg = notFound.length > 0 ? `，${notFound.length} 个站点无匹配` : ''
      notify.success(`补源完成：新增 ${sourcesAdded} 条源${notFoundMsg}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : '补源失败'
      notify.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5" data-testid="source-refetch-form">
      <AdminFormField label="选择视频">
        <div className="relative" data-testid="video-search-container">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setDropdownOpen(true)
                if (selectedVideo) setSelectedVideo(null)
              }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="输入视频标题搜索"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              data-testid="video-search-input"
            />
            {selectedVideo && (
              <button
                type="button"
                onClick={clearSelection}
                className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                data-testid="clear-video-btn"
              >
                清除
              </button>
            )}
          </div>

          {dropdownOpen && suggestions.length > 0 && (
            <ul
              className="absolute left-0 top-full z-30 mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg2)] shadow-lg"
              data-testid="video-suggestions"
            >
              {searching && (
                <li className="px-4 py-2 text-xs text-[var(--muted)]">搜索中...</li>
              )}
              {suggestions.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => selectVideo(v)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg3)]"
                    data-testid={`video-option-${v.id}`}
                  >
                    <span className="text-[var(--text)]">{v.title}</span>
                    {v.year && (
                      <span className="ml-2 text-xs text-[var(--muted)]">{v.year}</span>
                    )}
                    {v.type && (
                      <span className="ml-1 text-xs text-[var(--muted)]">· {v.type}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedVideo && (
          <p className="mt-1 text-xs text-[var(--muted)]" data-testid="selected-video-hint">
            已选：{selectedVideo.title}
            {selectedVideo.year ? ` (${selectedVideo.year})` : ''}
          </p>
        )}
      </AdminFormField>

      <AdminFormField label="目标站点">
        <div className="flex flex-wrap gap-2" data-testid="site-checkboxes">
          {sites.map((site) => (
            <label
              key={site.key}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--bg3)]"
              data-testid={`site-checkbox-${site.key}`}
            >
              <input
                type="checkbox"
                checked={selectedSiteKeys.includes(site.key)}
                onChange={() => toggleSite(site.key)}
                className="accent-[var(--accent)]"
              />
              <span className="text-[var(--text)]">{site.name}</span>
            </label>
          ))}
          {sites.length === 0 && (
            <span className="text-xs text-[var(--muted)]">暂无可用站点</span>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {selectedSiteKeys.length === 0 ? '未选择 = 使用全部启用站点' : `已选 ${selectedSiteKeys.length} 个站点`}
        </p>
      </AdminFormField>

      <AdminButton
        variant="primary"
        onClick={handleRefetch}
        disabled={!selectedVideo || submitting}
        data-testid="refetch-btn"
      >
        {submitting ? '补源中...' : '开始补源采集'}
      </AdminButton>
    </div>
  )
}
