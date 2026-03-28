/**
 * BatchPublishBar.tsx — 底部浮动批量操作栏
 * CHG-213: 支持批量可见性切换与批量审核
 * CHG-264: 内部布局层完整替换为 SelectionActionBar sticky-bottom
 */

'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { SelectionActionBar } from '@/components/admin/shared/batch/SelectionActionBar'

interface BatchPublishBarProps {
  selectedIds: string[]
  onSuccess: () => void
  onClear: () => void
}

const BATCH_LIMIT = 50

export function BatchPublishBar({ selectedIds, onSuccess, onClear }: BatchPublishBarProps) {
  const count = selectedIds.length
  const [busyAction, setBusyAction] = useState<string | null>(null)

  if (count === 0) return null

  const overLimit = count > BATCH_LIMIT
  const busy = busyAction !== null
  const disabled = overLimit || busy

  async function runBatchAction(actionKey: string, runner: () => Promise<void>) {
    if (overLimit) return
    setBusyAction(actionKey)
    try {
      await runner()
      onSuccess()
      onClear()
    } catch { /* silent */ } finally {
      setBusyAction(null)
    }
  }

  async function handleVisibility(visibility: 'public' | 'hidden') {
    await runBatchAction(`visibility:${visibility}`, async () => {
      if (visibility === 'public') {
        await apiClient.post('/admin/videos/batch-publish', { ids: selectedIds, isPublished: true })
        return
      }

      await apiClient.post('/admin/videos/batch-unpublish', { ids: selectedIds })
    })
  }

  async function handleReview(action: 'approve' | 'reject') {
    await runBatchAction(`review:${action}`, async () => {
      await Promise.all(
        selectedIds.map((id) => apiClient.post(`/admin/videos/${id}/review`, { action })),
      )
    })
  }

  return (
    <SelectionActionBar
      variant="sticky-bottom"
      selectedCount={count}
      data-testid="batch-publish-bar"
      countTestId="batch-publish-count"
      actions={[
        {
          key: 'clear',
          label: '取消',
          onClick: onClear,
          disabled: busy,
          testId: 'batch-clear-btn',
        },
        {
          key: 'hide',
          label: '批量隐藏',
          onClick: () => { void handleVisibility('hidden') },
          disabled,
          testId: 'batch-hide-btn',
        },
        {
          key: 'publish',
          label: '批量公开',
          onClick: () => { void handleVisibility('public') },
          variant: 'primary',
          disabled,
          testId: 'batch-publish-btn',
        },
        {
          key: 'approve',
          label: '批量通过',
          onClick: () => { void handleReview('approve') },
          variant: 'success',
          disabled,
          testId: 'batch-approve-btn',
        },
        {
          key: 'reject',
          label: '批量拒绝',
          onClick: () => { void handleReview('reject') },
          variant: 'danger',
          disabled,
          testId: 'batch-reject-btn',
        },
      ]}
    />
  )
}
