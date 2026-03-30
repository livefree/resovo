/**
 * VideoTable.tsx — 视频管理表格（Client Component）
 * CHG-211: 接入 ModernDataTable；CHG-227: 列定义提取至 useVideoTableColumns
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { selectIsAdmin, useAuthStore } from '@/stores/authStore'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import { BatchPublishBar } from '@/components/admin/videos/BatchPublishBar'
import { VideoDetailDrawer } from '@/components/admin/videos/VideoDetailDrawer'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { TableSortState } from '@/components/admin/shared/modern-table/types'
import type { AdminTableSortState } from '@/components/admin/shared/table/useAdminTableState'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings'
import {
  useVideoTableColumns,
  COLUMN_LABELS,
  SORTABLE_MAP,
  VIDEO_COLUMNS,
  VIDEO_DEFAULT_TABLE_STATE,
  type VideoAdminRow,
  type VideoColumnId,
} from './useVideoTableColumns'

// 所有列 ID（useTableSettings 控制显/隐）
const ALL_VIDEO_COLUMN_IDS = VIDEO_COLUMNS.map((col) => col.id as VideoColumnId)

// useTableSettings 列描述（label + defaultSortable 来自 SORTABLE_MAP）
const VIDEO_SETTINGS_COLUMNS = VIDEO_COLUMNS.map((col) => ({
  id: col.id,
  label: COLUMN_LABELS[col.id as VideoColumnId] ?? col.id,
  defaultVisible: col.visible ?? true,
  defaultSortable: SORTABLE_MAP[col.id as VideoColumnId] ?? false,
  required: col.id === 'actions',
}))

const DEFAULT_PAGE_SIZE = 20

export function VideoTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAdmin = useAuthStore(selectIsAdmin)
  const [videos, setVideos] = useState<VideoAdminRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [visibilityPendingIds, setVisibilityPendingIds] = useState<string[]>([])
  const [publishPendingIds, setPublishPendingIds] = useState<string[]>([])
  const [doubanSyncPendingIds, setDoubanSyncPendingIds] = useState<string[]>([])
  const [drawerVideoId, setDrawerVideoId] = useState<string | null>(null)

  const q = searchParams.get('q') ?? ''
  const type = searchParams.get('type') ?? ''
  const status = searchParams.get('status') ?? ''
  const visibilityStatus = searchParams.get('visibilityStatus') ?? ''
  const reviewStatus = searchParams.get('reviewStatus') ?? ''
  const site = searchParams.get('site') ?? ''

  const [sort, setSort] = useState<AdminTableSortState | undefined>(VIDEO_DEFAULT_TABLE_STATE.sort)

  const tableSettings = useTableSettings({
    tableId: 'video-table',
    columns: VIDEO_SETTINGS_COLUMNS,
  })

  const fetchVideos = useCallback(async (pageVal: number, pageSizeVal: number) => {
    setLoading(true)
    setSelectedIds([])
    try {
      const params = new URLSearchParams({ page: String(pageVal), limit: String(pageSizeVal) })
      if (q) params.set('q', q)
      if (type) params.set('type', type)
      if (status) params.set('status', status)
      if (visibilityStatus) params.set('visibilityStatus', visibilityStatus)
      if (reviewStatus) params.set('reviewStatus', reviewStatus)
      if (site) params.set('site', site)
      if (sort) {
        params.set('sortField', sort.field)
        params.set('sortDir', sort.dir)
      }
      const res = await apiClient.get<{ data: VideoAdminRow[]; total: number }>(`/admin/videos?${params}`)
      setVideos(res.data)
      setTotal(res.total)
    } catch (_err) {
      // fetch failed: table remains showing previous data
    } finally {
      setLoading(false)
    }
  }, [q, type, status, visibilityStatus, reviewStatus, site, sort])

  useEffect(() => {
    setPage(1)
    void fetchVideos(1, pageSize)
  }, [q, type, status, visibilityStatus, reviewStatus, site, sort, pageSize, fetchVideos])

  const handleCheck = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? videos.map((v) => v.id) : [])
  }, [videos])

  const allSelected = videos.length > 0 && selectedIds.length === videos.length

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

  const handlePublishToggle = useCallback(async (row: VideoAdminRow) => {
    const nextIsPublished = !row.is_published
    setPublishPendingIds((ids) => (ids.includes(row.id) ? ids : [...ids, row.id]))
    try {
      await apiClient.patch(`/admin/videos/${row.id}/publish`, { isPublished: nextIsPublished })
      await fetchVideos(page, pageSize)
    } catch (_error) {
      // silent
    } finally {
      setPublishPendingIds((ids) => ids.filter((id) => id !== row.id))
    }
  }, [fetchVideos, page, pageSize])

  const handleDoubanSync = useCallback(async (videoId: string) => {
    setDoubanSyncPendingIds((ids) => (ids.includes(videoId) ? ids : [...ids, videoId]))
    try {
      await apiClient.post(`/admin/videos/${videoId}/douban-sync`)
      await fetchVideos(page, pageSize)
    } catch (_error) {
      // silent
    } finally {
      setDoubanSyncPendingIds((ids) => ids.filter((id) => id !== videoId))
    }
  }, [fetchVideos, page, pageSize])

  const openFullEdit = useCallback((videoId: string) => {
    router.push(`/admin/videos/${videoId}/edit`)
  }, [router])

  const allTableColumns = useVideoTableColumns({
    visibleColumnIds: ALL_VIDEO_COLUMN_IDS,
    allSelected,
    handleSelectAll,
    deps: {
      sortable: SORTABLE_MAP,
      selectedIds,
      visibilityPendingIds,
      publishPendingIds,
      doubanSyncPendingIds,
      canSyncDouban: isAdmin,
      handleCheck,
      handleVisibilityToggle,
      handlePublishToggle,
      handleDoubanSync,
      setDrawerVideoId,
      openFullEdit,
    },
  })

  const tableColumns = useMemo(
    () => tableSettings.applyToColumns(allTableColumns),
    [tableSettings, allTableColumns],
  )

  const tableSortState = useMemo<TableSortState | undefined>(() => {
    if (!sort) return undefined
    return { field: sort.field, direction: sort.dir }
  }, [sort])

  return (
    <div data-testid="video-table" className="space-y-2">
      <ModernDataTable
        columns={tableColumns}
        rows={videos}
        sort={tableSortState}
        onSortChange={(nextSort) => {
          setSort({ field: nextSort.field, dir: nextSort.direction === 'asc' ? 'asc' : 'desc' })
        }}
        onColumnWidthChange={tableSettings.updateWidth}
        loading={loading}
        emptyText="暂无数据"
        scrollTestId="video-table-scroll"
        getRowId={(row) => row.id}
        settingsSlot={{
          settingsColumns: tableSettings.orderedSettings,
          onSettingsChange: tableSettings.updateSetting,
          onSettingsReset: tableSettings.reset,
        }}
      />

      {total > 0 ? (
        <div className="mt-4">
          <PaginationV2
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={(nextPage) => { setPage(nextPage); void fetchVideos(nextPage, pageSize) }}
            onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1); void fetchVideos(1, nextSize) }}
          />
        </div>
      ) : null}

      <BatchPublishBar
        selectedIds={selectedIds}
        onSuccess={() => void fetchVideos(page, pageSize)}
        onClear={() => setSelectedIds([])}
      />

      <VideoDetailDrawer
        videoId={drawerVideoId}
        open={drawerVideoId !== null}
        onClose={() => setDrawerVideoId(null)}
        onSaved={() => void fetchVideos(page, pageSize)}
      />
    </div>
  )
}
