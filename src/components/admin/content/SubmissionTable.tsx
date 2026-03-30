/**
 * SubmissionTable.tsx — 投稿审核表格（Client Component）
 * CHG-259: 迁移至 ModernDataTable + PaginationV2 + AdminDropdown + 服务端排序
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import { ReviewModal, type ReviewTarget } from '@/components/admin/content/ReviewModal'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { TableSortState } from '@/components/admin/shared/modern-table/types'
import { useAdminTableColumns } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings'
import {
  useSubmissionTableColumns,
  SUBMISSION_COLUMN_LABELS,
  SUBMISSION_SORTABLE_MAP,
  SUBMISSION_COLUMNS_META,
  SUBMISSION_DEFAULT_TABLE_STATE,
  type SubmissionRow,
  type SubmissionColumnId,
} from './useSubmissionTableColumns'

// 所有列 ID（useTableSettings 控制显/隐）
const ALL_SUBMISSION_COLUMN_IDS = SUBMISSION_COLUMNS_META.map((col) => col.id as SubmissionColumnId)

// useTableSettings 列描述（label + 默认可见/可排序）
const SUBMISSION_SETTINGS_COLUMNS = SUBMISSION_COLUMNS_META.map((col) => ({
  id: col.id,
  label: SUBMISSION_COLUMN_LABELS[col.id as SubmissionColumnId] ?? col.id,
  defaultVisible: col.visible ?? true,
  defaultSortable: SUBMISSION_SORTABLE_MAP[col.id as SubmissionColumnId] ?? false,
  required: col.id === 'actions',
}))

const DEFAULT_PAGE_SIZE = 20

export function SubmissionTable() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)
  const columnsState = useAdminTableColumns({
    route: '/admin/content',
    tableId: 'submission-table',
    columns: SUBMISSION_COLUMNS_META,
    defaultState: SUBMISSION_DEFAULT_TABLE_STATE,
  })

  const sortState = useAdminTableSort({
    defaultSort: SUBMISSION_DEFAULT_TABLE_STATE.sort,
    sortable: SUBMISSION_SORTABLE_MAP,
  })

  const tableSettings = useTableSettings({
    tableId: 'submission-table',
    columns: SUBMISSION_SETTINGS_COLUMNS,
  })

  const sort = useMemo<TableSortState | undefined>(() => {
    if (!sortState.sort) return undefined
    return { field: sortState.sort.field, direction: sortState.sort.dir }
  }, [sortState.sort])

  const allTableColumns = useSubmissionTableColumns({
    visibleColumnIds: ALL_SUBMISSION_COLUMN_IDS,
    columnsById: columnsState.columnsById,
    setReviewTarget,
  })

  const tableColumns = useMemo(
    () => tableSettings.applyToColumns(allTableColumns),
    [tableSettings, allTableColumns],
  )

  const fetchSubmissions = useCallback(async (pageVal: number, pageSizeVal: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pageVal),
        limit: String(pageSizeVal),
      })
      if (sortState.sort) {
        params.set('sortField', sortState.sort.field)
        params.set('sortDir', sortState.sort.dir)
      }
      const res = await apiClient.get<{ data: SubmissionRow[]; total: number }>(
        `/admin/submissions?${params}`
      )
      setSubmissions(res.data)
      setTotal(res.total)
    } catch {
      // fetch failed: table remains showing previous data
    } finally {
      setLoading(false)
    }
  }, [sortState.sort])

  useEffect(() => {
    setPage(1)
    void fetchSubmissions(1, pageSize)
  }, [sortState.sort, pageSize, fetchSubmissions])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function handleApprove(id: string) {
    await apiClient.post(`/admin/submissions/${id}/approve`)
    showToast('已通过，ES 索引已加入同步队列')
    void fetchSubmissions(page, pageSize)
  }

  async function handleReject(id: string, _type: ReviewTarget['type'], reason: string) {
    await apiClient.post(`/admin/submissions/${id}/reject`, { reason })
    void fetchSubmissions(page, pageSize)
  }

  return (
    <div data-testid="submission-table" className="space-y-2">
      {toast && (
        <div
          className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-400"
          data-testid="submission-toast"
        >
          {toast}
        </div>
      )}

      <ModernDataTable
        columns={tableColumns}
        rows={submissions}
        sort={sort}
        onSortChange={(nextSort) => {
          sortState.setSort(nextSort.field, nextSort.direction === 'asc' ? 'asc' : 'desc')
        }}
        onColumnWidthChange={tableSettings.updateWidth}
        loading={loading}
        emptyText="暂无待审投稿"
        scrollTestId="submission-table-scroll"
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
            onPageChange={(nextPage) => { setPage(nextPage); void fetchSubmissions(nextPage, pageSize) }}
            onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1); void fetchSubmissions(1, nextSize) }}
          />
        </div>
      ) : null}

      <ReviewModal
        open={reviewTarget !== null}
        target={reviewTarget}
        onClose={() => setReviewTarget(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  )
}
