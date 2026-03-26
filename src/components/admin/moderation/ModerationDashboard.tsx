/**
 * ModerationDashboard.tsx — 审核台主容器（CHG-221）
 * 布局：顶部统计板 + 左右分栏（左：待审列表，右：审核抽屉）
 * 左右面板内容由后续任务 CHG-222/223 填充
 */

'use client'

import { useState } from 'react'
import { ModerationStats } from '@/components/admin/moderation/ModerationStats'

export function ModerationDashboard() {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4" data-testid="moderation-dashboard">
      {/* 顶部统计板 */}
      <ModerationStats />

      {/* 左右分栏 */}
      <div className="flex min-h-[600px] gap-4">
        {/* 左侧：待审列表面板（CHG-222 填充） */}
        <div
          className="flex w-[400px] shrink-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--bg2)]"
          data-testid="moderation-list-panel"
        >
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--text)]">待审核列表</p>
          </div>
          <div
            className="flex flex-1 cursor-pointer items-center justify-center p-6"
            onClick={() => setSelectedVideoId('demo-id')}
            data-testid="moderation-list-placeholder"
          >
            <p className="text-sm text-[var(--muted)]">列表面板（CHG-222）</p>
          </div>
        </div>

        {/* 右侧：审核详情抽屉（CHG-223 填充） */}
        <div
          className="flex min-w-0 flex-1 flex-col rounded-lg border border-[var(--border)] bg-[var(--bg2)]"
          data-testid="moderation-detail-panel"
        >
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--text)]">
              {selectedVideoId != null ? '审核详情' : '请从左侧选择视频'}
            </p>
          </div>
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="text-sm text-[var(--muted)]" data-testid="moderation-detail-placeholder">
              {selectedVideoId != null
                ? `已选中 ${selectedVideoId}（详情面板 CHG-223）`
                : '详情面板（CHG-223）'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
