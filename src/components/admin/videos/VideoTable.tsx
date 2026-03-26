/**
 * VideoTable.tsx — 视频管理表格（Client Component）
 * CHG-211: 接入 ModernDataTable 列定义与 Cell 组件
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { Pagination } from '@/components/admin/Pagination'
import { BatchPublishBar } from '@/components/admin/videos/BatchPublishBar'
import { VideoDetailDrawer } from '@/components/admin/videos/VideoDetailDrawer'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import {
  TableBadgeCell,
  TableCheckboxCell,
  TableImageCell,
  TableSwitchCell,
  TableTextCell,
} from '@/components/admin/shared/modern-table/cells'
import type { TableColumn, TableSortState } from '@/components/admin/shared/modern-table/types'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import type { AdminTableState as SharedAdminTableState } from '@/components/admin/shared/table/useAdminTableState'

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
  active_source_count?: string
  total_source_count?: string
  visibility_status?: 'public' | 'internal' | 'hidden'
  review_status?: 'pending_review' | 'approved' | 'rejected'
  created_at: string
}

type VideoColumnId =
  | 'cover'
  | 'title'
  | 'type'
  | 'source_health'
  | 'visibility'
  | 'review_status'
  | 'actions'

const VIDEO_COLUMNS: AdminColumnMeta[] = [
  { id: 'cover', visible: true, width: 88, minWidth: 76, maxWidth: 120, resizable: true },
  { id: 'title', visible: true, width: 320, minWidth: 220, maxWidth: 520, resizable: true },
  { id: 'type', visible: true, width: 132, minWidth: 110, maxWidth: 200, resizable: true },
  { id: 'source_health', visible: true, width: 160, minWidth: 140, maxWidth: 240, resizable: true },
  { id: 'visibility', visible: true, width: 132, minWidth: 120, maxWidth: 180, resizable: true },
  { id: 'review_status', visible: true, width: 132, minWidth: 120, maxWidth: 180, resizable: true },
  { id: 'actions', visible: true, width: 168, minWidth: 148, maxWidth: 240, resizable: false },
]

const VIDEO_DEFAULT_TABLE_STATE: Omit<SharedAdminTableState, 'columns'> = {
  sort: { field: 'title', dir: 'asc' },
}

const TYPE_LABELS: Record<string, string> = {
  movie: '电影',
  series: '剧集',
  anime: '动漫',
  variety: '综艺',
  documentary: '纪录片',
  short: '短片',
  sports: '体育',
  music: '音乐',
  news: '新闻',
  kids: '少儿',
  other: '其他',
}

const COLUMN_LABELS: Record<VideoColumnId, string> = {
  cover: '封面',
  title: '标题',
  type: '类型',
  source_health: '源健康度',
  visibility: '可见性',
  review_status: '审核状态',
  actions: '操作',
}

const SORTABLE_MAP: Record<VideoColumnId, boolean> = {
  cover: false,
  title: true,
  type: true,
  source_health: true,
  visibility: true,
  review_status: true,
  actions: false,
}

function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

function getReviewLabel(reviewStatus?: VideoAdminRow['review_status']): string {
  switch (reviewStatus) {
    case 'approved':
      return '已通过'
    case 'rejected':
      return '已拒绝'
    default:
      return '待审核'
  }
}

function getReviewTone(reviewStatus?: VideoAdminRow['review_status']): 'success' | 'danger' | 'warning' {
  switch (reviewStatus) {
    case 'approved':
      return 'success'
    case 'rejected':
      return 'danger'
    default:
      return 'warning'
  }
}

function getVisibilityLabel(visibility?: VideoAdminRow['visibility_status']): string {
  switch (visibility) {
    case 'public':
      return '公开'
    case 'hidden':
      return '隐藏'
    default:
      return '内部'
  }
}

function getVisibilitySwitchValue(row: VideoAdminRow): boolean {
  return row.visibility_status === 'public'
}

function getSourceCounts(row: VideoAdminRow): { active: number; total: number } {
  const active = Number.parseInt(row.active_source_count ?? row.source_count ?? '0', 10)
  const total = Number.parseInt(row.total_source_count ?? row.source_count ?? '0', 10)
  return {
    active: Number.isFinite(active) ? active : 0,
    total: Number.isFinite(total) ? total : 0,
  }
}

function getSourceHealthLabel(row: VideoAdminRow): string {
  const { active, total } = getSourceCounts(row)
  if (total <= 0) return '🟡 暂无源'
  if (active <= 0) return '🔴 全失效'
  if (active < total) return `🟡 ${active}/${total} 活跃`
  return `🟢 ${active} 活跃`
}

function toComparableValue(row: VideoAdminRow, field: string): string | number {
  switch (field) {
    case 'title':
      return row.title.toLowerCase()
    case 'type':
      return getTypeLabel(row.type)
    case 'source_health': {
      const { active, total } = getSourceCounts(row)
      return total * 1000 + active
    }
    case 'visibility':
      return getVisibilityLabel(row.visibility_status)
    case 'review_status':
      return getReviewLabel(row.review_status)
    default:
      return ''
  }
}

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
        const res = await apiClient.get<{ data: VideoAdminRow[]; total: number }>(`/admin/videos?${params}`)
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
    void fetchVideos(1)
  }, [q, type, status, visibilityStatus, reviewStatus, site, fetchVideos])

  function handleCheck(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))
  }

  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? sortedVideos.map((video) => video.id) : [])
  }

  const allSelected = sortedVideos.length > 0 && selectedIds.length === sortedVideos.length

  async function handleVisibilityToggle(row: VideoAdminRow, nextValue: boolean) {
    const nextVisibility = nextValue ? 'public' : 'hidden'
    const previousState = {
      visibility_status: row.visibility_status,
      is_published: row.is_published,
    }

    setVisibilityPendingIds((prev) => [...prev, row.id])
    setVideos((prev) => prev.map((item) => (
      item.id === row.id
        ? {
          ...item,
          visibility_status: nextVisibility,
          is_published: nextValue,
        }
        : item
    )))

    try {
      const res = await apiClient.patch<{ data: { visibility_status: VideoAdminRow['visibility_status']; is_published: boolean } }>(
        `/admin/videos/${row.id}/visibility`,
        { visibility: nextVisibility },
      )
      const result = res.data
      setVideos((prev) => prev.map((item) => (
        item.id === row.id
          ? {
            ...item,
            visibility_status: result.visibility_status,
            is_published: result.is_published,
          }
          : item
      )))
    } catch (error) {
      setVideos((prev) => prev.map((item) => (
        item.id === row.id
          ? {
            ...item,
            visibility_status: previousState.visibility_status,
            is_published: previousState.is_published,
          }
          : item
      )))
      throw error
    } finally {
      setVisibilityPendingIds((prev) => prev.filter((id) => id !== row.id))
    }
  }

  const tableColumns = useMemo<Array<TableColumn<VideoAdminRow>>>(() => {
    const result: Array<TableColumn<VideoAdminRow>> = [
      {
        id: 'selection',
        header: (
          <TableCheckboxCell
            checked={allSelected}
            ariaLabel="全选当前页视频"
            onChange={handleSelectAll}
          />
        ),
        accessor: (row) => row.id,
        width: 44,
        minWidth: 44,
        enableResizing: false,
        cell: ({ row }) => (
          <TableCheckboxCell
            checked={selectedIds.includes(row.id)}
            ariaLabel={`选择 ${row.title}`}
            onChange={(checked) => handleCheck(row.id, checked)}
          />
        ),
      },
    ]

    for (const columnId of visibleColumnIds) {
      const meta = columnsState.columnsById[columnId]
      const baseColumn: TableColumn<VideoAdminRow> = {
        id: columnId,
        header: COLUMN_LABELS[columnId],
        accessor: (row) => row[columnId === 'source_health' ? 'source_count' : 'title'],
        width: meta.width,
        minWidth: meta.minWidth,
        enableResizing: meta.resizable,
        enableSorting: sortState.isSortable(columnId),
      }

      switch (columnId) {
        case 'cover':
          baseColumn.accessor = (row) => row.cover_url
          baseColumn.cell = ({ row }) => (
            <TableImageCell src={row.cover_url} alt={row.title} width={40} height={56} />
          )
          break
        case 'title':
          baseColumn.accessor = (row) => row.title
          baseColumn.cell = ({ row }) => (
            <div className="flex min-w-0 flex-col gap-0.5">
              <TableTextCell value={row.title} className="font-medium text-[var(--text)]" />
              <TableTextCell value={row.short_id} className="font-mono text-xs text-[var(--muted)]" />
            </div>
          )
          break
        case 'type':
          baseColumn.accessor = (row) => getTypeLabel(row.type)
          baseColumn.cell = ({ row }) => (
            <TableBadgeCell label={getTypeLabel(row.type)} tone="info" />
          )
          break
        case 'source_health':
          baseColumn.accessor = (row) => getSourceHealthLabel(row)
          baseColumn.cell = ({ row }) => (
            <TableBadgeCell
              label={getSourceHealthLabel(row)}
              tone={(() => {
                const { active, total } = getSourceCounts(row)
                if (total <= 0) return 'warning'
                if (active <= 0) return 'danger'
                if (active < total) return 'warning'
                return 'success'
              })()}
            />
          )
          break
        case 'visibility':
          baseColumn.accessor = (row) => getVisibilityLabel(row.visibility_status)
          baseColumn.cell = ({ row }) => (
            <div className="flex items-center gap-2">
              <TableSwitchCell
                value={getVisibilitySwitchValue(row)}
                disabled={visibilityPendingIds.includes(row.id)}
                onToggle={(nextValue) => handleVisibilityToggle(row, nextValue)}
              />
              <span className="text-xs text-[var(--muted)]">{getVisibilityLabel(row.visibility_status)}</span>
            </div>
          )
          break
        case 'review_status':
          baseColumn.accessor = (row) => getReviewLabel(row.review_status)
          baseColumn.cell = ({ row }) => (
            <TableBadgeCell label={getReviewLabel(row.review_status)} tone={getReviewTone(row.review_status)} />
          )
          break
        case 'actions':
          baseColumn.accessor = (row) => row.id
          baseColumn.cell = ({ row }) => (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setDrawerVideoId(row.id)}
                className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg2)]"
                data-testid={`video-edit-btn-${row.id}`}
              >
                编辑
              </button>
            </div>
          )
          break
      }

      result.push(baseColumn)
    }

    return result
  }, [allSelected, columnsState.columnsById, selectedIds, sortState, visibilityPendingIds, visibleColumnIds])

  const sort = useMemo<TableSortState | undefined>(() => {
    if (!sortState.sort) return undefined
    return {
      field: sortState.sort.field,
      direction: sortState.sort.dir,
    }
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
        >
          列设置
        </button>
      </div>

      {showColumnsPanel ? (
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
            onChange={(nextPage) => {
              setPage(nextPage)
              void fetchVideos(nextPage)
            }}
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
