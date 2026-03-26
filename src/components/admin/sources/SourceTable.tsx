/**
 * SourceTable.tsx — 播放源管理表格（Client Component）
 * CHG-126: 接入 shared table 基线能力（排序/列显隐/列宽/持久化）
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Pagination } from '@/components/admin/Pagination'
import { SourceVerifyButton } from '@/components/admin/sources/SourceVerifyButton'
import { SourceUrlReplaceModal } from '@/components/admin/sources/SourceUrlReplaceModal'
import { BatchDeleteBar } from '@/components/admin/sources/BatchDeleteBar'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { AdminTableState } from '@/components/admin/shared/feedback/AdminTableState'
import { AdminTableFrame } from '@/components/admin/shared/table/AdminTableFrame'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import type { AdminTableState as SharedAdminTableState } from '@/components/admin/shared/table/useAdminTableState'

const PAGE_SIZE = 20
const URL_MAX_LEN = 60
type SourceTab = 'inactive' | 'submissions'

type SourceColumnId = 'video_title' | 'coordinate' | 'source_url' | 'status' | 'last_checked' | 'actions'

interface SourceRow {
  id: string
  video_id: string
  source_url: string
  source_name: string
  quality: string | null
  type: string
  is_active: boolean
  season_number?: number
  episode_number?: number
  last_checked: string | null
  created_at: string
  video_title?: string
}

interface SubmissionRow {
  id: string
  video_id: string
  source_url: string
  source_name: string
  is_active: boolean
  submitted_by_username?: string | null
  created_at: string
  video_title?: string
}

const SOURCE_COLUMNS: AdminColumnMeta[] = [
  { id: 'video_title', visible: true, width: 220, minWidth: 160, maxWidth: 400, resizable: true },
  { id: 'coordinate', visible: true, width: 110, minWidth: 90, maxWidth: 160, resizable: true },
  { id: 'source_url', visible: true, width: 340, minWidth: 220, maxWidth: 560, resizable: true },
  { id: 'status', visible: true, width: 120, minWidth: 100, maxWidth: 180, resizable: true },
  { id: 'last_checked', visible: true, width: 170, minWidth: 130, maxWidth: 280, resizable: true },
  { id: 'actions', visible: true, width: 180, minWidth: 150, maxWidth: 260, resizable: false },
]

const SOURCE_DEFAULT_TABLE_STATE: Omit<SharedAdminTableState, 'columns'> = {
  sort: { field: 'last_checked', dir: 'desc' },
}

const SOURCE_COLUMN_LABELS: Record<SourceColumnId, string> = {
  video_title: '视频标题',
  coordinate: 'S/E',
  source_url: '源 URL',
  status: '状态',
  last_checked: '最后验证',
  actions: '操作',
}

const SOURCE_SORTABLE_MAP: Record<SourceColumnId, boolean> = {
  video_title: true,
  coordinate: true,
  source_url: true,
  status: true,
  last_checked: true,
  actions: false,
}

function truncateUrl(url: string): string {
  return url.length > URL_MAX_LEN ? `${url.slice(0, URL_MAX_LEN)}…` : url
}

function toComparableValue(row: SourceRow, field: string): string | number {
  switch (field) {
    case 'video_title':
      return (row.video_title ?? '').toLowerCase()
    case 'source_url':
      return row.source_url.toLowerCase()
    case 'coordinate':
      return `${row.season_number ?? 1}-${row.episode_number ?? 1}`
    case 'status':
      return row.is_active ? 1 : 0
    case 'last_checked':
      return row.last_checked ? new Date(row.last_checked).getTime() : 0
    default:
      return ''
  }
}

export function SourceTable() {
  const [activeTab, setActiveTab] = useState<SourceTab>('inactive')
  const [sources, setSources] = useState<SourceRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [submissionTotal, setSubmissionTotal] = useState(0)
  const [submissionPage, setSubmissionPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submissionLoading, setSubmissionLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<SourceRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)
  const [replaceTarget, setReplaceTarget] = useState<SourceRow | null>(null)

  const columnsState = useAdminTableColumns({
    route: '/admin/sources',
    tableId: 'source-table',
    columns: SOURCE_COLUMNS,
    defaultState: SOURCE_DEFAULT_TABLE_STATE,
  })

  const sortState = useAdminTableSort({
    tableState: columnsState,
    columnsById: columnsState.columnsById,
    defaultSort: SOURCE_DEFAULT_TABLE_STATE.sort,
    sortable: SOURCE_SORTABLE_MAP,
  })

  const visibleColumnIds = useMemo(
    () => columnsState.columns.filter((column) => column.visible).map((column) => column.id as SourceColumnId),
    [columnsState.columns],
  )

  const sortedSources = useMemo(() => {
    if (!sortState.sort) return sources
    const next = [...sources]
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
  }, [sources, sortState.sort])

  const fetchSources = useCallback(
    async (pageVal: number) => {
      setLoading(true)
      setSelectedIds([])
      try {
        const params = new URLSearchParams({
          page: String(pageVal),
          limit: String(PAGE_SIZE),
          status: 'inactive',
        })
        const res = await apiClient.get<{ data: SourceRow[]; total: number }>(`/admin/sources?${params}`)
        setSources(res.data)
        setTotal(res.total)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const fetchSubmissions = useCallback(
    async (pageVal: number) => {
      setSubmissionLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(pageVal),
          limit: String(PAGE_SIZE),
        })
        const res = await apiClient.get<{ data: SubmissionRow[]; total: number }>(`/admin/submissions?${params}`)
        setSubmissions(res.data)
        setSubmissionTotal(res.total)
      } catch {
        // silent
      } finally {
        setSubmissionLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (activeTab === 'inactive') {
      void fetchSources(page)
      return
    }

    void fetchSubmissions(submissionPage)
  }, [activeTab, fetchSources, fetchSubmissions, page, submissionPage])

  function handleCheck(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))
  }

  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? sortedSources.map((s) => s.id) : [])
  }

  const allSelected = sortedSources.length > 0 && selectedIds.length === sortedSources.length

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await apiClient.delete(`/admin/sources/${deleteTarget.id}`)
      void fetchSources(page)
      setDeleteTarget(null)
    } catch {
      // silent
    } finally {
      setDeleteLoading(false)
    }
  }

  function renderSortIndicator(columnId: SourceColumnId): string {
    if (!sortState.isSortedBy(columnId)) return ''
    return sortState.sort?.dir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div data-testid="source-table" className="space-y-2">
      <AdminToolbar
        className="gap-3"
        actions={(
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('inactive')}
                className={`rounded px-3 py-1 text-sm ${activeTab === 'inactive' ? 'bg-[var(--accent)] text-black' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                data-testid="source-tab-inactive"
              >
                失效源
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('submissions')}
                className={`rounded px-3 py-1 text-sm ${activeTab === 'submissions' ? 'bg-[var(--accent)] text-black' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
                data-testid="source-tab-submissions"
              >
                用户纠错
              </button>
            </div>
          </div>
        )}
      />

      {activeTab === 'inactive' && showColumnsPanel && (
        <div className="rounded border border-[var(--border)] bg-[var(--bg2)] p-2" data-testid="source-columns-panel">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted)]">显示列</span>
            <button
              type="button"
              className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => columnsState.resetColumnsMeta()}
              data-testid="source-columns-reset"
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
                  data-testid={`source-column-toggle-${column.id}`}
                />
                {SOURCE_COLUMN_LABELS[column.id as SourceColumnId]}
              </label>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'inactive' ? (
      <AdminTableFrame minWidth={960}>
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
                      data-testid={`source-sort-${columnId}`}
                    >
                      {SOURCE_COLUMN_LABELS[columnId]}
                      {renderSortIndicator(columnId)}
                    </button>
                  ) : (
                    <span className="text-sm">{SOURCE_COLUMN_LABELS[columnId]}</span>
                  )}

                  {isLastVisible && (
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                      onClick={() => setShowColumnsPanel((prev) => !prev)}
                      data-testid="source-columns-toggle"
                      aria-label="列设置"
                      title="列设置"
                    >
                      ⚙
                    </button>
                  )}

                  {meta.resizable && (
                    <button
                      type="button"
                      aria-label={`${SOURCE_COLUMN_LABELS[columnId]}列宽拖拽`}
                      data-testid={`source-resize-${columnId}`}
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
            isEmpty={!loading && sortedSources.length === 0}
            colSpan={visibleColumnIds.length + 1}
            emptyText="暂无数据"
          />

          {!loading &&
            sortedSources.map((row) => (
              <tr
                key={row.id}
                className="h-[68px] bg-[var(--bg)] hover:bg-[var(--bg2)]"
                style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                data-testid={`source-row-${row.id}`}
              >
                <td className="px-4 py-3 align-middle">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={(e) => handleCheck(row.id, e.target.checked)}
                    className="accent-[var(--accent)]"
                    data-testid={`source-checkbox-${row.id}`}
                  />
                </td>

                {visibleColumnIds.includes('video_title') && (
                  <td className="px-4 py-3 align-middle text-[var(--text)]" title={row.video_title ?? '—'}>
                    <span className="inline-block max-w-[220px] truncate">{row.video_title ?? '—'}</span>
                  </td>
                )}

                {visibleColumnIds.includes('coordinate') && (
                  <td className="px-4 py-3 align-middle text-xs text-[var(--muted)]">
                    S{row.season_number ?? 1} / E{row.episode_number ?? 1}
                  </td>
                )}

                {visibleColumnIds.includes('source_url') && (
                  <td className="px-4 py-3 align-middle">
                    <span
                      title={row.source_url}
                      className="inline-block max-w-[360px] truncate font-mono text-xs text-[var(--muted)]"
                      data-testid={`source-url-${row.id}`}
                    >
                      {truncateUrl(row.source_url)}
                    </span>
                  </td>
                )}

                {visibleColumnIds.includes('status') && (
                  <td className="px-4 py-3 align-middle">
                    <StatusBadge status={row.is_active ? 'active' : 'inactive'} />
                  </td>
                )}

                {visibleColumnIds.includes('last_checked') && (
                  <td className="px-4 py-3 align-middle text-xs text-[var(--muted)]">
                    {row.last_checked ? new Date(row.last_checked).toLocaleString() : '—'}
                  </td>
                )}

                {visibleColumnIds.includes('actions') && (
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap items-center gap-1">
                      <SourceVerifyButton sourceId={row.id} onVerified={() => void fetchSources(page)} />
                      <button
                        type="button"
                        onClick={() => setReplaceTarget(row)}
                        className="rounded bg-[var(--bg3)] px-2 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                        data-testid={`source-replace-btn-${row.id}`}
                      >
                        替换URL
                      </button>
                      <button
                        onClick={() => setDeleteTarget(row)}
                        className="rounded bg-red-900/30 px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/60"
                        data-testid={`source-delete-btn-${row.id}`}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </AdminTableFrame>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg2)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left">视频标题</th>
                <th className="px-4 py-3 text-left">来源 URL</th>
                <th className="px-4 py-3 text-left">提交者</th>
                <th className="px-4 py-3 text-left">提交时间</th>
              </tr>
            </thead>
            <tbody>
              {submissionLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--muted)]">加载中…</td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--muted)]">暂无用户纠错数据</td>
                </tr>
              ) : (
                submissions.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--subtle)] bg-[var(--bg)] hover:bg-[var(--bg2)]"
                    data-testid={`submission-row-${row.id}`}
                  >
                    <td className="px-4 py-3 text-[var(--text)]">{row.video_title ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">
                      <span className="inline-block max-w-[360px] truncate" title={row.source_url}>{truncateUrl(row.source_url)}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.submitted_by_username ?? '匿名'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">{new Date(row.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'inactive' && total > PAGE_SIZE && (
        <div className="mt-4">
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={(p) => {
              setPage(p)
              void fetchSources(p)
            }}
          />
        </div>
      )}

      {activeTab === 'submissions' && submissionTotal > PAGE_SIZE && (
        <div className="mt-4">
          <Pagination
            page={submissionPage}
            total={submissionTotal}
            pageSize={PAGE_SIZE}
            onChange={(p) => {
              setSubmissionPage(p)
              void fetchSubmissions(p)
            }}
          />
        </div>
      )}

      {activeTab === 'inactive' ? (
      <BatchDeleteBar
        selectedIds={selectedIds}
        onSuccess={() => void fetchSources(page)}
        onClear={() => setSelectedIds([])}
      />
      ) : null}

      {activeTab === 'inactive' ? (
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleteLoading) setDeleteTarget(null)
        }}
        title="确认删除播放源"
        description={
          deleteTarget
            ? `确定要删除播放源「${deleteTarget.source_name || deleteTarget.source_url}」吗？此操作不可撤销。`
            : '确定要删除该播放源吗？此操作不可撤销。'
        }
        confirmText="删除"
        onConfirm={handleDelete}
        loading={deleteLoading}
        danger
      />
      ) : null}

      <SourceUrlReplaceModal
        sourceId={replaceTarget?.id ?? null}
        currentUrl={replaceTarget?.source_url ?? ''}
        open={replaceTarget !== null}
        onClose={() => setReplaceTarget(null)}
        onSuccess={() => void fetchSources(page)}
      />
    </div>
  )
}
