'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

interface ShellCountPayload {
  count: number
  videoIds: string[]
}

interface SourceHealthAlertProps {
  onResolved?: () => void
}

export function SourceHealthAlert({ onResolved }: SourceHealthAlertProps) {
  const [payload, setPayload] = useState<ShellCountPayload | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await apiClient.get<{ data: ShellCountPayload }>('/admin/sources/shell-count')
        if (!cancelled) setPayload(res.data)
      } catch {
        if (!cancelled) setPayload(null)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleHideAll() {
    if (!payload || payload.videoIds.length === 0) return
    setLoading(true)
    try {
      await Promise.all(
        payload.videoIds.map((videoId) => apiClient.patch(`/admin/videos/${videoId}/visibility`, { visibility: 'hidden' })),
      )
      setPayload({ count: 0, videoIds: [] })
      onResolved?.()
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  if (!payload || payload.count <= 0) return null

  return (
    <div
      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-[var(--text)]"
      data-testid="source-health-alert"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium">检测到 {payload.count} 个空壳视频</div>
          <div className="text-xs text-[var(--muted)]">这些视频仍处于上架状态，但已没有任何可用播放源。</div>
        </div>
        <button
          type="button"
          onClick={() => void handleHideAll()}
          disabled={loading}
          className="rounded border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs text-amber-100 disabled:opacity-50"
          data-testid="source-health-hide-btn"
        >
          {loading ? '处理中…' : '批量下架'}
        </button>
      </div>
    </div>
  )
}
