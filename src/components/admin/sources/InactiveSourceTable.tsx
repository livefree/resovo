/**
 * InactiveSourceTable.tsx — 播放源表格（失效源/全部源）
 * CHG-262: 补充列设置入口（⚙ 叠加 + ColumnSettingsPanel）+ PaginationV2
 * 注：SourceVerifyButton 含内联结果展示，不适合放入 AdminDropdown，保留内联行操作
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ApiClientError, apiClient } from '@/lib/api-client'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import { SourceVerifyButton } from '@/components/admin/sources/SourceVerifyButton'
import { BatchDeleteBar } from '@/components/admin/sources/BatchDeleteBar'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { SelectionActionBar } from '@/components/admin/shared/batch/SelectionActionBar'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings'
import {
  TableCheckboxCell,
  TableBadgeCell,
  TableDateCell,
  TableTextCell,
  TableUrlCell,
} from '@/components/admin/shared/modern-table/cells'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'

const DEFAULT_PAGE_SIZE = 20
const BATCH_VERIFY_LIMIT = 500

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

// 所有列 ID（useTableSettings 控制显/隐）
const ALL_INACTIVE_SOURCE_COLUMN_IDS = INACTIVE_SOURCE_COLUMNS_META.map(
  (col) => col.id as InactiveSourceColumnId,
)

// useTableSettings 列描述
const INACTIVE_SOURCE_SETTINGS_COLUMNS = INACTIVE_SOURCE_COLUMNS_META.map((col) => ({
  id: col.id,
  label: INACTIVE_SOURCE_COLUMN_LABELS[col.id as InactiveSourceColumnId] ?? col.id,
  defaultVisible: col.visible ?? true,
  defaultSortable: false,
  required: col.id === 'actions',
}))

type SourceStatusFilter = 'all' | 'inactive'
type SourceSortField = 'created_at' | 'last_checked' | 'is_active' | 'video_title' | 'source_url' | 'site_key'
type SourceSortDir = 'asc' | 'desc'
type SourceBatchVerifyScope = 'site'

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

interface BatchVerifySummary {
  scope: SourceBatchVerifyScope
  totalMatched: number
  processed: number
  activated: number
  inactivated: number
  timeout: number
  failed: number
}

function buildColumns(
  page: number,
  onDelete: (row: SourceRow) => void,
  onVerified: (page: number) => void,
  onSetStatus: (row: SourceRow, nextActive: boolean) => void,
  statusUpdatingId: string | null,
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
          <button type="button" onClick={() => onDelete(row)}
            className="rounded bg-red-900/30 px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/60"
            data-testid={`source-delete-btn-${row.id}`}
          >删除</button>
          <button
            type="button"
            onClick={() => onSetStatus(row, !row.is_active)}
            className="rounded bg-[var(--bg3)] px-2 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            data-testid={`source-status-toggle-${row.id}`}
            disabled={statusUpdatingId === row.id}
          >
            {statusUpdatingId === row.id
              ? '处理中...'
              : row.is_active ? '标记失效' : '标记活跃'}
          </button>
        </div>
      ),
    },
  ]

  if (!selection.enabled) return all

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

  return [selectionColumn, ...all]
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

  const [sources, setSources] = useState<SourceRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<SourceRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [batchVerifyLoading, setBatchVerifyLoading] = useState<SourceBatchVerifyScope | null>(null)
  const [batchVerifySummary, setBatchVerifySummary] = useState<BatchVerifySummary | null>(null)
  const [batchVerifyError, setBatchVerifyError] = useState<string | null>(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [batchStatusLoading, setBatchStatusLoading] = useState<null | 'active' | 'inactive'>(null)
  const [statusActionError, setStatusActionError] = useState<string | null>(null)

  const columnsState = useAdminTableColumns({
    route: '/admin/sources',
    tableId,
    columns: INACTIVE_SOURCE_COLUMNS_META,
    defaultState: INACTIVE_SOURCE_DEFAULT_STATE,
  })

  const tableSettings = useTableSettings({
    tableId,
    columns: INACTIVE_SOURCE_SETTINGS_COLUMNS,
  })

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

  const normalizedSiteKey = siteKey?.trim() ?? ''
  const canBatchBySite = normalizedSiteKey.length > 0

  const runBatchVerify = useCallback(async () => {
    setBatchVerifyLoading('site')
    setBatchVerifyError(null)
    setBatchVerifySummary(null)
    try {
      const payload: {
        scope: SourceBatchVerifyScope
        siteKey?: string
        activeOnly: boolean
        limit: number
      } = {
        scope: 'site',
        activeOnly: false,
        limit: BATCH_VERIFY_LIMIT,
      }
      payload.siteKey = normalizedSiteKey

      const res = await apiClient.post<{ data: BatchVerifySummary }>(
        '/admin/sources/batch-verify',
        payload,
      )
      setBatchVerifySummary(res.data)
      await fetchSources(page, pageSize)
    } catch (error) {
      if (error instanceof ApiClientError) {
        setBatchVerifyError(error.message)
      } else {
        setBatchVerifyError('批量验证失败，请稍后重试')
      }
    } finally {
      setBatchVerifyLoading(null)
    }
  }, [fetchSources, normalizedSiteKey, page, pageSize])

  const setSingleStatus = useCallback(async (row: SourceRow, nextActive: boolean) => {
    setStatusUpdatingId(row.id)
    setStatusActionError(null)
    try {
      await apiClient.patch(`/admin/sources/${row.id}/status`, { isActive: nextActive })
      await fetchSources(page, pageSize)
    } catch (error) {
      if (error instanceof ApiClientError) {
        setStatusActionError(error.message)
      } else {
        setStatusActionError('状态更新失败，请稍后重试')
      }
    } finally {
      setStatusUpdatingId(null)
    }
  }, [fetchSources, page, pageSize])

  const setBatchStatus = useCallback(async (nextActive: boolean) => {
    if (selectedIds.length === 0) return
    setBatchStatusLoading(nextActive ? 'active' : 'inactive')
    setStatusActionError(null)
    try {
      await apiClient.post('/admin/sources/batch-status', {
        ids: selectedIds,
        isActive: nextActive,
      })
      setSelectedIds([])
      await fetchSources(page, pageSize)
    } catch (error) {
      if (error instanceof ApiClientError) {
        setStatusActionError(error.message)
      } else {
        setStatusActionError('批量状态更新失败，请稍后重试')
      }
    } finally {
      setBatchStatusLoading(null)
    }
  }, [fetchSources, page, pageSize, selectedIds])

  const allTableColumns = useMemo(
    () =>
      buildColumns(
        page,
        setDeleteTarget,
        (p) => { void fetchSources(p, pageSize) },
        (row, nextActive) => { void setSingleStatus(row, nextActive) },
        statusUpdatingId,
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
      setSingleStatus,
      statusUpdatingId,
      columnsState.columnsById,
      isAllStatus,
      selectedIds,
      allVisibleSelected,
      handleSelectAll,
      handleSelectRow,
    ],
  )

  const tableColumns = useMemo(
    () => tableSettings.applyToColumns(allTableColumns),
    [tableSettings, allTableColumns],
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2">
        <span className="text-xs text-[var(--muted)]">批量验证</span>
        <button
          type="button"
          onClick={() => { void runBatchVerify() }}
          disabled={!canBatchBySite || batchVerifyLoading !== null}
          className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="source-batch-verify-site"
        >
          {batchVerifyLoading === 'site' ? '验证中...' : '按来源站点'}
        </button>

        <span className="text-xs text-[var(--muted)]">
          {canBatchBySite ? '' : '先填写来源站点；'}
        </span>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg2)] px-3 py-2">
          <SelectionActionBar
            variant="inline"
            selectedCount={selectedIds.length}
            countTestId="source-batch-status-count"
            actions={[
              {
                key: 'mark-active',
                label: batchStatusLoading === 'active' ? '处理中...' : '批量标记活跃',
                onClick: () => { void setBatchStatus(true) },
                variant: 'success',
                disabled: batchStatusLoading !== null,
                testId: 'source-batch-status-active',
              },
              {
                key: 'mark-inactive',
                label: batchStatusLoading === 'inactive' ? '处理中...' : '批量标记失效',
                onClick: () => { void setBatchStatus(false) },
                variant: 'danger',
                disabled: batchStatusLoading !== null,
                testId: 'source-batch-status-inactive',
              },
              {
                key: 'clear',
                label: '取消选择',
                onClick: () => setSelectedIds([]),
                disabled: batchStatusLoading !== null,
                testId: 'source-batch-status-clear',
              },
            ]}
          />
        </div>
      ) : null}

      {batchVerifySummary ? (
        <div
          className="rounded-md border border-emerald-700/40 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-300"
          data-testid="source-batch-verify-summary"
        >
          本次批量验证：命中 {batchVerifySummary.totalMatched}，处理 {batchVerifySummary.processed}，
          活跃 {batchVerifySummary.activated}，失效 {batchVerifySummary.inactivated}，
          超时 {batchVerifySummary.timeout}，失败 {batchVerifySummary.failed}
        </div>
      ) : null}

      {batchVerifyError ? (
        <div
          className="rounded-md border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300"
          data-testid="source-batch-verify-error"
        >
          {batchVerifyError}
        </div>
      ) : null}

      {statusActionError ? (
        <div
          className="rounded-md border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300"
          data-testid="source-status-action-error"
        >
          {statusActionError}
        </div>
      ) : null}

      <ModernDataTable
        columns={tableColumns}
        rows={sources}
        loading={loading}
        emptyText={emptyText}
        getRowId={(r) => r.id}
        scrollTestId={scrollTestId}
        onColumnWidthChange={tableSettings.updateWidth}
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
    </div>
  )
}
