/**
 * ReviewModal.tsx — 审核通过/驳回模态框
 * CHG-29: 通过直接提交；驳回需填写必填理由（1~200 字）
 */

'use client'

import { useState } from 'react'
import { Modal } from '@/components/admin/Modal'

export type ReviewTarget = {
  id: string
  type: 'submission' | 'subtitle'
  title?: string
}

interface ReviewModalProps {
  open: boolean
  target: ReviewTarget | null
  onClose: () => void
  onApprove: (id: string, type: ReviewTarget['type']) => Promise<void>
  onReject: (id: string, type: ReviewTarget['type'], reason: string) => Promise<void>
}

export function ReviewModal({ open, target, onClose, onApprove, onReject }: ReviewModalProps) {
  const [tab, setTab] = useState<'approve' | 'reject'>('approve')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  if (!target) return null

  const typeLabel = target.type === 'submission' ? '投稿' : '字幕'
  const canReject = reason.trim().length >= 1 && reason.trim().length <= 200

  async function handleSubmit() {
    if (!target) return
    setLoading(true)
    try {
      if (tab === 'approve') {
        await onApprove(target.id, target.type)
      } else {
        await onReject(target.id, target.type, reason.trim())
      }
      setReason('')
      setTab('approve')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`审核${typeLabel}`}
      size="sm"
    >
      <div data-testid="review-modal-body">
        {target.title && (
          <p className="mb-3 text-sm text-[var(--muted)]">{target.title}</p>
        )}

        {/* Tab 切换 */}
        <div className="mb-4 flex gap-2 border-b border-[var(--border)]" data-testid="review-modal-tabs">
          <button
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'approve'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
            }`}
            onClick={() => setTab('approve')}
            data-testid="review-modal-tab-approve"
          >
            通过
          </button>
          <button
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'reject'
                ? 'border-red-400 text-red-400'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
            }`}
            onClick={() => setTab('reject')}
            data-testid="review-modal-tab-reject"
          >
            驳回
          </button>
        </div>

        {tab === 'approve' && (
          <p className="mb-4 text-sm text-[var(--muted)]">
            确认通过该{typeLabel}审核？通过后将立即生效。
          </p>
        )}

        {tab === 'reject' && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">
              驳回理由 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="请输入驳回原因（1~200 字）"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
              data-testid="review-modal-reason-input"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">{reason.trim().length}/200</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
            data-testid="review-modal-cancel"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (tab === 'reject' && !canReject)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
              tab === 'reject'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-[var(--accent)] text-black hover:opacity-90'
            }`}
            data-testid="review-modal-submit"
          >
            {loading ? '提交中…' : tab === 'approve' ? '确认通过' : '确认驳回'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
