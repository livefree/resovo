'use client'

/**
 * MigrationTab — 数据迁移 Tab（CHG-SN-6-08 / SettingsContainer 5/5 闭环）
 *
 * 范围：消费 v1 CHG-31 端点（allowlist 豁免）：
 *   - GET /admin/export/sources   → 浏览器下载 sources-YYYY-MM-DD.json
 *   - POST /admin/import/sources  → multipart 上传 JSON 数组（RETRO-3-A audit_log
 *                                    system.sources_import 已写入位点）
 *
 * 共享原语（≥ 80%）：AdminCard / AdminButton / useToast
 */

import React, { useState, useCallback, useRef, type CSSProperties } from 'react'
import {
  AdminCard,
  AdminButton,
  useToast,
} from '@resovo/admin-ui'
import {
  exportSourcesDownload,
  importSourcesUpload,
  type ImportSourcesResult,
} from '@/lib/system/api'
import { ApiClientError } from '@/lib/api-client'

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '12px 0',
}

const FIELD_HINT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginTop: '8px',
}

const RESULT_BLOCK_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '6px 16px',
  marginTop: '12px',
  padding: '12px',
  background: 'var(--bg-surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-xs)',
}

const RESULT_LABEL_STYLE: CSSProperties = { color: 'var(--fg-muted)' }
const RESULT_VALUE_STYLE: CSSProperties = {
  color: 'var(--fg-default)',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
}

const ERROR_ITEM_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--state-danger-fg)',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  padding: '4px 0',
  borderTop: '1px dashed var(--border-default)',
}

function describeApiError(err: unknown): { title: string; description: string } {
  if (err instanceof ApiClientError) {
    if (err.code === 'VALIDATION_ERROR') {
      return { title: '上传文件不合法', description: err.message }
    }
    return { title: '操作失败', description: err.message }
  }
  return { title: '操作失败', description: err instanceof Error ? err.message : '请稍后重试' }
}

export function MigrationTab() {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [exportPending, setExportPending] = useState(false)
  const [importPending, setImportPending] = useState(false)
  const [importResult, setImportResult] = useState<ImportSourcesResult | null>(null)

  const handleExport = useCallback(async () => {
    setExportPending(true)
    try {
      await exportSourcesDownload()
      toast.push({ title: '导出已开始', description: '浏览器已触发文件下载', level: 'success' })
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setExportPending(false)
    }
  }, [toast])

  const handleFilePick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportPending(true)
    setImportResult(null)
    try {
      const result = await importSourcesUpload(file)
      setImportResult(result)
      toast.push({
        title: '导入完成',
        description: `成功 ${result.imported} · 跳过 ${result.skipped} · 失败 ${result.errors.length}`,
        level: result.errors.length === 0 ? 'success' : 'warn',
      })
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setImportPending(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [toast])

  return (
    <div style={SECTION_STYLE} data-testid="migration-tab">
      <AdminCard
        surface="plain"
        padding="md"
        header={{ title: '导出播放源', subtitle: '下载完整 sources JSON 数组（备份 / 跨实例迁移）' }}
        data-testid="migration-card-export"
      >
        <AdminButton
          variant="primary"
          size="sm"
          loading={exportPending}
          onClick={() => void handleExport()}
          data-testid="migration-export-btn"
        >
          导出 sources JSON
        </AdminButton>
        <div style={FIELD_HINT_STYLE}>
          全表导出（不分页）；大数据集建议在低峰期执行
        </div>
      </AdminCard>

      <AdminCard
        surface="plain"
        padding="md"
        header={{ title: '导入播放源', subtitle: '上传 JSON 数组（数据格式参考导出结果）' }}
        data-testid="migration-card-import"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void handleFileChange(e)}
          style={{ display: 'none' }}
          data-testid="migration-import-file"
        />
        <AdminButton
          variant="default"
          size="sm"
          loading={importPending}
          onClick={handleFilePick}
          data-testid="migration-import-btn"
        >
          选择 JSON 文件上传…
        </AdminButton>
        <div style={FIELD_HINT_STYLE}>
          仅支持 JSON 数组；每条记录需含 shortId / sourceName / sourceUrl 字段；audit_log
          system.sources_import 自动写入
        </div>

        {importResult ? (
          <div style={RESULT_BLOCK_STYLE} data-testid="migration-import-result">
            <span style={RESULT_LABEL_STYLE}>成功导入</span>
            <span style={RESULT_VALUE_STYLE}>{importResult.imported.toLocaleString()}</span>
            <span style={RESULT_LABEL_STYLE}>跳过</span>
            <span style={RESULT_VALUE_STYLE}>{importResult.skipped.toLocaleString()}</span>
            <span style={RESULT_LABEL_STYLE}>失败</span>
            <span style={RESULT_VALUE_STYLE}>{importResult.errors.length.toLocaleString()}</span>
            {importResult.errors.length > 0 ? (
              <div style={{ gridColumn: '1 / 3', marginTop: '8px' }}>
                <div style={{ ...RESULT_LABEL_STYLE, marginBottom: '4px' }}>错误详情：</div>
                {importResult.errors.slice(0, 10).map((err) => (
                  <div key={err.index} style={ERROR_ITEM_STYLE} data-testid={`migration-error-${err.index}`}>
                    #{err.index}{err.shortId ? ` (${err.shortId})` : ''}: {err.error}
                  </div>
                ))}
                {importResult.errors.length > 10 ? (
                  <div style={{ ...RESULT_LABEL_STYLE, marginTop: '6px' }}>
                    … 还有 {importResult.errors.length - 10} 条错误未显示
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminCard>
    </div>
  )
}
