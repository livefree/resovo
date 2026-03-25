/**
 * DataMigration.tsx — 数据导入导出面板（Client Component）
 * CHG-31: 播放源 JSON 导出 + 文件导入 + 结果摘要
 */

'use client'

import { useState, useRef } from 'react'
import { apiClient } from '@/lib/api-client'
import { Modal } from '@/components/admin/Modal'

interface ImportResult {
  imported: number
  skipped: number
  errors: Array<{ index: number; shortId?: string; error: string }>
}

export function DataMigration() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    setExporting(true)
    try {
      // Use fetch directly since we need to handle the file download
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'
      const authStore = (await import('@/stores/authStore')).useAuthStore.getState()
      const token = authStore.accessToken

      const res = await fetch(`${API_URL}/admin/export/sources`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!res.ok) {
        setImportError('导出失败，请重试')
        return
      }

      const blob = await res.blob()
      const date = new Date().toISOString().slice(0, 10)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sources-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setImportError('导出失败，请重试')
    } finally {
      setExporting(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.json')) {
      setImportError('只支持 .json 格式文件')
      return
    }

    setImportError(null)
    setImporting(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await apiClient.upload<{ data: ImportResult }>('/admin/import/sources', formData)
      setImportResult(res.data)
    } catch (err) {
      setImportError(`导入失败: ${err instanceof Error ? err.message : '请重试'}`)
    } finally {
      setImporting(false)
      // 重置 input 让同一文件可以再次选择
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div data-testid="data-migration" className="space-y-8">
      {/* 导出区 */}
      <section className="rounded-lg border border-[var(--border)] p-6">
        <h2 className="mb-2 text-base font-semibold text-[var(--text)]">导出播放源</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          将所有有效播放源导出为 JSON 文件，可用于备份或迁移。不含用户投稿数据。
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="rounded-md px-4 py-2 text-sm font-medium bg-[var(--accent)] text-black hover:opacity-90 disabled:opacity-40"
          data-testid="export-sources-btn"
        >
          {exporting ? '导出中…' : '导出播放源 JSON'}
        </button>
      </section>

      {/* 导入区 */}
      <section className="rounded-lg border border-[var(--border)] p-6">
        <h2 className="mb-2 text-base font-semibold text-[var(--text)]">导入播放源</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          上传符合格式的 JSON 文件批量添加播放源。单条校验失败不会中断整批导入。
        </p>

        <label
          htmlFor="import-file-input"
          className={`inline-flex cursor-pointer items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg2)] ${importing ? 'opacity-40 pointer-events-none' : ''}`}
          data-testid="import-sources-label"
        >
          {importing ? '导入中…' : '选择 JSON 文件'}
        </label>
        <input
          id="import-file-input"
          type="file"
          accept=".json"
          className="sr-only"
          onChange={handleFileChange}
          disabled={importing}
          ref={fileInputRef}
          data-testid="import-file-input"
        />

        {importError && (
          <p className="mt-3 text-sm text-red-400" data-testid="import-error">
            {importError}
          </p>
        )}
      </section>

      {/* 导入结果 Modal */}
      <Modal
        open={importResult !== null}
        onClose={() => setImportResult(null)}
        title="导入结果"
        size="md"
      >
        {importResult && (
          <div data-testid="import-result-modal">
            <div className="mb-4 grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-green-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-green-400" data-testid="import-count-imported">
                  {importResult.imported}
                </p>
                <p className="text-xs text-[var(--muted)]">成功导入</p>
              </div>
              <div className="rounded-lg bg-yellow-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-yellow-400" data-testid="import-count-skipped">
                  {importResult.skipped}
                </p>
                <p className="text-xs text-[var(--muted)]">已跳过</p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-red-400" data-testid="import-count-errors">
                  {importResult.errors.length}
                </p>
                <p className="text-xs text-[var(--muted)]">失败</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-md bg-[var(--bg2)] p-3">
                <p className="mb-2 text-xs font-medium text-[var(--muted)]">错误详情</p>
                {importResult.errors.map((e, i) => (
                  <div key={i} className="mb-1 text-xs text-red-400">
                    第 {e.index + 1} 条
                    {e.shortId ? ` (${e.shortId})` : ''}: {e.error}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setImportResult(null)}
                className="rounded-md px-4 py-2 text-sm bg-[var(--accent)] text-black hover:opacity-90"
                data-testid="import-result-close"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
