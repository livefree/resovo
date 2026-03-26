/**
 * VideoTable.tsx — 视频管理表格（Client Component）
 * CHG-211: 接入 ModernDataTable；CHG-227: 列定义提取至 useVideoTableColumns
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { Pagination } from '@/components/admin/Pagination'
import { BatchPublishBar } from '@/components/admin/videos/BatchPublishBar'
import { VideoDetailDrawer } from '@/components/admin/videos/VideoDetailDrawer'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { TableSortState } from '@/components/admin/shared/modern-table/types'
import { useAdminTableColumns } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import {
  useVideoTableColumns,
  toComparableValue,
  COLUMN_LABELS,
  SORTABLE_MAP,
  VIDEO_COLUMNS,
  VIDEO_DEFAULT_TABLE_STATE,
  type VideoAdminRow,
  type VideoColumnId,
} from './useVideoTableColumns'

const PAGE_SIZE = 20

function buildColumnsToggleId(columnId: string): string {
  return `video-column-toggle-${columnId}`
}

export function VideoTable() {
  const searchParams = useSearchParams()
  const [videos, setVideos] = useState<VideoAdminRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)
  const [visibilityPendingIds, setVisibilityPendingIds] = useState<string[]>([])
  const [drawerVideoId, setDrawerVideoId] = useState<string | null>(null)

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
    () => columnsState.columns.filter((c) => c.visible).map((c) => c.id as VideoColumnId),
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

  const fetchVideos = useCallback(async (pageVal: number) => {
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
      const res = await apiClient.get<{ data: VideoAdminRow[]; total: number }>(`/admin/videos?${params}`)
      setVideos(res.data)
      setTotal(res.total)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [q, type, status, visibilityStatus, reviewStatus, site])

  useEffect(() => {
    setPage(1)
    void fetchVideos(1)
  }, [q, type, status, visibilityStatus, reviewStatus, site, fetchVideos])

  const handleCheck = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? sortedVideos.map((v) => v.id) : [])
  }, [sortedVideos])

  const allSelected = sortedVideos.length > 0 && selectedIds.length === sortedVideos.length

  const handleVisibilityToggle = useCallback(async (row: VideoAdminRow, nextValue: boolean) => {
    const nextVisibility = nextValue ? 'public' : 'hidden'
    const prev = { visibility_status: row.visibility_status, is_published: row.is_published }
    setVisibilityPendingIds((ids) => [...ids, row.id])
    setVideos((vs) => vs.map((item) => (
      item.id === row.id ? { ...item, visibility_status: nextVisibility, is_published: nextValue } : item
    )))
    try {
      const res = await apiClient.patch<{ data: { visibility_status: VideoAdminRow['visibility_status']; is_published: boolean } }>(
        `/admin/videos/${row.id}/visibility`, { visibility: nextVisibility },
      )
      setVideos((vs) => vs.map((item) => (
        item.id === row.id ? { ...item, ...res.data } : item
      )))
    } catch (error) {
      setVideos((vs) => vs.map((item) => (
        item.id === row.id ? { ...item, ...prev } : item
      )))
      throw error
    } finally {
      setVisibilityPendingIds((ids) => ids.filter((id) => id !== row.id))
    }
  }, [])

  const tableColumns = useVideoTableColumns({
    visibleColumnIds,
    allSelected,
    handleSelectAll,
    deps: {
      columnsById: columnsState.columnsById,
      sortState,
      selectedIds,
      visibilityPendingIds,
      handleCheck,
      handleVisibilityToggle,
      setDrawerVideoId,
    },
  })

  const sort = useMemo<TableSortState | undefined>(() => {
    if (!sortState.sort) return undefined
    return { field: sortState.sort.field, direction: sortState.sort.dir }
  }, [sortState.sort])

  return (
    <div data-testid="video-table" className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
          onClick={() => setShowColumnsPanel((prev) => !prev)}
          data-testid="video-columns-toggle"
          aria-label="列设置"
        >列设置</button>
      </div>

      {showColumnsPanel ? (
        <div className="rounded border border-[var(--border)] bg-[var(--bg2)] p-2" data-testid="video-columns-panel">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted)]">显示列</span>
            <button
              type="button"
              className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => columnsState.resetColumnsMeta()}
              data-testid="video-columns-reset"
            >重置</button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {columnsState.columns.map((column) => (
              <label key={column.id} className="flex items-center gap-2 text-xs text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => columnsState.toggleColumnVisibility(column.id)}
                  className="accent-[var(--accent)]"
                  data-testid={buildColumnsToggleId(column.id)}
                />
                {COLUMN_LABELS[column.id as VideoColumnId]}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <ModernDataTable
        columns={tableColumns}
        rows={sortedVideos}
        sort={sort}
        onSortChange={(nextSort) => {
          sortState.setSort(nextSort.field, nextSort.direction === 'asc' ? 'asc' : 'desc')
        }}
        onColumnWidthChange={(columnId, nextWidth) => {
          if (columnId in columnsState.columnsById) {
            columnsState.setColumnWidth(columnId, nextWidth)
          }
        }}
        loading={loading}
        emptyText="暂无数据"
        scrollTestId="video-table-scroll"
        getRowId={(row) => row.id}
      />

      {total > PAGE_SIZE ? (
        <div className="mt-4">
          <Pagination
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={(nextPage) => { setPage(nextPage); void fetchVideos(nextPage) }}
          />
        </div>
      ) : null}

      <BatchPublishBar
        selectedIds={selectedIds}
        onSuccess={() => void fetchVideos(page)}
        onClear={() => setSelectedIds([])}
      />

      <VideoDetailDrawer
        videoId={drawerVideoId}
        open={drawerVideoId !== null}
        onClose={() => setDrawerVideoId(null)}
        onSaved={() => void fetchVideos(page)}
      />
    </div>
  )
}
