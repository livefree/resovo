/**
 * AdminSubmissionList.tsx — 投稿审核队列
 * CHG-128: 接入 shared table 基线能力（排序/列显隐/列宽/持久化）
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import { AdminTableFrame } from '@/components/admin/shared/table/AdminTableFrame'
import { AdminTableState } from '@/components/admin/shared/feedback/AdminTableState'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import type { AdminTableState as SharedAdminTableState } from '@/components/admin/shared/table/useAdminTableState'

interface SubmissionRow {
  id: string
  video_id: string
  video_title: string | null
  source_url: string
  source_name: string
  type: string
  submitted_by: string | null
  submitted_by_username: string | null
  created_at: string
}

type AdminSubmissionColumnId = 'video' | 'source_name' | 'type' | 'submitted_by' | 'created_at' | 'actions'

const ADMIN_SUBMISSION_COLUMNS: AdminColumnMeta[] = [
  { id: 'video', visible: true, width: 220, minWidth: 180, maxWidth: 400, resizable: true },
  { id: 'source_name', visible: true, width: 160, minWidth: 130, maxWidth: 280, resizable: true },
  { id: 'type', visible: true, width: 110, minWidth: 90, maxWidth: 180, resizable: true },
  { id: 'submitted_by', visible: true, width: 150, minWidth: 120, maxWidth: 280, resizable: true },
  { id: 'created_at', visible: true, width: 190, minWidth: 150, maxWidth: 280, resizable: true },
  { id: 'actions', visible: true, width: 170, minWidth: 150, maxWidth: 220, resizable: false },
]

const ADMIN_SUBMISSION_DEFAULT_TABLE_STATE: Omit<SharedAdminTableState, 'columns'> = {
  sort: { field: 'created_at', dir: 'desc' },
}

const ADMIN_SUBMISSION_COLUMN_LABELS: Record<AdminSubmissionColumnId, string> = {
  video: '视频',
  source_name: '来源名',
  type: '类型',
  submitted_by: '投稿人',
  created_at: '投稿时间',
  actions: '操作',
}

const ADMIN_SUBMISSION_SORTABLE_MAP: Record<AdminSubmissionColumnId, boolean> = {
  video: true,
  source_name: true,
  type: true,
  submitted_by: true,
  created_at: true,
  actions: false,
}

function toComparableValue(row: SubmissionRow, field: string): string | number {
  switch (field) {
    case 'video':
      return (row.video_title ?? row.video_id).toLowerCase()
    case 'source_name':
      return row.source_name.toLowerCase()
    case 'type':
      return row.type.toLowerCase()
    case 'submitted_by':
      return (row.submitted_by_username ?? row.submitted_by ?? '').toLowerCase()
    case 'created_at':
      return new Date(row.created_at).getTime()
    default:
      return ''
  }
}

export function AdminSubmissionList() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)

  const limit = 20

  const columnsState = useAdminTableColumns({
    route: '/admin/submissions',
    tableId: 'admin-submission-list',
    columns: ADMIN_SUBMISSION_COLUMNS,
    defaultState: ADMIN_SUBMISSION_DEFAULT_TABLE_STATE,
  })

  const sortState = useAdminTableSort({
    tableState: columnsState,
    columnsById: columnsState.columnsById,
    defaultSort: ADMIN_SUBMISSION_DEFAULT_TABLE_STATE.sort,
    sortable: ADMIN_SUBMISSION_SORTABLE_MAP,
  })

  const visibleColumnIds = useMemo(
    () =>
      columnsState.columns
        .filter((column) => column.visible)
        .map((column) => column.id as AdminSubmissionColumnId),
    [columnsState.columns],
  )

  const sortedSubmissions = useMemo(() => {
    if (!sortState.sort) return submissions
    const next = [...submissions]
    next.sort((a, b) => {
      const va = toComparableValue(a, sortState.sort?.field ?? '')
      const vb = toComparableValue(b, sortState.sort?.field ?? '')
      if (va === vb) return 0
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortState.sort?.dir === 'asc' ? va - vb : vb - va
      }
      const sa = String(va)
      const sb = String(vb)
      return sortState.sort?.dir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa)
    })
    return next
  }, [submissions, sortState.sort])

  const fetchSubmissions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      const res = await apiClient.get<{ data: SubmissionRow[]; total: number }>(
        `/admin/submissions?${params}`
      )
      setSubmissions(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchSubmissions() }, [fetchSubmissions])

  async function handleApprove(id: string) {
    try {
      await apiClient.post(`/admin/submissions/${id}/approve`)
      fetchSubmissions()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  async function handleReject(id: string) {
    if (!confirm('确认拒绝此投稿？')) return
    try {
      await apiClient.post(`/admin/submissions/${id}/reject`)
      fetchSubmissions()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  const totalPages = Math.ceil(total / limit)

  function renderSortIndicator(columnId: AdminSubmissionColumnId): string {
    if (!sortState.isSortedBy(columnId)) return ''
    return sortState.sort?.dir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div data-testid="admin-submission-list" className="space-y-2">
      {error && (
        <p className="mb-4 rounded-md bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      <AdminToolbar
        className="gap-3"
        actions={(
          <button
            type="button"
            className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            onClick={() => setShowColumnsPanel((prev) => !prev)}
            data-testid="admin-submission-columns-toggle"
          >
            列设置
          </button>
        )}
      />

      {showColumnsPanel && (
        <div className="rounded border border-[var(--border)] bg-[var(--bg2)] p-2" data-testid="admin-submission-columns-panel">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted)]">显示列</span>
            <button
              type="button"
              className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => columnsState.resetColumnsMeta()}
              data-testid="admin-submission-columns-reset"
            >
              重置
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {columnsState.columns.map((column) => (
              <label key={column.id} className="flex items-center gap-2 text-xs text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => columnsState.toggleColumnVisibility(column.id)}
                  className="accent-[var(--accent)]"
                  data-testid={`admin-submission-column-toggle-${column.id}`}
                />
                {ADMIN_SUBMISSION_COLUMN_LABELS[column.id as AdminSubmissionColumnId]}
              </label>
            ))}
          </div>
        </div>
      )}

      <AdminTableFrame minWidth={940}>
        <thead className="bg-[var(--bg2)] text-[var(--muted)]">
          <tr>
            {visibleColumnIds.map((columnId) => {
              const meta = columnsState.columnsById[columnId]
              const sortable = sortState.isSortable(columnId)
              return (
                <th key={columnId} className="relative px-4 py-3 text-left" style={{ width: `${meta.width}px` }}>
                  {sortable ? (
                    <button
                      type="button"
                      className="text-left text-sm hover:text-[var(--text)]"
                      onClick={() => sortState.toggleSort(columnId)}
                      data-testid={`admin-submission-sort-${columnId}`}
                    >
                      {ADMIN_SUBMISSION_COLUMN_LABELS[columnId]}
                      {renderSortIndicator(columnId)}
                    </button>
                  ) : (
                    <span className="text-sm">{ADMIN_SUBMISSION_COLUMN_LABELS[columnId]}</span>
                  )}

                  {meta.resizable && (
                    <button
                      type="button"
                      aria-label={`${ADMIN_SUBMISSION_COLUMN_LABELS[columnId]}列宽拖拽`}
                      data-testid={`admin-submission-resize-${columnId}`}
                      onMouseDown={(event) => columnsState.startResize(columnId, event.clientX)}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize before:absolute before:right-0 before:top-0 before:h-full before:w-px before:bg-[var(--border)] hover:bg-[var(--bg3)]/40"
                    />
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          <AdminTableState
            isLoading={loading}
            isEmpty={!loading && sortedSubmissions.length === 0}
            colSpan={visibleColumnIds.length}
            emptyText="暂无待审投稿"
          />
          {!loading &&
            sortedSubmissions.map((sub) => (
              <tr
                key={sub.id}
                className="h-[68px] bg-[var(--bg)] hover:bg-[var(--bg2)]"
                style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                data-testid={`admin-submission-row-${sub.id}`}
              >
                {visibleColumnIds.includes('video') && (
                  <td className="px-4 py-3 align-middle text-[var(--text)]">
                    <span className="inline-block max-w-[220px] truncate" title={sub.video_title ?? sub.video_id}>
                      {sub.video_title ?? sub.video_id}
                    </span>
                  </td>
                )}

                {visibleColumnIds.includes('source_name') && (
                  <td className="px-4 py-3 align-middle text-[var(--muted)]">
                    <span className="inline-block max-w-[160px] truncate" title={sub.source_name}>
                      {sub.source_name}
                    </span>
                  </td>
                )}

                {visibleColumnIds.includes('type') && (
                  <td className="px-4 py-3 align-middle text-[var(--muted)]">{sub.type}</td>
                )}

                {visibleColumnIds.includes('submitted_by') && (
                  <td className="px-4 py-3 align-middle text-[var(--muted)]">
                    <span className="inline-block max-w-[150px] truncate" title={sub.submitted_by_username ?? sub.submitted_by ?? '—'}>
                      {sub.submitted_by_username ?? sub.submitted_by ?? '—'}
                    </span>
                  </td>
                )}

                {visibleColumnIds.includes('created_at') && (
                  <td className="px-4 py-3 align-middle text-xs text-[var(--muted)]">
                    {new Date(sub.created_at).toLocaleString()}
                  </td>
                )}

                {visibleColumnIds.includes('actions') && (
                  <td className="px-4 py-3 align-middle">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(sub.id)}
                        className="rounded px-2 py-0.5 text-xs bg-green-900/30 text-green-400 hover:bg-green-900/60"
                        data-testid={`admin-submission-approve-${sub.id}`}
                      >
                        通过
                      </button>
                      <button
                        onClick={() => handleReject(sub.id)}
                        className="rounded px-2 py-0.5 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60"
                        data-testid={`admin-submission-reject-${sub.id}`}
                      >
                        拒绝
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </AdminTableFrame>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
          <span>共 {total} 条</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded px-3 py-1 hover:bg-[var(--bg2)] disabled:opacity-40">上一页</button>
            <span className="px-2 py-1">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded px-3 py-1 hover:bg-[var(--bg2)] disabled:opacity-40">下一页</button>
          </div>
        </div>
      )}
    </div>
  )
}
