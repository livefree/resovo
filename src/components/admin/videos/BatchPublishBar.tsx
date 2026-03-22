/**
 * BatchPublishBar.tsx — 底部浮动批量操作栏
 * CHG-27: 有选中行时从底部滑入，提供批量上架/下架
 */

'use client'

import { apiClient } from '@/lib/api-client'

interface BatchPublishBarProps {
  selectedIds: string[]
  onSuccess: () => void
  onClear: () => void
}

export function BatchPublishBar({ selectedIds, onSuccess, onClear }: BatchPublishBarProps) {
  const count = selectedIds.length

  if (count === 0) return null

  async function handleBatchPublish() {
    if (count > 50) {
      alert('批量操作上限 50 条，请分批操作')
      return
    }
    try {
      await apiClient.post('/admin/videos/batch-publish', { ids: selectedIds, isPublished: true })
      onSuccess()
    } catch {
      // silent
    }
  }

  async function handleBatchUnpublish() {
    if (count > 50) {
      alert('批量操作上限 50 条，请分批操作')
      return
    }
    try {
      await apiClient.post('/admin/videos/batch-unpublish', { ids: selectedIds })
      onSuccess()
    } catch {
      // silent
    }
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg2)] px-6 py-3 shadow-lg"
      data-testid="batch-publish-bar"
      style={{ animation: 'slideUp 0.2s ease-out' }}
    >
      <span className="text-sm text-[var(--text)]" data-testid="batch-publish-count">
        已选 <span className="font-bold text-[var(--accent)]">{count}</span> 条
        {count > 50 && (
          <span className="ml-2 text-red-400 text-xs">（超出上限 50 条）</span>
        )}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onClear}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)]"
          data-testid="batch-clear-btn"
        >
          取消
        </button>
        <button
          onClick={handleBatchUnpublish}
          disabled={count > 50}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
          data-testid="batch-unpublish-btn"
        >
          批量下架
        </button>
        <button
          onClick={handleBatchPublish}
          disabled={count > 50}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-40"
          data-testid="batch-publish-btn"
        >
          批量上架
        </button>
      </div>
    </div>
  )
}
