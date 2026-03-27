/**
 * SubmissionTable.tsx — 投稿审核表格（Client Component）
 * CHG-128: 接入 shared table 基线能力（排序/列显隐/列宽/持久化）
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { Pagination } from '@/components/admin/Pagination'
import { ReviewModal, type ReviewTarget } from '@/components/admin/content/ReviewModal'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import { ColumnSettingsPanel } from '@/components/admin/shared/table/ColumnSettingsPanel'
import { AdminTableFrame } from '@/components/admin/shared/table/AdminTableFrame'
import { AdminTableState } from '@/components/admin/shared/feedback/AdminTableState'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import type { AdminTableState as SharedAdminTableState } from '@/components/admin/shared/table/useAdminTableState'

const PAGE_SIZE = 20

interface SubmissionRow {
  id: string
  video_id: string
  source_url: string
  source_name: string
  submitted_by: string | null
  submitted_by_username?: string
  video_title?: string
  created_at: string
}

type SubmissionColumnId = 'video' | 'source_url' | 'submitted_by' | 'created_at' | 'actions'

const SUBMISSION_COLUMNS: AdminColumnMeta[] = [
  { id: 'video', visible: true, width: 240, minWidth: 180, maxWidth: 420, resizable: true },
  { id: 'source_url', visible: true, width: 320, minWidth: 220, maxWidth: 520, resizable: true },
  { id: 'submitted_by', visible: true, width: 140, minWidth: 120, maxWidth: 260, resizable: true },
  { id: 'created_at', visible: true, width: 170, minWidth: 130, maxWidth: 240, resizable: true },
  { id: 'actions', visible: true, width: 120, minWidth: 110, maxWidth: 180, resizable: false },
]

const SUBMISSION_DEFAULT_TABLE_STATE: Omit<SharedAdminTableState, 'columns'> = {
  sort: { field: 'created_at', dir: 'desc' },
}

const SUBMISSION_COLUMN_LABELS: Record<SubmissionColumnId, string> = {
  video: '视频',
  source_url: '源 URL',
  submitted_by: '投稿人',
  created_at: '时间',
  actions: '操作',
}

const SUBMISSION_SORTABLE_MAP: Record<SubmissionColumnId, boolean> = {
  video: true,
  source_url: true,
  submitted_by: true,
  created_at: true,
  actions: false,
}

function toComparableValue(row: SubmissionRow, field: string): string | number {
  switch (field) {
    case 'video':
      return (row.video_title ?? row.video_id).toLowerCase()
    case 'source_url':
      return row.source_url.toLowerCase()
    case 'submitted_by':
      return (row.submitted_by_username ?? row.submitted_by ?? '').toLowerCase()
    case 'created_at':
      return new Date(row.created_at).getTime()
    default:
      return ''
  }
}

export function SubmissionTable() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)

  const columnsState = useAdminTableColumns({
    route: '/admin/content',
    tableId: 'submission-table',
    columns: SUBMISSION_COLUMNS,
    defaultState: SUBMISSION_DEFAULT_TABLE_STATE,
  })

  const sortState = useAdminTableSort({
    tableState: columnsState,
    columnsById: columnsState.columnsById,
    defaultSort: SUBMISSION_DEFAULT_TABLE_STATE.sort,
    sortable: SUBMISSION_SORTABLE_MAP,
  })

  const visibleColumnIds = useMemo(
    () =>
      columnsState.columns
        .filter((column) => column.visible)
        .map((column) => column.id as SubmissionColumnId),
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

  const fetchSubmissions = useCallback(async (pageVal: number) => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: SubmissionRow[]; total: number }>(
        `/admin/submissions?page=${pageVal}&limit=${PAGE_SIZE}`
      )
      setSubmissions(res.data)
      setTotal(res.total)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSubmissions(page) }, [fetchSubmissions, page])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function handleApprove(id: string) {
    await apiClient.post(`/admin/submissions/${id}/approve`)
    showToast('已通过，ES 索引已加入同步队列')
    fetchSubmissions(page)
  }

  async function handleReject(id: string, _type: ReviewTarget['type'], reason: string) {
    await apiClient.post(`/admin/submissions/${id}/reject`, { reason })
    fetchSubmissions(page)
  }

  function renderSortIndicator(columnId: SubmissionColumnId): string {
    if (!sortState.isSortedBy(columnId)) return ''
    return sortState.sort?.dir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div data-testid="submission-table" className="space-y-2">
      {toast && (
        <div
          className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-400"
          data-testid="submission-toast"
        >
          {toast}
        </div>
      )}

      <AdminToolbar className="gap-3" actions={null} />

      {showColumnsPanel && (
        <ColumnSettingsPanel
          data-testid="submission-columns-panel"
          columns={columnsState.columns.map((col) => ({
            id: col.id,
            label: SUBMISSION_COLUMN_LABELS[col.id as SubmissionColumnId] ?? col.id,
            visible: col.visible,
          }))}
          onToggle={(id) => columnsState.toggleColumnVisibility(id)}
          onReset={() => columnsState.resetColumnsMeta()}
        />
      )}

      <AdminTableFrame minWidth={900}>
        <thead className="bg-[var(--bg2)] text-[var(--muted)]">
          <tr>
            {visibleColumnIds.map((columnId) => {
              const meta = columnsState.columnsById[columnId]
              const sortable = sortState.isSortable(columnId)
              const isLastVisible = columnId === visibleColumnIds[visibleColumnIds.length - 1]
              return (
                <th key={columnId} className="relative px-4 py-3 text-left" style={{ width: `${meta.width}px` }}>
                  {sortable ? (
                    <button
                      type="button"
                      className="text-left text-sm hover:text-[var(--text)]"
                      onClick={() => sortState.toggleSort(columnId)}
                      data-testid={`submission-sort-${columnId}`}
                    >
                      {SUBMISSION_COLUMN_LABELS[columnId]}
                      {renderSortIndicator(columnId)}
                    </button>
                  ) : (
                    <span className="text-sm">{SUBMISSION_COLUMN_LABELS[columnId]}</span>
                  )}

                  {isLastVisible && (
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                      onClick={() => setShowColumnsPanel((prev) => !prev)}
                      data-testid="submission-columns-toggle"
                      aria-label="列设置"
                      title="列设置"
                    >
                      ⚙
                    </button>
                  )}

                  {meta.resizable && (
                    <button
                      type="button"
                      aria-label={`${SUBMISSION_COLUMN_LABELS[columnId]}列宽拖拽`}
                      data-testid={`submission-resize-${columnId}`}
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
            sortedSubmissions.map((row) => (
              <tr
                key={row.id}
                className="h-[68px] bg-[var(--bg)] hover:bg-[var(--bg2)]"
                style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                data-testid={`submission-row-${row.id}`}
              >
                {visibleColumnIds.includes('video') && (
                  <td className="px-4 py-3 align-middle text-[var(--text)]">
                    <span className="inline-block max-w-[240px] truncate" title={row.video_title ?? row.video_id}>
                      {row.video_title ?? row.video_id}
                    </span>
                  </td>
                )}

                {visibleColumnIds.includes('source_url') && (
                  <td className="px-4 py-3 align-middle">
                    <span className="inline-block max-w-[320px] truncate font-mono text-xs text-[var(--muted)]" title={row.source_url}>
                      {row.source_url}
                    </span>
                  </td>
                )}

                {visibleColumnIds.includes('submitted_by') && (
                  <td className="px-4 py-3 align-middle text-[var(--muted)]">
                    <span className="inline-block max-w-[140px] truncate" title={row.submitted_by_username ?? row.submitted_by ?? '—'}>
                      {row.submitted_by_username ?? row.submitted_by ?? '—'}
                    </span>
                  </td>
                )}

                {visibleColumnIds.includes('created_at') && (
                  <td className="px-4 py-3 align-middle text-xs text-[var(--muted)]">
                    {new Date(row.created_at).toLocaleDateString()}
                  </td>
                )}

                {visibleColumnIds.includes('actions') && (
                  <td className="px-4 py-3 align-middle">
                    <button
                      onClick={() => setReviewTarget({ id: row.id, type: 'submission', title: row.video_title })}
                      className="rounded px-2 py-0.5 text-xs bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/40"
                      data-testid={`submission-review-btn-${row.id}`}
                    >
                      审核
                    </button>
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </AdminTableFrame>

      {total > PAGE_SIZE && (
        <div className="mt-4">
          <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      )}

      <ReviewModal
        open={reviewTarget !== null}
        target={reviewTarget}
        onClose={() => setReviewTarget(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  )
}
