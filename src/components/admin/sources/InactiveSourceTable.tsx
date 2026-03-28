/**
 * InactiveSourceTable.tsx — 播放源表格（失效源/全部源）
 * CHG-262: 补充列设置入口（⚙ 叠加 + ColumnSettingsPanel）+ PaginationV2
 * 注：SourceVerifyButton 含内联结果展示，不适合放入 AdminDropdown，保留内联行操作
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import { SourceVerifyButton } from '@/components/admin/sources/SourceVerifyButton'
import { SourceUrlReplaceModal } from '@/components/admin/sources/SourceUrlReplaceModal'
import { BatchDeleteBar } from '@/components/admin/sources/BatchDeleteBar'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { ColumnSettingsPanel } from '@/components/admin/shared/table/ColumnSettingsPanel'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import {
  TableCheckboxCell,
  TableBadgeCell,
  TableDateCell,
  TableTextCell,
  TableUrlCell,
} from '@/components/admin/shared/modern-table/cells'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'

const DEFAULT_PAGE_SIZE = 20

type InactiveSourceColumnId =
  | 'video_title'
  | 'coordinate'
  | 'source_url'
  | 'status'
  | 'last_checked'
  | 'actions'

const INACTIVE_SOURCE_COLUMN_LABELS: Record<InactiveSourceColumnId, string> = {
  video_title: '视频标题',
  coordinate: 'S/E',
  source_url: '源 URL',
  status: '状态',
  last_checked: '最后验证',
  actions: '操作',
}

const INACTIVE_SOURCE_COLUMNS_META: AdminColumnMeta[] = [
  { id: 'video_title', visible: true, width: 220, minWidth: 160, maxWidth: 360, resizable: true },
  { id: 'coordinate', visible: true, width: 110, minWidth: 90, maxWidth: 180, resizable: true },
  { id: 'source_url', visible: true, width: 340, minWidth: 220, maxWidth: 520, resizable: true },
  { id: 'status', visible: true, width: 120, minWidth: 100, maxWidth: 180, resizable: true },
  { id: 'last_checked', visible: true, width: 170, minWidth: 130, maxWidth: 240, resizable: true },
  { id: 'actions', visible: true, width: 220, minWidth: 180, maxWidth: 300, resizable: false },
]

const INACTIVE_SOURCE_DEFAULT_STATE = {}
type SourceStatusFilter = 'all' | 'inactive'
type SourceSortField = 'created_at' | 'last_checked' | 'is_active' | 'video_title' | 'source_url' | 'site_key'
type SourceSortDir = 'asc' | 'desc'

interface InactiveSourceTableProps {
  status?: SourceStatusFilter
  keyword?: string
  title?: string
  siteKey?: string
  sortField?: SourceSortField
  sortDir?: SourceSortDir
}

export interface SourceRow {
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

function buildColumns(
  page: number,
  onReplace: (row: SourceRow) => void,
  onDelete: (row: SourceRow) => void,
  onVerified: (page: number) => void,
  visibleColumnIds: InactiveSourceColumnId[],
  columnsById: Record<string, { width: number }>,
  selection: {
    enabled: boolean
    selectedIds: string[]
    allSelected: boolean
    onSelectAll: (checked: boolean) => void
    onSelectRow: (id: string, checked: boolean) => void
  },
): TableColumn<SourceRow>[] {
  const all: TableColumn<SourceRow>[] = [
    {
      id: 'video_title', header: '视频标题',
      width: columnsById['video_title']?.width ?? 220, minWidth: 160,
      accessor: (r) => r.video_title ?? '—',
      enableResizing: true,
      cell: ({ row }) => <TableTextCell value={row.video_title ?? '—'} />,
    },
    {
      id: 'coordinate', header: 'S/E',
      width: columnsById['coordinate']?.width ?? 110, minWidth: 90,
      accessor: (r) => `S${r.season_number ?? 1}/E${r.episode_number ?? 1}`,
      enableResizing: true,
      cell: ({ row }) => (
        <TableTextCell value={`S${row.season_number ?? 1} / E${row.episode_number ?? 1}`} className="text-xs text-[var(--muted)]" />
      ),
    },
    {
      id: 'source_url', header: '源 URL',
      width: columnsById['source_url']?.width ?? 340, minWidth: 220,
      accessor: (r) => r.source_url,
      enableResizing: true,
      cell: ({ row }) => <TableUrlCell url={row.source_url} maxLength={60} />,
    },
    {
      id: 'status', header: '状态',
      width: columnsById['status']?.width ?? 120, minWidth: 100,
      accessor: (r) => r.is_active ? '活跃' : '失效',
      enableResizing: true,
      cell: ({ row }) => (
        <TableBadgeCell label={row.is_active ? '活跃' : '失效'} tone={row.is_active ? 'success' : 'danger'} />
      ),
    },
    {
      id: 'last_checked', header: '最后验证',
      width: columnsById['last_checked']?.width ?? 170, minWidth: 130,
      accessor: (r) => r.last_checked ?? '',
      enableResizing: true,
      cell: ({ row }) => <TableDateCell value={row.last_checked} fallback="—" className="text-xs" />,
    },
    {
      id: 'actions', header: '操作',
      width: columnsById['actions']?.width ?? 220, minWidth: 180,
      enableResizing: false,
      accessor: (r) => r.id,
      // SourceVerifyButton 有内联结果展示，不适合放入 AdminDropdown，保留内联布局
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <SourceVerifyButton sourceId={row.id} onVerified={() => onVerified(page)} />
          <button type="button" onClick={() => onReplace(row)}
            className="rounded bg-[var(--bg3)] px-2 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            data-testid={`source-replace-btn-${row.id}`}
          >替换URL</button>
          <button type="button" onClick={() => onDelete(row)}
            className="rounded bg-red-900/30 px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/60"
            data-testid={`source-delete-btn-${row.id}`}
          >删除</button>
        </div>
      ),
    },
  ]

  const dataColumns = all.filter((col) => visibleColumnIds.includes(col.id as InactiveSourceColumnId))
  if (!selection.enabled) return dataColumns

  const selectionColumn: TableColumn<SourceRow> = {
    id: 'selection',
    header: (
      <TableCheckboxCell
        checked={selection.allSelected}
        ariaLabel="全选当前页失效源"
        onChange={selection.onSelectAll}
      />
    ),
    accessor: (row) => row.id,
    width: 44,
    minWidth: 44,
    enableResizing: false,
    cell: ({ row }) => (
      <TableCheckboxCell
        checked={selection.selectedIds.includes(row.id)}
        ariaLabel={`选择 ${row.video_title ?? row.source_name ?? row.id}`}
        onChange={(checked) => selection.onSelectRow(row.id, checked)}
      />
    ),
  }

  return [selectionColumn, ...dataColumns]
}

export function InactiveSourceTable({
  status = 'inactive',
  keyword,
  title,
  siteKey,
  sortField,
  sortDir,
}: InactiveSourceTableProps) {
  const isAllStatus = status === 'all'
  const tableId = isAllStatus ? 'all-source-table' : 'inactive-source-table'
  const emptyText = isAllStatus ? '暂无播放源' : '暂无失效源'
  const scrollTestId = isAllStatus ? 'all-source-table-scroll' : 'inactive-source-table-scroll'
  const columnsToggleTestId = isAllStatus ? 'all-source-columns-toggle' : 'inactive-source-columns-toggle'
  const columnsPanelTestId = isAllStatus ? 'all-source-columns-panel' : 'inactive-source-columns-panel'

  const [sources, setSources] = useState<SourceRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<SourceRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [replaceTarget, setReplaceTarget] = useState<SourceRow | null>(null)
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)

  const columnsState = useAdminTableColumns({
    route: '/admin/sources',
    tableId,
    columns: INACTIVE_SOURCE_COLUMNS_META,
    defaultState: INACTIVE_SOURCE_DEFAULT_STATE,
  })

  const visibleColumnIds = useMemo(
    () =>
      columnsState.columns
        .filter((col) => col.visible)
        .map((col) => col.id as InactiveSourceColumnId),
    [columnsState.columns],
  )

  const allVisibleSelected = useMemo(
    () => sources.length > 0 && sources.every((row) => selectedIds.includes(row.id)),
    [selectedIds, sources],
  )

  const handleSelectAll = useCallback((checked: boolean) => {
    if (!checked) {
      setSelectedIds([])
      return
    }
    setSelectedIds(sources.map((row) => row.id))
  }, [sources])

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (!checked) return prev.filter((item) => item !== id)
      if (prev.includes(id)) return prev
      return [...prev, id]
    })
  }, [])

  const fetchSources = useCallback(async (pageVal: number, pageSizeVal: number) => {
    setLoading(true)
    setSelectedIds([])
    try {
      const params = new URLSearchParams({
        page: String(pageVal),
        limit: String(pageSizeVal),
        status,
      })
      if (keyword) params.set('keyword', keyword)
      if (title) params.set('title', title)
      if (siteKey) params.set('siteKey', siteKey)
      if (sortField) params.set('sortField', sortField)
      if (sortDir) params.set('sortDir', sortDir)
      const res = await apiClient.get<{ data: SourceRow[]; total: number }>(`/admin/sources?${params}`)
      setSources(res.data)
      setTotal(res.total)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [keyword, siteKey, sortDir, sortField, status, title])

  useEffect(() => { void fetchSources(page, pageSize) }, [fetchSources, page, pageSize])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await apiClient.delete(`/admin/sources/${deleteTarget.id}`)
      void fetchSources(page, pageSize)
      setDeleteTarget(null)
    } catch {
      // silent
    } finally {
      setDeleteLoading(false)
    }
  }, [deleteTarget, fetchSources, page, pageSize])

  const tableColumns = useMemo(
    () =>
      buildColumns(
        page,
        setReplaceTarget,
        setDeleteTarget,
        (p) => { void fetchSources(p, pageSize) },
        visibleColumnIds,
        columnsState.columnsById,
        {
          enabled: !isAllStatus,
          selectedIds,
          allSelected: allVisibleSelected,
          onSelectAll: handleSelectAll,
          onSelectRow: handleSelectRow,
        },
      ),
    [
      page,
      pageSize,
      fetchSources,
      visibleColumnIds,
      columnsState.columnsById,
      isAllStatus,
      selectedIds,
      allVisibleSelected,
      handleSelectAll,
      handleSelectRow,
    ],
  )

  return (
    <div className="space-y-2">
      {/* ⚙ 列设置叠加在表格右上角，面板在 overflow-hidden 外渲染 */}
      <div className="relative">
        <div className="absolute right-4 top-3 z-30">
          <button
            type="button"
            className="rounded border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            onClick={() => setShowColumnsPanel((prev) => !prev)}
            data-testid={columnsToggleTestId}
            aria-label="列设置"
            title="列设置"
          >⚙</button>
          {showColumnsPanel ? (
            <div className="absolute right-0 mt-1 w-52">
              <ColumnSettingsPanel
                data-testid={columnsPanelTestId}
                columns={columnsState.columns.map((col) => ({
                  id: col.id,
                  label: INACTIVE_SOURCE_COLUMN_LABELS[col.id as InactiveSourceColumnId] ?? col.id,
                  visible: col.visible,
                }))}
                onToggle={(id) => columnsState.toggleColumnVisibility(id)}
                onReset={() => columnsState.resetColumnsMeta()}
              />
            </div>
          ) : null}
        </div>

        <ModernDataTable
          columns={tableColumns}
          rows={sources}
          loading={loading}
          emptyText={emptyText}
          getRowId={(r) => r.id}
          scrollTestId={scrollTestId}
          onColumnWidthChange={(columnId, nextWidth) => {
            if (columnId in columnsState.columnsById) {
              columnsState.setColumnWidth(columnId, nextWidth)
            }
          }}
        />
      </div>

      {total > 0 ? (
        <div className="mt-4">
          <PaginationV2
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={(nextPage) => { setPage(nextPage); void fetchSources(nextPage, pageSize) }}
            onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1); void fetchSources(1, nextSize) }}
          />
        </div>
      ) : null}

      {!isAllStatus ? (
        <BatchDeleteBar
          selectedIds={selectedIds}
          onSuccess={() => void fetchSources(page, pageSize)}
          onClear={() => setSelectedIds([])}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => { if (!deleteLoading) setDeleteTarget(null) }}
        title="确认删除播放源"
        description={deleteTarget
          ? `确定要删除播放源「${deleteTarget.source_name || deleteTarget.source_url}」吗？此操作不可撤销。`
          : '确定要删除该播放源吗？此操作不可撤销。'}
        confirmText="删除"
        onConfirm={handleDelete}
        loading={deleteLoading}
        danger
      />

      <SourceUrlReplaceModal
        sourceId={replaceTarget?.id ?? null}
        currentUrl={replaceTarget?.source_url ?? ''}
        open={replaceTarget !== null}
        onClose={() => setReplaceTarget(null)}
        onSuccess={() => void fetchSources(page, pageSize)}
      />
    </div>
  )
}
