/**
 * ModerationDashboard.tsx — 审核台主容器（CHG-221/222/223/224）
 * 布局：顶部统计板 + 左右分栏（左：待审列表，右：审核详情）
 * 快捷键：A=通过 / R=拒绝 / ←→=上下条切换
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { ModerationStats } from '@/components/admin/moderation/ModerationStats'
import { ModerationList } from '@/components/admin/moderation/ModerationList'
import { ModerationDetail } from '@/components/admin/moderation/ModerationDetail'
import { useModerationHotkeys } from '@/components/admin/moderation/useModerationHotkeys'

const NAV_FETCH_LIMIT = 50

interface NavIdRow {
  id: string
}

export function ModerationDashboard() {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [listRefreshKey, setListRefreshKey] = useState(0)
  const [navIds, setNavIds] = useState<string[]>([])
  const reviewingRef = useRef(false)

  // Fetch a lightweight ID list for keyboard navigation
  const fetchNavIds = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: NavIdRow[]; total: number }>(
        `/admin/videos/pending-review?page=1&limit=${NAV_FETCH_LIMIT}`
      )
      setNavIds(res.data.map((r) => r.id))
    } catch (_err) {
      // nav IDs fetch failed: keyboard navigation falls back to no-op
    }
  }, [])

  useEffect(() => { void fetchNavIds() }, [fetchNavIds, listRefreshKey])

  const handleReviewed = useCallback(() => {
    setSelectedVideoId(null)
    setListRefreshKey((k) => k + 1)
  }, [])

  const handleApprove = useCallback(async () => {
    if (!selectedVideoId || reviewingRef.current) return
    reviewingRef.current = true
    try {
      await apiClient.post(`/admin/videos/${selectedVideoId}/review`, { action: 'approve' })
      handleReviewed()
    } catch (_err) {
      // hotkey shortcut failed: detail panel's error state shows feedback
    } finally {
      reviewingRef.current = false
    }
  }, [selectedVideoId, handleReviewed])

  const handleReject = useCallback(async () => {
    if (!selectedVideoId || reviewingRef.current) return
    reviewingRef.current = true
    try {
      await apiClient.post(`/admin/videos/${selectedVideoId}/review`, { action: 'reject' })
      handleReviewed()
    } catch (_err) {
      // hotkey shortcut failed: detail panel's error state shows feedback
    } finally {
      reviewingRef.current = false
    }
  }, [selectedVideoId, handleReviewed])

  const handlePrev = useCallback(() => {
    if (navIds.length === 0) return
    if (!selectedVideoId) {
      setSelectedVideoId(navIds[0] ?? null)
      return
    }
    const idx = navIds.indexOf(selectedVideoId)
    const prevIdx = idx > 0 ? idx - 1 : navIds.length - 1
    setSelectedVideoId(navIds[prevIdx] ?? null)
  }, [navIds, selectedVideoId])

  const handleNext = useCallback(() => {
    if (navIds.length === 0) return
    if (!selectedVideoId) {
      setSelectedVideoId(navIds[0] ?? null)
      return
    }
    const idx = navIds.indexOf(selectedVideoId)
    const nextIdx = idx >= 0 && idx < navIds.length - 1 ? idx + 1 : 0
    setSelectedVideoId(navIds[nextIdx] ?? null)
  }, [navIds, selectedVideoId])

  useModerationHotkeys({
    enabled: true,
    onApprove: () => { void handleApprove() },
    onReject: () => { void handleReject() },
    onPrev: handlePrev,
    onNext: handleNext,
  })

  return (
    <div className="flex flex-col gap-4" data-testid="moderation-dashboard">
      {/* 顶部统计板 */}
      <ModerationStats />

      {/* 左右分栏 */}
      <div className="flex min-h-[600px] gap-4">
        {/* 左侧：待审列表面板 */}
        <div
          className="flex w-[400px] shrink-0 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg2)]"
          data-testid="moderation-list-panel"
        >
          <ModerationList
            key={listRefreshKey}
            selectedId={selectedVideoId}
            onSelect={setSelectedVideoId}
          />
        </div>

        {/* 右侧：审核详情面板 */}
        <div
          className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg2)]"
          data-testid="moderation-detail-panel"
        >
          <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--text)]">
              {selectedVideoId != null ? '审核详情' : '请从左侧选择视频'}
            </p>
            {selectedVideoId != null && (
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                快捷键：A 通过 · R 拒绝 · ← → 切换
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <ModerationDetail
              videoId={selectedVideoId}
              onReviewed={handleReviewed}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
