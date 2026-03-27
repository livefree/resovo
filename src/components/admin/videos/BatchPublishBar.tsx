/**
 * BatchPublishBar.tsx — 底部浮动批量操作栏
 * CHG-213: 支持批量可见性切换与批量审核
 */

'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'

interface BatchPublishBarProps {
  selectedIds: string[]
  onSuccess: () => void
  onClear: () => void
}

export function BatchPublishBar({ selectedIds, onSuccess, onClear }: BatchPublishBarProps) {
  const count = selectedIds.length
  const [busyAction, setBusyAction] = useState<string | null>(null)

  if (count === 0) return null

  async function runBatchAction(actionKey: string, runner: () => Promise<void>) {
    if (count > 50) {
      alert('批量操作上限 50 条，请分批操作')
      return
    }

    setBusyAction(actionKey)
    try {
      await runner()
      onSuccess()
      onClear()
    } catch {
      // silent
    } finally {
      setBusyAction(null)
    }
  }

  async function handleBatchVisibility(visibility: 'public' | 'hidden') {
    await runBatchAction(`visibility:${visibility}`, async () => {
      await Promise.all(
        selectedIds.map((id) => apiClient.patch(`/admin/videos/${id}/visibility`, { visibility })),
      )
    })
  }

  async function handleBatchReview(action: 'approve' | 'reject') {
    await runBatchAction(`review:${action}`, async () => {
      await Promise.all(
        selectedIds.map((id) => apiClient.post(`/admin/videos/${id}/review`, { action })),
      )
    })
  }

  return (
    <div
      className="sticky bottom-0 z-10 flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg2)] px-6 py-3 shadow-lg"
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
          disabled={busyAction !== null}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)]"
          data-testid="batch-clear-btn"
        >
          取消
        </button>
        <button
          onClick={() => void handleBatchVisibility('hidden')}
          disabled={count > 50 || busyAction !== null}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
          data-testid="batch-hide-btn"
        >
          批量隐藏
        </button>
        <button
          onClick={() => void handleBatchVisibility('public')}
          disabled={count > 50 || busyAction !== null}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-40"
          data-testid="batch-publish-btn"
        >
          批量公开
        </button>
        <button
          onClick={() => void handleBatchReview('approve')}
          disabled={count > 50 || busyAction !== null}
          className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-sm text-green-300 hover:bg-green-500/20 disabled:opacity-40"
          data-testid="batch-approve-btn"
        >
          批量通过
        </button>
        <button
          onClick={() => void handleBatchReview('reject')}
          disabled={count > 50 || busyAction !== null}
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/20 disabled:opacity-40"
          data-testid="batch-reject-btn"
        >
          批量拒绝
        </button>
      </div>
    </div>
  )
}
