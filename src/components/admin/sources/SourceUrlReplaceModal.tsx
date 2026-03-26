'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

interface SourceUrlReplaceModalProps {
  sourceId: string | null
  currentUrl: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function SourceUrlReplaceModal({ sourceId, currentUrl, open, onClose, onSuccess }: SourceUrlReplaceModalProps) {
  const [value, setValue] = useState(currentUrl)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(currentUrl)
  }, [currentUrl])

  if (!open || !sourceId) return null

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      await apiClient.patch(`/admin/sources/${sourceId}`, { sourceUrl: value })
      onSuccess()
      onClose()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-testid="source-url-replace-modal">
      <form className="w-full max-w-xl rounded-lg border border-[var(--border)] bg-[var(--bg)] p-5 shadow-2xl" onSubmit={handleSubmit}>
        <h3 className="text-base font-semibold text-[var(--text)]">替换源 URL</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">提交后会重置该源为活跃状态。</p>
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="mt-4 min-h-28 w-full rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm"
          data-testid="source-url-replace-input"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]">取消</button>
          <button type="submit" disabled={saving} className="rounded bg-[var(--accent)] px-3 py-2 text-sm font-medium text-black disabled:opacity-50" data-testid="source-url-replace-save">
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}
