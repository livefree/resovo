/**
 * AdminSubtitleList.tsx — 字幕审核队列
 * CHG-129: 接入 shared table 基线能力（排序/列显隐/列宽/持久化）
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

interface SubtitleRow {
  id: string
  video_id: string
  video_title: string | null
  language: string
  label: string
  format: string
  file_url: string
  is_verified: boolean
  created_at: string
}

type AdminSubtitleColumnId = 'video' | 'language' | 'format' | 'file_url' | 'created_at' | 'actions'

const ADMIN_SUBTITLE_COLUMNS: AdminColumnMeta[] = [
  { id: 'video', visible: true, width: 230, minWidth: 180, maxWidth: 420, resizable: true },
  { id: 'language', visible: true, width: 150, minWidth: 120, maxWidth: 260, resizable: true },
  { id: 'format', visible: true, width: 110, minWidth: 90, maxWidth: 180, resizable: true },
  { id: 'file_url', visible: true, width: 140, minWidth: 120, maxWidth: 240, resizable: true },
  { id: 'created_at', visible: true, width: 190, minWidth: 150, maxWidth: 280, resizable: true },
  { id: 'actions', visible: true, width: 170, minWidth: 150, maxWidth: 220, resizable: false },
]

const ADMIN_SUBTITLE_DEFAULT_TABLE_STATE: Omit<SharedAdminTableState, 'columns'> = {
  sort: { field: 'created_at', dir: 'desc' },
}

const ADMIN_SUBTITLE_COLUMN_LABELS: Record<AdminSubtitleColumnId, string> = {
  video: '视频',
  language: '语言',
  format: '格式',
  file_url: '文件',
  created_at: '上传时间',
  actions: '操作',
}

const ADMIN_SUBTITLE_SORTABLE_MAP: Record<AdminSubtitleColumnId, boolean> = {
  video: true,
  language: true,
  format: true,
  file_url: false,
  created_at: true,
  actions: false,
}

function toComparableValue(row: SubtitleRow, field: string): string | number {
  switch (field) {
    case 'video':
      return (row.video_title ?? row.video_id).toLowerCase()
    case 'language':
      return `${row.label} (${row.language})`.toLowerCase()
    case 'format':
      return row.format.toLowerCase()
    case 'created_at':
      return new Date(row.created_at).getTime()
    default:
      return ''
  }
}

export function AdminSubtitleList() {
  const [subtitles, setSubtitles] = useState<SubtitleRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)

  const limit = 20

  const columnsState = useAdminTableColumns({
    route: '/admin/subtitles',
    tableId: 'admin-subtitle-list',
    columns: ADMIN_SUBTITLE_COLUMNS,
    defaultState: ADMIN_SUBTITLE_DEFAULT_TABLE_STATE,
  })

  const sortState = useAdminTableSort({
    tableState: columnsState,
    columnsById: columnsState.columnsById,
    defaultSort: ADMIN_SUBTITLE_DEFAULT_TABLE_STATE.sort,
    sortable: ADMIN_SUBTITLE_SORTABLE_MAP,
  })

  const visibleColumnIds = useMemo(
    () =>
      columnsState.columns
        .filter((column) => column.visible)
        .map((column) => column.id as AdminSubtitleColumnId),
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

  const fetchSubtitles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      const res = await apiClient.get<{ data: SubtitleRow[]; total: number }>(
        `/admin/subtitles?${params}`
      )
      setSubtitles(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchSubtitles() }, [fetchSubtitles])

  async function handleApprove(id: string) {
    try {
      await apiClient.post(`/admin/subtitles/${id}/approve`)
      fetchSubtitles()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  async function handleReject(id: string) {
    if (!confirm('确认拒绝并删除此字幕？')) return
    try {
      await apiClient.post(`/admin/subtitles/${id}/reject`)
      fetchSubtitles()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  const totalPages = Math.ceil(total / limit)

  function renderSortIndicator(columnId: AdminSubtitleColumnId): string {
    if (!sortState.isSortedBy(columnId)) return ''
    return sortState.sort?.dir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div data-testid="admin-subtitle-list" className="space-y-2">
      {error && (
        <p className="mb-4 rounded-md bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      <AdminToolbar
        className="gap-3"
        actions={null}
      />

      {showColumnsPanel && (
        <div className="rounded border border-[var(--border)] bg-[var(--bg2)] p-2" data-testid="admin-subtitle-columns-panel">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted)]">显示列</span>
            <button
              type="button"
              className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => columnsState.resetColumnsMeta()}
              data-testid="admin-subtitle-columns-reset"
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
                  data-testid={`admin-subtitle-column-toggle-${column.id}`}
                />
                {ADMIN_SUBTITLE_COLUMN_LABELS[column.id as AdminSubtitleColumnId]}
              </label>
            ))}
          </div>
        </div>
      )}

      <AdminTableFrame minWidth={960}>
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
                      data-testid={`admin-subtitle-sort-${columnId}`}
                    >
                      {ADMIN_SUBTITLE_COLUMN_LABELS[columnId]}
                      {renderSortIndicator(columnId)}
                    </button>
                  ) : (
                    <span className="text-sm">{ADMIN_SUBTITLE_COLUMN_LABELS[columnId]}</span>
                  )}

                  {isLastVisible && (
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                      onClick={() => setShowColumnsPanel((prev) => !prev)}
                      data-testid="admin-subtitle-columns-toggle"
                      aria-label="列设置"
                      title="列设置"
                    >
                      ⚙
                    </button>
                  )}

                  {meta.resizable && (
                    <button
                      type="button"
                      aria-label={`${ADMIN_SUBTITLE_COLUMN_LABELS[columnId]}列宽拖拽`}
                      data-testid={`admin-subtitle-resize-${columnId}`}
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
            isEmpty={!loading && sortedSubtitles.length === 0}
            colSpan={visibleColumnIds.length}
            emptyText="暂无待审字幕"
          />
          {!loading &&
            sortedSubtitles.map((sub) => (
              <tr
                key={sub.id}
                className="h-[68px] bg-[var(--bg)] hover:bg-[var(--bg2)]"
                style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                data-testid={`admin-subtitle-row-${sub.id}`}
              >
                {visibleColumnIds.includes('video') && (
                  <td className="px-4 py-3 align-middle text-[var(--text)]">
                    <span className="inline-block max-w-[230px] truncate" title={sub.video_title ?? sub.video_id}>
                      {sub.video_title ?? sub.video_id}
                    </span>
                  </td>
                )}

                {visibleColumnIds.includes('language') && (
                  <td className="px-4 py-3 align-middle text-[var(--muted)]">
                    <span className="inline-block max-w-[150px] truncate" title={`${sub.label} (${sub.language})`}>
                      {sub.label} ({sub.language})
                    </span>
                  </td>
                )}

                {visibleColumnIds.includes('format') && (
                  <td className="px-4 py-3 align-middle text-[var(--muted)] uppercase">{sub.format}</td>
                )}

                {visibleColumnIds.includes('file_url') && (
                  <td className="px-4 py-3 align-middle">
                    <a
                      href={sub.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      查看文件
                    </a>
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
                        data-testid={`admin-subtitle-approve-${sub.id}`}
                      >
                        通过
                      </button>
                      <button
                        onClick={() => handleReject(sub.id)}
                        className="rounded px-2 py-0.5 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60"
                        data-testid={`admin-subtitle-reject-${sub.id}`}
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
