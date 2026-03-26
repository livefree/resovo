/**
 * ModerationDashboard.tsx — 审核台主容器（CHG-221/222/223）
 * 布局：顶部统计板 + 左右分栏（左：待审列表，右：审核详情）
 */

'use client'

import { useCallback, useState } from 'react'
import { ModerationStats } from '@/components/admin/moderation/ModerationStats'
import { ModerationList } from '@/components/admin/moderation/ModerationList'
import { ModerationDetail } from '@/components/admin/moderation/ModerationDetail'

export function ModerationDashboard() {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [listRefreshKey, setListRefreshKey] = useState(0)

  const handleReviewed = useCallback(() => {
    // 审核完成：清除选中，列表通过 key 变化强制刷新
    setSelectedVideoId(null)
    setListRefreshKey((k) => k + 1)
  }, [])

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
