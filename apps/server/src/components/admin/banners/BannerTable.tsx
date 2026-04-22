'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { notify } from '@/components/admin/shared/toast/useAdminToast'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings/useTableSettings'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import { SelectionActionBar } from '@/components/admin/shared/batch/SelectionActionBar'
import { AdminDropdown } from '@/components/admin/shared/dropdown/AdminDropdown'
import { AdminButton } from '@/components/admin/shared/button/AdminButton'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { BannerDragSort } from '@/components/admin/banners/BannerDragSort'
import type { TableColumn, TableSortState } from '@/components/admin/shared/modern-table/types'
import type { Banner } from '@resovo/types'

// ── 常量 ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20
const TABLE_ID = 'admin-banners-v1'

const COLUMN_DEFS = [
  { id: 'image', label: '图片', defaultVisible: true, defaultSortable: false, required: false },
  { id: 'title', label: '标题', defaultVisible: true, defaultSortable: true, required: true },
  { id: 'link', label: '链接', defaultVisible: true, defaultSortable: false },
  { id: 'time_window', label: '时间窗', defaultVisible: true, defaultSortable: true },
  { id: 'sort_order', label: '排序', defaultVisible: true, defaultSortable: true },
  { id: 'status', label: '状态', defaultVisible: true, defaultSortable: false },
  { id: 'actions', label: '操作', defaultVisible: true, defaultSortable: false, required: true },
]

// ── 工具 ─────────────────────────────────────────────────────────────────────

function getDisplayTitle(title: Banner['title']): string {
  return title['zh-CN'] ?? title['en'] ?? Object.values(title)[0] ?? '（无标题）'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', year: '2-digit' })
}

// ── 组件 ─────────────────────────────────────────────────────────────────────

interface BannerListResponse {
  data: Banner[]
  pagination: { total: number; page: number; limit: number; hasNext: boolean }
}

export function BannerTable() {
  const [rows, setRows] = useState<Banner[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sort, setSort] = useState<TableSortState>({ field: 'sort_order', direction: 'asc' })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null)
  const [showDragSort, setShowDragSort] = useState(false)

  const { orderedSettings, updateSetting, reset: resetSettings, applyToColumns, updateWidth } =
    useTableSettings({ tableId: TABLE_ID, columns: COLUMN_DEFS })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sortField: sort.field,
        sortDir: sort.direction,
      })
      const res = await apiClient.get<BannerListResponse>(`/admin/banners?${qs}`)
      setRows(res.data)
      setTotal(res.pagination.total)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '加载失败')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, sort, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetchData() }, [fetchData])

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/admin/banners/${id}`)
      notify.success('已删除')
      setRefreshKey((k) => k + 1)
      setSelectedIds((ids) => ids.filter((i) => i !== id))
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  async function handleBatchDelete() {
    try {
      await Promise.all(selectedIds.map((id) => apiClient.delete(`/admin/banners/${id}`)))
      notify.success(`已删除 ${selectedIds.length} 条`)
      setSelectedIds([])
      setRefreshKey((k) => k + 1)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '批量删除失败')
    }
  }

  const baseColumns: Array<TableColumn<Banner>> = useMemo(() => [
    {
      id: 'image',
      header: '图片',
      accessor: () => '',
      cell: ({ row }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.imageUrl}
          alt={getDisplayTitle(row.title)}
          className="h-10 w-16 rounded object-cover border border-[var(--border)]"
        />
      ),
      width: 90,
      minWidth: 80,
      enableSorting: false,
    },
    {
      id: 'title',
      header: '标题',
      accessor: (row) => getDisplayTitle(row.title),
      width: 200,
      minWidth: 120,
      enableSorting: true,
    },
    {
      id: 'link',
      header: '链接',
      accessor: (row) => `${row.linkType}:${row.linkTarget}`,
      cell: ({ row }) => (
        <span className="text-xs text-[var(--muted)]">
          <span className="rounded px-1 py-0.5 border border-[var(--border)] mr-1 text-[10px]">
            {row.linkType === 'video' ? '站内' : '外链'}
          </span>
          <span className="truncate max-w-[160px] inline-block align-bottom">{row.linkTarget}</span>
        </span>
      ),
      width: 220,
      minWidth: 140,
      enableSorting: false,
    },
    {
      id: 'time_window',
      header: '时间窗',
      accessor: (row) => row.activeFrom ?? '',
      cell: ({ row }) => (
        <span className="text-xs text-[var(--muted)]">
          {fmtDate(row.activeFrom)} — {fmtDate(row.activeTo)}
        </span>
      ),
      width: 150,
      minWidth: 120,
      enableSorting: true,
    },
    {
      id: 'sort_order',
      header: '排序',
      accessor: (row) => String(row.sortOrder),
      width: 80,
      minWidth: 60,
      enableSorting: true,
    },
    {
      id: 'status',
      header: '状态',
      accessor: (row) => (row.isActive ? '启用' : '停用'),
      cell: ({ row }) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            row.isActive
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-[var(--bg3)] text-[var(--muted)] border border-[var(--border)]'
          }`}
        >
          {row.isActive ? '启用' : '停用'}
        </span>
      ),
      width: 80,
      minWidth: 60,
      enableSorting: false,
    },
    {
      id: 'actions',
      header: '操作',
      accessor: () => '',
      cell: ({ row }) => (
        <AdminDropdown
          trigger={<button type="button" className="text-xs text-[var(--muted)] hover:text-[var(--text)] px-2 py-1">操作 ▾</button>}
          items={[
            {
              key: 'edit',
              label: '编辑',
              onClick: () => { window.location.href = `/admin/banners/${row.id}` },
            },
            {
              key: 'delete',
              label: '删除',
              danger: true,
              onClick: () => setDeleteTarget(row),
            },
          ]}
        />
      ),
      width: 80,
      minWidth: 60,
      enableSorting: false,
    },
  ], [])

  const columns = applyToColumns(baseColumns)

  return (
    <div data-testid="banner-table" className="space-y-3">
      {/* 工具栏 */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--muted)]">共 {total} 条</span>
        <AdminButton
          variant="secondary"
          size="sm"
          onClick={() => setShowDragSort(true)}
          data-testid="banner-reorder-btn"
        >
          编辑排序
        </AdminButton>
      </div>

      {/* 拖拽排序面板 */}
      {showDragSort && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg2)] p-4">
          <BannerDragSort
            initialBanners={rows}
            onClose={() => { setShowDragSort(false); setRefreshKey((k) => k + 1) }}
          />
        </div>
      )}

      <ModernDataTable
        columns={columns}
        rows={rows}
        sort={sort}
        onSortChange={setSort}
        onColumnWidthChange={updateWidth}
        loading={loading}
        emptyText="暂无 Banner"
        scrollTestId="banner-table-scroll"
        getRowId={(row) => row.id}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        settingsSlot={{
          settingsColumns: orderedSettings,
          onSettingsChange: updateSetting,
          onSettingsReset: resetSettings,
        }}
      />

      <PaginationV2
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />

      {selectedIds.length > 0 && (
        <SelectionActionBar
          selectedCount={selectedIds.length}
          variant="sticky-bottom"
          actions={[
            {
              key: 'delete',
              label: `删除 ${selectedIds.length} 条`,
              variant: 'danger',
              onClick: handleBatchDelete,
              testId: 'banner-batch-delete',
            },
          ]}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          title="删除 Banner"
          description={`确定删除「${getDisplayTitle(deleteTarget.title)}」吗？此操作不可撤销。`}
          confirmText="删除"
          danger
          onConfirm={() => {
            void handleDelete(deleteTarget.id)
            setDeleteTarget(null)
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
