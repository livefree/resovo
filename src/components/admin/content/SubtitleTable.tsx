/**
 * SubtitleTable.tsx — 字幕审核表格（Client Component）
 * CHG-129: 接入 shared table 基线能力（排序/列显隐/列宽/持久化）
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { Pagination } from '@/components/admin/Pagination'
import { ReviewModal, type ReviewTarget } from '@/components/admin/content/ReviewModal'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import { AdminTableFrame } from '@/components/admin/shared/table/AdminTableFrame'
import { AdminTableState } from '@/components/admin/shared/feedback/AdminTableState'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import type { AdminTableState as SharedAdminTableState } from '@/components/admin/shared/table/useAdminTableState'

const PAGE_SIZE = 20

interface SubtitleRow {
  id: string
  video_id: string
  language: string
  format: string
  label: string | null
  file_url: string
  uploaded_by: string | null
  created_at: string
  video_title?: string
  uploader_username?: string
}

type SubtitleColumnId = 'video' | 'language' | 'format' | 'uploaded_by' | 'created_at' | 'actions'

const SUBTITLE_COLUMNS: AdminColumnMeta[] = [
  { id: 'video', visible: true, width: 240, minWidth: 180, maxWidth: 420, resizable: true },
  { id: 'language', visible: true, width: 130, minWidth: 110, maxWidth: 220, resizable: true },
  { id: 'format', visible: true, width: 110, minWidth: 90, maxWidth: 180, resizable: true },
  { id: 'uploaded_by', visible: true, width: 140, minWidth: 120, maxWidth: 260, resizable: true },
  { id: 'created_at', visible: true, width: 170, minWidth: 130, maxWidth: 240, resizable: true },
  { id: 'actions', visible: true, width: 120, minWidth: 110, maxWidth: 180, resizable: false },
]

const SUBTITLE_DEFAULT_TABLE_STATE: Omit<SharedAdminTableState, 'columns'> = {
  sort: { field: 'created_at', dir: 'desc' },
}

const SUBTITLE_COLUMN_LABELS: Record<SubtitleColumnId, string> = {
  video: '视频',
  language: '语言',
  format: '格式',
  uploaded_by: '上传人',
  created_at: '时间',
  actions: '操作',
}

const SUBTITLE_SORTABLE_MAP: Record<SubtitleColumnId, boolean> = {
  video: true,
  language: true,
  format: true,
  uploaded_by: true,
  created_at: true,
  actions: false,
}

function toComparableValue(row: SubtitleRow, field: string): string | number {
  switch (field) {
    case 'video':
      return (row.video_title ?? row.video_id).toLowerCase()
    case 'language':
      return row.language.toLowerCase()
    case 'format':
      return row.format.toLowerCase()
    case 'uploaded_by':
      return (row.uploader_username ?? row.uploaded_by ?? '').toLowerCase()
    case 'created_at':
      return new Date(row.created_at).getTime()
    default:
      return ''
  }
}

export function SubtitleTable() {
  const [subtitles, setSubtitles] = useState<SubtitleRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)

  const columnsState = useAdminTableColumns({
    route: '/admin/content',
    tableId: 'subtitle-table',
    columns: SUBTITLE_COLUMNS,
    defaultState: SUBTITLE_DEFAULT_TABLE_STATE,
  })

  const sortState = useAdminTableSort({
    tableState: columnsState,
    columnsById: columnsState.columnsById,
    defaultSort: SUBTITLE_DEFAULT_TABLE_STATE.sort,
    sortable: SUBTITLE_SORTABLE_MAP,
  })

  const visibleColumnIds = useMemo(
    () =>
      columnsState.columns
        .filter((column) => column.visible)
        .map((column) => column.id as SubtitleColumnId),
    [columnsState.columns],
  )

  const sortedSubtitles = useMemo(() => {
    if (!sortState.sort) return subtitles
    const next = [...subtitles]
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
  }, [subtitles, sortState.sort])

  const fetchSubtitles = useCallback(async (pageVal: number) => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: SubtitleRow[]; total: number }>(
        `/admin/subtitles?page=${pageVal}&limit=${PAGE_SIZE}`
      )
      setSubtitles(res.data)
      setTotal(res.total)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSubtitles(page) }, [fetchSubtitles, page])

  async function handleApprove(id: string) {
    await apiClient.post(`/admin/subtitles/${id}/approve`)
    fetchSubtitles(page)
  }

  async function handleReject(id: string, _type: ReviewTarget['type'], reason: string) {
    await apiClient.post(`/admin/subtitles/${id}/reject`, { reason })
    fetchSubtitles(page)
  }

  function renderSortIndicator(columnId: SubtitleColumnId): string {
    if (!sortState.isSortedBy(columnId)) return ''
    return sortState.sort?.dir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div data-testid="subtitle-table" className="space-y-2">
      <AdminToolbar
        className="gap-3"
        actions={(
          <button
            type="button"
            className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            onClick={() => setShowColumnsPanel((prev) => !prev)}
            data-testid="subtitle-columns-toggle"
          >
            列设置
          </button>
        )}
      />

      {showColumnsPanel && (
        <div className="rounded border border-[var(--border)] bg-[var(--bg2)] p-2" data-testid="subtitle-columns-panel">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted)]">显示列</span>
            <button
              type="button"
              className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => columnsState.resetColumnsMeta()}
              data-testid="subtitle-columns-reset"
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
                  data-testid={`subtitle-column-toggle-${column.id}`}
                />
                {SUBTITLE_COLUMN_LABELS[column.id as SubtitleColumnId]}
              </label>
            ))}
          </div>
        </div>
      )}

      <AdminTableFrame minWidth={900}>
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
                      data-testid={`subtitle-sort-${columnId}`}
                    >
                      {SUBTITLE_COLUMN_LABELS[columnId]}
                      {renderSortIndicator(columnId)}
                    </button>
                  ) : (
                    <span className="text-sm">{SUBTITLE_COLUMN_LABELS[columnId]}</span>
                  )}

                  {meta.resizable && (
                    <button
                      type="button"
                      aria-label={`${SUBTITLE_COLUMN_LABELS[columnId]}列宽拖拽`}
                      data-testid={`subtitle-resize-${columnId}`}
                      onMouseDown={(event) => columnsState.startResize(columnId, event.clientX)}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
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
            isEmpty={!loading && sortedSubtitles.length === 0}
            colSpan={visibleColumnIds.length}
            emptyText="暂无待审字幕"
          />
          {!loading &&
            sortedSubtitles.map((row) => (
              <tr
                key={row.id}
                className="h-[68px] bg-[var(--bg)] hover:bg-[var(--bg2)]"
                style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                data-testid={`subtitle-row-${row.id}`}
              >
                {visibleColumnIds.includes('video') && (
                  <td className="px-4 py-3 align-middle text-[var(--text)]">
                    <span className="inline-block max-w-[240px] truncate" title={row.video_title ?? row.video_id}>
                      {row.video_title ?? row.video_id}
                    </span>
                  </td>
                )}

                {visibleColumnIds.includes('language') && (
                  <td className="px-4 py-3 align-middle text-[var(--muted)]">{row.language}</td>
                )}

                {visibleColumnIds.includes('format') && (
                  <td className="px-4 py-3 align-middle text-[var(--muted)] uppercase">{row.format}</td>
                )}

                {visibleColumnIds.includes('uploaded_by') && (
                  <td className="px-4 py-3 align-middle text-[var(--muted)]">
                    <span className="inline-block max-w-[140px] truncate" title={row.uploader_username ?? row.uploaded_by ?? '—'}>
                      {row.uploader_username ?? row.uploaded_by ?? '—'}
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
                      onClick={() => setReviewTarget({ id: row.id, type: 'subtitle', title: row.video_title })}
                      className="rounded px-2 py-0.5 text-xs bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/40"
                      data-testid={`subtitle-review-btn-${row.id}`}
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
