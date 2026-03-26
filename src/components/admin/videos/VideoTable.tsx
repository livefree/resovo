/**
 * VideoTable.tsx — 视频管理表格（Client Component）
 * CHG-125: 接入 shared table 基线能力（排序/列显隐/列宽/持久化）
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Pagination } from '@/components/admin/Pagination'
import { BatchPublishBar } from '@/components/admin/videos/BatchPublishBar'
import { AdminTableFrame } from '@/components/admin/shared/table/AdminTableFrame'
import { AdminTableState } from '@/components/admin/shared/feedback/AdminTableState'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import type { AdminTableState as SharedAdminTableState } from '@/components/admin/shared/table/useAdminTableState'
import type { BadgeStatus } from '@/components/admin/StatusBadge'

const PAGE_SIZE = 20

interface VideoAdminRow {
  id: string
  short_id: string
  title: string
  title_en: string | null
  cover_url: string | null
  type: string
  year: number | null
  is_published: boolean
  source_count: string
  created_at: string
}

type VideoColumnId = 'cover' | 'title' | 'type' | 'year' | 'status' | 'source_count' | 'actions'

const VIDEO_COLUMNS: AdminColumnMeta[] = [
  { id: 'cover', visible: true, width: 88, minWidth: 76, maxWidth: 120, resizable: true },
  { id: 'title', visible: true, width: 320, minWidth: 220, maxWidth: 520, resizable: true },
  { id: 'type', visible: true, width: 120, minWidth: 96, maxWidth: 180, resizable: true },
  { id: 'year', visible: true, width: 110, minWidth: 92, maxWidth: 160, resizable: true },
  { id: 'status', visible: true, width: 120, minWidth: 100, maxWidth: 180, resizable: true },
  { id: 'source_count', visible: true, width: 110, minWidth: 100, maxWidth: 180, resizable: true },
  { id: 'actions', visible: true, width: 170, minWidth: 148, maxWidth: 240, resizable: false },
]

const VIDEO_DEFAULT_TABLE_STATE: Omit<SharedAdminTableState, 'columns'> = {
  sort: { field: 'title', dir: 'asc' },
}

const TYPE_LABELS: Record<string, string> = {
  movie: '电影',
  series: '剧集',
  anime: '动漫',
  variety: '综艺',
}

const COLUMN_LABELS: Record<VideoColumnId, string> = {
  cover: '封面',
  title: '标题',
  type: '类型',
  year: '年份',
  status: '状态',
  source_count: '播放源',
  actions: '操作',
}

const SORTABLE_MAP: Record<VideoColumnId, boolean> = {
  cover: false,
  title: true,
  type: true,
  year: true,
  status: true,
  source_count: true,
  actions: false,
}

function toComparableValue(row: VideoAdminRow, field: string): string | number {
  switch (field) {
    case 'title':
      return row.title.toLowerCase()
    case 'type':
      return TYPE_LABELS[row.type] ?? row.type
    case 'year':
      return row.year ?? -1
    case 'status':
      return row.is_published ? 1 : 0
    case 'source_count':
      return Number.parseInt(row.source_count ?? '0', 10)
    default:
      return ''
  }
}

export function VideoTable() {
  const searchParams = useSearchParams()
  const [videos, setVideos] = useState<VideoAdminRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)

  const q = searchParams.get('q') ?? ''
  const type = searchParams.get('type') ?? ''
  const status = searchParams.get('status') ?? ''
  const visibilityStatus = searchParams.get('visibilityStatus') ?? ''
  const reviewStatus = searchParams.get('reviewStatus') ?? ''
  const site = searchParams.get('site') ?? ''

  const columnsState = useAdminTableColumns({
    route: '/admin/videos',
    tableId: 'video-table',
    columns: VIDEO_COLUMNS,
    defaultState: VIDEO_DEFAULT_TABLE_STATE,
  })

  const sortState = useAdminTableSort({
    tableState: columnsState,
    columnsById: columnsState.columnsById,
    defaultSort: VIDEO_DEFAULT_TABLE_STATE.sort,
    sortable: SORTABLE_MAP,
  })

  const visibleColumnIds = useMemo(
    () => columnsState.columns.filter((column) => column.visible).map((column) => column.id as VideoColumnId),
    [columnsState.columns],
  )

  const sortedVideos = useMemo(() => {
    if (!sortState.sort) return videos
    const next = [...videos]
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
  }, [videos, sortState.sort])

  const fetchVideos = useCallback(
    async (pageVal: number) => {
      setLoading(true)
      setSelectedIds([])
      try {
        const params = new URLSearchParams({ page: String(pageVal), limit: String(PAGE_SIZE) })
        if (q) params.set('q', q)
        if (type) params.set('type', type)
        if (status) params.set('status', status)
        if (visibilityStatus) params.set('visibilityStatus', visibilityStatus)
        if (reviewStatus) params.set('reviewStatus', reviewStatus)
        if (site) params.set('site', site)
        const res = await apiClient.get<{ data: VideoAdminRow[]; total: number }>(
          `/admin/videos?${params}`,
        )
        setVideos(res.data)
        setTotal(res.total)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    },
    [q, type, status, visibilityStatus, reviewStatus, site],
  )

  useEffect(() => {
    setPage(1)
    fetchVideos(1)
  }, [q, type, status, visibilityStatus, reviewStatus, site, fetchVideos])

  async function handlePublish(row: VideoAdminRow, isPublished: boolean) {
    try {
      await apiClient.patch(`/admin/videos/${row.id}/publish`, { isPublished })
      fetchVideos(page)
    } catch {
      // silent
    }
  }

  function handleCheck(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))
  }

  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? sortedVideos.map((v) => v.id) : [])
  }

  const allSelected = sortedVideos.length > 0 && selectedIds.length === sortedVideos.length

  function renderSortIndicator(columnId: VideoColumnId): string {
    if (!sortState.isSortedBy(columnId)) return ''
    return sortState.sort?.dir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div data-testid="video-table" className="space-y-2">
      {showColumnsPanel && (
        <div
          className="rounded border border-[var(--border)] bg-[var(--bg2)] p-2"
          data-testid="video-columns-panel"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted)]">显示列</span>
            <button
              type="button"
              className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => columnsState.resetColumnsMeta()}
              data-testid="video-columns-reset"
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
                  data-testid={`video-column-toggle-${column.id}`}
                />
                {COLUMN_LABELS[column.id as VideoColumnId]}
              </label>
            ))}
          </div>
        </div>
      )}

      <AdminTableFrame minWidth={1100}>
        <thead className="bg-[var(--bg2)] text-[var(--muted)]">
          <tr>
            <th className="px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="accent-[var(--accent)]"
                data-testid="video-select-all"
              />
            </th>

            {visibleColumnIds.map((columnId) => {
              const meta = columnsState.columnsById[columnId]
              const sortable = sortState.isSortable(columnId)
              const isLastVisible = columnId === visibleColumnIds[visibleColumnIds.length - 1]
              return (
                <th
                  key={columnId}
                  className="relative px-4 py-3 text-left"
                  style={{ width: `${meta.width}px` }}
                >
                  {sortable ? (
                    <button
                      type="button"
                      className="text-left text-sm hover:text-[var(--text)]"
                      onClick={() => sortState.toggleSort(columnId)}
                      data-testid={`video-sort-${columnId}`}
                    >
                      {COLUMN_LABELS[columnId]}
                      {renderSortIndicator(columnId)}
                    </button>
                  ) : (
                    <span className="text-sm">{COLUMN_LABELS[columnId]}</span>
                  )}

                  {isLastVisible && (
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                      onClick={() => setShowColumnsPanel((prev) => !prev)}
                      data-testid="video-columns-toggle"
                      aria-label="列设置"
                      title="列设置"
                    >
                      ⚙
                    </button>
                  )}

                  {meta.resizable && (
                    <button
                      type="button"
                      aria-label={`${COLUMN_LABELS[columnId]}列宽拖拽`}
                      data-testid={`video-resize-${columnId}`}
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
            isEmpty={!loading && sortedVideos.length === 0}
            colSpan={visibleColumnIds.length + 1}
            emptyText="暂无数据"
          />

          {!loading &&
            sortedVideos.map((row) => {
              const statusBadge: BadgeStatus = row.is_published ? 'published' : 'pending'
              return (
                <tr
                  key={row.id}
                  className="h-[72px] bg-[var(--bg)] hover:bg-[var(--bg2)]"
                  style={{ borderBottom: '1px solid var(--subtle, var(--border))' }}
                  data-testid={`video-row-${row.id}`}
                >
                  <td className="px-4 py-3 align-middle">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={(e) => handleCheck(row.id, e.target.checked)}
                      className="accent-[var(--accent)]"
                      data-testid={`video-checkbox-${row.id}`}
                    />
                  </td>

                  {visibleColumnIds.includes('cover') && (
                    <td className="px-4 py-3 align-middle">
                      {row.cover_url ? (
                        <Image
                          src={row.cover_url}
                          alt={row.title}
                          width={40}
                          height={56}
                          className="rounded object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <div className="h-14 w-10 rounded bg-[var(--bg3)]" />
                      )}
                    </td>
                  )}

                  {visibleColumnIds.includes('title') && (
                    <td className="px-4 py-3 align-middle">
                      <p className="max-w-[320px] truncate font-medium text-[var(--text)]" title={row.title}>
                        {row.title}
                      </p>
                      {row.title_en && (
                        <p className="max-w-[320px] truncate text-xs text-[var(--muted)]" title={row.title_en}>
                          {row.title_en}
                        </p>
                      )}
                    </td>
                  )}

                  {visibleColumnIds.includes('type') && (
                    <td className="px-4 py-3 text-sm text-[var(--muted)] align-middle" title={TYPE_LABELS[row.type] ?? row.type}>
                      <span className="inline-block max-w-[120px] truncate">{TYPE_LABELS[row.type] ?? row.type}</span>
                    </td>
                  )}

                  {visibleColumnIds.includes('year') && (
                    <td className="px-4 py-3 text-sm text-[var(--muted)] align-middle">{row.year ?? '—'}</td>
                  )}

                  {visibleColumnIds.includes('status') && (
                    <td className="px-4 py-3 align-middle">
                      <StatusBadge status={statusBadge} />
                    </td>
                  )}

                  {visibleColumnIds.includes('source_count') && (
                    <td className="px-4 py-3 text-sm text-[var(--muted)] align-middle">
                      {Number.parseInt(row.source_count ?? '0', 10)}
                    </td>
                  )}

                  {visibleColumnIds.includes('actions') && (
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-wrap gap-1">
                        <Link
                          href={`/admin/videos/${row.id}/edit`}
                          className="rounded bg-[var(--bg3)] px-2 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                          data-testid={`video-edit-btn-${row.id}`}
                        >
                          编辑
                        </Link>
                        {row.is_published ? (
                          <button
                            onClick={() => handlePublish(row, false)}
                            className="rounded bg-yellow-900/30 px-2 py-0.5 text-xs text-yellow-400 hover:bg-yellow-900/60"
                            data-testid={`video-unpublish-btn-${row.id}`}
                          >
                            下架
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePublish(row, true)}
                            className="rounded bg-green-900/30 px-2 py-0.5 text-xs text-green-400 hover:bg-green-900/60"
                            data-testid={`video-publish-btn-${row.id}`}
                          >
                            上架
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
        </tbody>
      </AdminTableFrame>

      {total > PAGE_SIZE && (
        <div className="mt-4">
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={(p) => {
              setPage(p)
              fetchVideos(p)
            }}
          />
        </div>
      )}

      <BatchPublishBar
        selectedIds={selectedIds}
        onSuccess={() => fetchVideos(page)}
        onClear={() => setSelectedIds([])}
      />
    </div>
  )
}
