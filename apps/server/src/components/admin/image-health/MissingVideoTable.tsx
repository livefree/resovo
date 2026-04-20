'use client'

import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import { PaginationV2 } from '@/components/admin/PaginationV2'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings'
import { TableTextCell, TableBadgeCell } from '@/components/admin/shared/modern-table/cells'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'
import type { MissingVideoRow } from '@/services/image-health-stats.service'

type ColId = 'title' | 'posterStatus'

const COL_LABELS: Record<ColId, string> = {
  title:        '视频标题',
  posterStatus: '封面状态',
}

const STATUS_TONE: Record<string, 'danger' | 'warning' | 'info'> = {
  broken:         'danger',
  missing:        'warning',
  pending_review: 'info',
}

const SETTINGS_COLUMNS = (Object.keys(COL_LABELS) as ColId[]).map((id) => ({
  id,
  label: COL_LABELS[id],
  defaultVisible: true,
  defaultSortable: false,
}))

function buildColumns(): TableColumn<MissingVideoRow>[] {
  return [
    {
      id: 'title', header: COL_LABELS.title,
      width: 400, minWidth: 200, enableResizing: true,
      accessor: (r) => r.title,
      cell: ({ row }) => <TableTextCell value={row.title} />,
    },
    {
      id: 'posterStatus', header: COL_LABELS.posterStatus,
      width: 160, minWidth: 120, enableResizing: true,
      accessor: (r) => r.posterStatus,
      cell: ({ row }) => (
        <TableBadgeCell
          label={row.posterStatus}
          tone={STATUS_TONE[row.posterStatus] ?? 'warning'}
        />
      ),
    },
  ]
}

interface MissingVideoTableProps {
  rows: MissingVideoRow[]
  total: number
  page: number
  pageSize: number
  loading?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function MissingVideoTable({
  rows, total, page, pageSize, loading,
  onPageChange, onPageSizeChange,
}: MissingVideoTableProps) {
  const tableSettings = useTableSettings({
    tableId: 'image-health-missing-videos',
    columns: SETTINGS_COLUMNS,
  })

  const columns = buildColumns()

  return (
    <div className="space-y-3">
      <ModernDataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyText="暂无缺图视频"
        getRowId={(row) => row.videoId}
        settingsSlot={{
          settingsColumns: tableSettings.orderedSettings,
          onSettingsChange: tableSettings.updateSetting,
          onSettingsReset: tableSettings.reset,
        }}
      />
      <PaginationV2
        page={page}
        total={total}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  )
}
