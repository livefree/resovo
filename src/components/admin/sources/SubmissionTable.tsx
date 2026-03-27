/**
 * SubmissionTable.tsx — Tab 2 用户纠错表格（CHG-229）
 * CHG-267: 补充 ⚙ 列设置入口 + PaginationV2 + AdminDropdown 行操作
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import { AdminDropdown } from '@/components/admin/shared/dropdown/AdminDropdown'
import { ColumnSettingsPanel } from '@/components/admin/shared/table/ColumnSettingsPanel'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import { useAdminTableColumns, type AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'
import { TableDateCell, TableTextCell, TableUrlCell } from '@/components/admin/shared/modern-table/cells'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'

const DEFAULT_PAGE_SIZE = 20

type SourceSubmissionColumnId =
  | 'video_title'
  | 'source_url'
  | 'submitted_by'
  | 'created_at'
  | 'actions'

const SOURCE_SUBMISSION_COLUMN_LABELS: Record<SourceSubmissionColumnId, string> = {
  video_title: '视频标题',
  source_url: '来源 URL',
  submitted_by: '提交者',
  created_at: '提交时间',
  actions: '操作',
}

const SOURCE_SUBMISSION_COLUMNS_META: AdminColumnMeta[] = [
  { id: 'video_title', visible: true, width: 220, minWidth: 160, maxWidth: 360, resizable: true },
  { id: 'source_url', visible: true, width: 340, minWidth: 220, maxWidth: 520, resizable: true },
  { id: 'submitted_by', visible: true, width: 120, minWidth: 100, maxWidth: 200, resizable: true },
  { id: 'created_at', visible: true, width: 160, minWidth: 130, maxWidth: 240, resizable: true },
  { id: 'actions', visible: true, width: 130, minWidth: 110, maxWidth: 200, resizable: false },
]

const SOURCE_SUBMISSION_DEFAULT_STATE = {}

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

function buildColumns(
  onApprove: (id: string) => Promise<void>,
  onReject: (id: string) => Promise<void>,
  visibleColumnIds: SourceSubmissionColumnId[],
  columnsById: Record<string, { width: number }>,
): TableColumn<SubmissionRow>[] {
  const all: TableColumn<SubmissionRow>[] = [
    {
      id: 'video_title', header: '视频标题',
      width: columnsById['video_title']?.width ?? 220, minWidth: 160,
      accessor: (r) => r.video_title ?? '—',
      enableResizing: true,
      cell: ({ row }) => <TableTextCell value={row.video_title ?? '—'} />,
    },
    {
      id: 'source_url', header: '来源 URL',
      width: columnsById['source_url']?.width ?? 340, minWidth: 220,
      accessor: (r) => r.source_url,
      enableResizing: true,
      cell: ({ row }) => <TableUrlCell url={row.source_url} maxLength={60} />,
    },
    {
      id: 'submitted_by', header: '提交者',
      width: columnsById['submitted_by']?.width ?? 120, minWidth: 100,
      accessor: (r) => r.submitted_by_username ?? '匿名',
      enableResizing: true,
      cell: ({ row }) => <TableTextCell value={row.submitted_by_username ?? '匿名'} className="text-[var(--muted)]" />,
    },
    {
      id: 'created_at', header: '提交时间',
      width: columnsById['created_at']?.width ?? 160, minWidth: 130,
      accessor: (r) => r.created_at,
      enableResizing: true,
      cell: ({ row }) => <TableDateCell value={row.created_at} className="text-xs" />,
    },
    {
      id: 'actions', header: '操作',
      width: columnsById['actions']?.width ?? 130, minWidth: 110,
      enableResizing: false,
      accessor: (r) => r.id,
      cell: ({ row }) => (
        <AdminDropdown
          data-testid={`source-submission-actions-${row.id}`}
          align="right"
          trigger={
            <button
              type="button"
              className="rounded border border-[var(--border)] bg-[var(--bg3)] px-2 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            >操作 ▾</button>
          }
          items={[
            { key: 'approve', label: '采纳', onClick: () => { void onApprove(row.id) } },
            { key: 'reject', label: '忽略', onClick: () => { void onReject(row.id) }, danger: true },
          ]}
        />
      ),
    },
  ]

  return all.filter((col) => visibleColumnIds.includes(col.id as SourceSubmissionColumnId))
}

export function SubmissionTable() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [showColumnsPanel, setShowColumnsPanel] = useState(false)

  const columnsState = useAdminTableColumns({
    route: '/admin/sources',
    tableId: 'source-submission-table',
    columns: SOURCE_SUBMISSION_COLUMNS_META,
    defaultState: SOURCE_SUBMISSION_DEFAULT_STATE,
  })

  const visibleColumnIds = useMemo(
    () =>
      columnsState.columns
        .filter((col) => col.visible)
        .map((col) => col.id as SourceSubmissionColumnId),
    [columnsState.columns],
  )

  const fetchSubmissions = useCallback(async (pageVal: number, pageSizeVal: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pageVal), limit: String(pageSizeVal) })
      const res = await apiClient.get<{ data: SubmissionRow[]; total: number }>(`/admin/submissions?${params}`)
      setSubmissions(res.data)
      setTotal(res.total)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { void fetchSubmissions(page, pageSize) }, [fetchSubmissions, page, pageSize])

  const handleApprove = useCallback(async (id: string) => {
    try {
      await apiClient.post(`/admin/submissions/${id}/approve`)
      void fetchSubmissions(page, pageSize)
    } catch { /* silent */ }
  }, [fetchSubmissions, page, pageSize])

  const handleReject = useCallback(async (id: string) => {
    try {
      await apiClient.post(`/admin/submissions/${id}/reject`, {})
      void fetchSubmissions(page, pageSize)
    } catch { /* silent */ }
  }, [fetchSubmissions, page, pageSize])

  const tableColumns = useMemo(
    () => buildColumns(handleApprove, handleReject, visibleColumnIds, columnsState.columnsById),
    [handleApprove, handleReject, visibleColumnIds, columnsState.columnsById],
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
            data-testid="source-submission-columns-toggle"
            aria-label="列设置"
            title="列设置"
          >⚙</button>
          {showColumnsPanel ? (
            <div className="absolute right-0 mt-1 w-52">
              <ColumnSettingsPanel
                data-testid="source-submission-columns-panel"
                columns={columnsState.columns.map((col) => ({
                  id: col.id,
                  label: SOURCE_SUBMISSION_COLUMN_LABELS[col.id as SourceSubmissionColumnId] ?? col.id,
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
          rows={submissions}
          loading={loading}
          emptyText="暂无用户纠错数据"
          getRowId={(r) => r.id}
          scrollTestId="source-submission-table-scroll"
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
            onPageChange={(nextPage) => { setPage(nextPage); void fetchSubmissions(nextPage, pageSize) }}
            onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1); void fetchSubmissions(1, nextSize) }}
          />
        </div>
      ) : null}
    </div>
  )
}
