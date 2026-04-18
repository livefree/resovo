/**
 * BatchDeleteBar.tsx — 批量删除失效源的底部浮动操作栏
 * CHG-28: 多选 → 底部栏 → ConfirmDialog → 批量删除
 * CHG-264: 内部布局层替换为 SelectionActionBar sticky-bottom
 */

'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { SelectionActionBar } from '@/components/admin/shared/batch/SelectionActionBar'

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
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SelectionActionBar
        variant="sticky-bottom"
        selectedCount={count}
        data-testid="batch-delete-bar"
        countTestId="batch-delete-count"
        actions={[
          {
            key: 'clear',
            label: '取消',
            onClick: onClear,
            testId: 'batch-delete-clear-btn',
          },
          {
            key: 'delete',
            label: '批量删除',
            onClick: () => setDialogOpen(true),
            variant: 'danger',
            testId: 'batch-delete-confirm-btn',
          },
        ]}
      />

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
