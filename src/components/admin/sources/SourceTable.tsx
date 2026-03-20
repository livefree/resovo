/**
 * SourceTable.tsx — 播放源管理表格（Client Component）
 * CHG-28: StatusBadge + SourceVerifyButton + 批量删除 + 状态筛选
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Pagination } from '@/components/admin/Pagination'
import { SourceVerifyButton } from '@/components/admin/sources/SourceVerifyButton'
import { BatchDeleteBar } from '@/components/admin/sources/BatchDeleteBar'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'

const PAGE_SIZE = 20
const URL_MAX_LEN = 60

interface SourceRow {
  id: string
  video_id: string
  source_url: string
  source_name: string
  quality: string | null
  type: string
  is_active: boolean
  last_checked: string | null
  created_at: string
  video_title?: string
}

function truncateUrl(url: string): string {
  return url.length > URL_MAX_LEN ? url.slice(0, URL_MAX_LEN) + '…' : url
}

export function SourceTable() {
  const [sources, setSources] = useState<SourceRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const fetchSources = useCallback(
    async (pageVal: number, statusVal: string) => {
      setLoading(true)
      setSelectedIds([])
      try {
        const params = new URLSearchParams({
          page: String(pageVal),
          limit: String(PAGE_SIZE),
          status: statusVal,
        })
        const res = await apiClient.get<{ data: SourceRow[]; total: number }>(
          `/admin/sources?${params}`
        )
        setSources(res.data)
        setTotal(res.total)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchSources(page, status)
  }, [fetchSources, page, status])

  function handleCheck(id: string, checked: boolean) {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    )
  }

  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? sources.map((s) => s.id) : [])
  }

  const allSelected = sources.length > 0 && selectedIds.length === sources.length

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/admin/sources/${id}`)
      fetchSources(page, status)
    } catch {
      // silent
    }
  }

  return (
    <div data-testid="source-table">
      {/* 状态筛选 */}
      <AdminToolbar
        className="gap-3"
        actions={(
          <select
            value={status}
            onChange={(e) => {
              setPage(1)
              setStatus(e.target.value as typeof status)
            }}
            className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            data-testid="source-status-filter"
          >
            <option value="all">全部状态</option>
            <option value="active">有效源</option>
            <option value="inactive">失效源</option>
          </select>
        )}
      />

      {/* 表格 */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg2)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="accent-[var(--accent)]"
                  data-testid="source-select-all"
                />
              </th>
              <th className="px-4 py-3 text-left">视频标题</th>
              <th className="px-4 py-3 text-left">源 URL</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">最后验证</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[var(--muted)]">加载中…</td>
              </tr>
            )}
            {!loading && sources.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[var(--muted)]">暂无数据</td>
              </tr>
            )}
            {!loading && sources.map((row) => (
              <tr
                key={row.id}
                className="bg-[var(--bg)] hover:bg-[var(--bg2)]"
                style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                data-testid={`source-row-${row.id}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={(e) => handleCheck(row.id, e.target.checked)}
                    className="accent-[var(--accent)]"
                    data-testid={`source-checkbox-${row.id}`}
                  />
                </td>
                <td className="px-4 py-3 text-[var(--text)]">
                  {row.video_title ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    title={row.source_url}
                    className="font-mono text-xs text-[var(--muted)]"
                    data-testid={`source-url-${row.id}`}
                  >
                    {truncateUrl(row.source_url)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.is_active ? 'active' : 'inactive'} />
                </td>
                <td className="px-4 py-3 text-xs text-[var(--muted)]">
                  {row.last_checked
                    ? new Date(row.last_checked).toLocaleString()
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <SourceVerifyButton
                      sourceId={row.id}
                      onVerified={() => fetchSources(page, status)}
                    />
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="rounded px-2 py-0.5 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60"
                      data-testid={`source-delete-btn-${row.id}`}
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div className="mt-4">
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={(p) => {
              setPage(p)
              fetchSources(p, status)
            }}
          />
        </div>
      )}

      <BatchDeleteBar
        selectedIds={selectedIds}
        onSuccess={() => fetchSources(page, status)}
        onClear={() => setSelectedIds([])}
      />
    </div>
  )
}
