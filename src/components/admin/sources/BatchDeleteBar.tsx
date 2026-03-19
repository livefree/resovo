/**
 * BatchDeleteBar.tsx — 批量删除失效源的底部浮动操作栏
 * CHG-28: 多选 → 底部栏 → ConfirmDialog → 批量删除
 */

'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'

interface BatchDeleteBarProps {
  selectedIds: string[]
  onSuccess: () => void
  onClear: () => void
}

export function BatchDeleteBar({ selectedIds, onSuccess, onClear }: BatchDeleteBarProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const count = selectedIds.length

  if (count === 0) return null

  async function handleDelete() {
    setLoading(true)
    try {
      await apiClient.post('/admin/sources/batch-delete', { ids: selectedIds })
      setDialogOpen(false)
      onSuccess()
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg2)] px-6 py-3 shadow-lg"
        data-testid="batch-delete-bar"
      >
        <span className="text-sm text-[var(--text)]" data-testid="batch-delete-count">
          已选 <span className="font-bold text-[var(--accent)]">{count}</span> 条失效源
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)]"
            data-testid="batch-delete-clear-btn"
          >
            取消
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            data-testid="batch-delete-confirm-btn"
          >
            批量删除
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="确认批量删除"
        description={`确定要删除选中的 ${count} 条失效播放源吗？此操作不可撤销。`}
        confirmText="删除"
        onConfirm={handleDelete}
        loading={loading}
        danger
      />
    </>
  )
}
