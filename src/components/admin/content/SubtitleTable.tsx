/**
 * SubtitleTable.tsx — 字幕审核表格（Client Component）
 * CHG-260: 迁移至 ModernDataTable + PaginationV2 + AdminDropdown + 服务端排序
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import { ReviewModal, type ReviewTarget } from '@/components/admin/content/ReviewModal'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings'
import type { TableSortState } from '@/components/admin/shared/modern-table/types'
import { useAdminTableColumns } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import {
  useSubtitleTableColumns,
  SUBTITLE_COLUMN_LABELS,
  SUBTITLE_SORTABLE_MAP,
  SUBTITLE_COLUMNS_META,
  SUBTITLE_DEFAULT_TABLE_STATE,
  type SubtitleRow,
  type SubtitleColumnId,
} from './useSubtitleTableColumns'

const SUBTITLE_SETTINGS_COLUMNS = SUBTITLE_COLUMNS_META.map((col) => ({
  id: col.id,
  label: SUBTITLE_COLUMN_LABELS[col.id as SubtitleColumnId] ?? col.id,
  defaultVisible: col.visible ?? true,
  defaultSortable: SUBTITLE_SORTABLE_MAP[col.id as SubtitleColumnId] ?? false,
}))

const DEFAULT_PAGE_SIZE = 20

export function SubtitleTable() {
  const [subtitles, setSubtitles] = useState<SubtitleRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)
  const columnsState = useAdminTableColumns({
    route: '/admin/content',
    tableId: 'subtitle-table',
    columns: SUBTITLE_COLUMNS_META,
    defaultState: SUBTITLE_DEFAULT_TABLE_STATE,
  })

  const sortState = useAdminTableSort({
    tableState: columnsState,
    columnsById: columnsState.columnsById,
    defaultSort: SUBTITLE_DEFAULT_TABLE_STATE.sort,
    sortable: SUBTITLE_SORTABLE_MAP,
  })

  const tableSettings = useTableSettings({
    tableId: 'subtitle-table',
    columns: SUBTITLE_SETTINGS_COLUMNS,
  })

  const sort = useMemo<TableSortState | undefined>(() => {
    if (!sortState.sort) return undefined
    return { field: sortState.sort.field, direction: sortState.sort.dir }
  }, [sortState.sort])

  const allTableColumns = useSubtitleTableColumns({
    columnsById: columnsState.columnsById,
    setReviewTarget,
  })

  const tableColumns = useMemo(
    () => tableSettings.applyToColumns(allTableColumns),
    [tableSettings, allTableColumns],
  )

  const fetchSubtitles = useCallback(async (pageVal: number, pageSizeVal: number) => {
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
      const res = await apiClient.get<{ data: SubtitleRow[]; total: number }>(
        `/admin/subtitles?${params}`
      )
      setSubtitles(res.data)
      setTotal(res.total)
    } catch {
      // fetch failed: table remains showing previous data
    } finally {
      setLoading(false)
    }
  }, [sortState.sort])

  useEffect(() => {
    setPage(1)
    void fetchSubtitles(1, pageSize)
  }, [sortState.sort, pageSize, fetchSubtitles])

  async function handleApprove(id: string) {
    await apiClient.post(`/admin/subtitles/${id}/approve`)
    void fetchSubtitles(page, pageSize)
  }

  async function handleReject(id: string, _type: ReviewTarget['type'], reason: string) {
    await apiClient.post(`/admin/subtitles/${id}/reject`, { reason })
    void fetchSubtitles(page, pageSize)
  }

  return (
    <div data-testid="subtitle-table" className="space-y-2">
      <ModernDataTable
        columns={tableColumns}
        rows={subtitles}
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
        emptyText="暂无待审字幕"
        scrollTestId="subtitle-table-scroll"
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
            onPageChange={(nextPage) => { setPage(nextPage); void fetchSubtitles(nextPage, pageSize) }}
            onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1); void fetchSubtitles(1, nextSize) }}
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
