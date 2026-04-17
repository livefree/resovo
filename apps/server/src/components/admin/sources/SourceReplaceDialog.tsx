/**
 * SourceReplaceDialog.tsx — 替换播放源 URL 弹窗（ADMIN-12）
 * 流程：输入新 URL → [预览] 内嵌播放器确认可播 → [确认替换] 写库
 */

'use client'

import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { notify } from '@/components/admin/shared/toast/useAdminToast'
import { AdminDialogShell } from '@/components/admin/shared/dialog/AdminDialogShell'
import { ModerationPlayer } from '@/components/admin/moderation/ModerationPlayer'

interface SourceReplaceDialogProps {
  sourceId: string
  videoTitle?: string
  onClose: () => void
  onReplaced: () => void
}

export function SourceReplaceDialog({
  sourceId,
  videoTitle,
  onClose,
  onReplaced,
}: SourceReplaceDialogProps) {
  const [newUrl, setNewUrl] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handlePreview() {
    const trimmed = newUrl.trim()
    if (!trimmed) return
    setPreviewUrl(trimmed)
  }

  async function handleConfirm() {
    const trimmed = newUrl.trim()
    if (!trimmed) return
    setLoading(true)
    try {
      await apiClient.patch(`/admin/sources/${sourceId}/url`, { newUrl: trimmed })
      notify.success('播放源已替换')
      onReplaced()
      onClose()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '替换失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminDialogShell
      title="替换播放源 URL"
      onClose={onClose}
      widthClassName="max-w-2xl"
    >
      <div className="space-y-4">
        {videoTitle ? (
          <p className="text-xs text-[var(--muted)]">视频：<span className="text-[var(--text)]">{videoTitle}</span></p>
        ) : null}

        <div className="flex gap-2">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => {
              setNewUrl(e.target.value)
              setPreviewUrl(null)
            }}
            placeholder="输入新播放源 URL"
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            data-testid="replace-dialog-url-input"
          />
          <button
            type="button"
            onClick={handlePreview}
            disabled={!newUrl.trim()}
            className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg2)] disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="replace-dialog-preview-btn"
          >
            预览
          </button>
        </div>

        <div className="min-h-[180px]">
          <ModerationPlayer
            sourceUrl={previewUrl}
            title={videoTitle}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
            data-testid="replace-dialog-cancel-btn"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => { void handleConfirm() }}
            disabled={loading || !newUrl.trim() || previewUrl !== newUrl.trim()}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="replace-dialog-confirm-btn"
          >
            {loading ? '替换中…' : '确认替换'}
          </button>
        </div>
      </div>
    </AdminDialogShell>
  )
}
