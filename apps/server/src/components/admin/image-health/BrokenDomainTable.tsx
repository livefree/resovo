'use client'

import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import { useTableSettings } from '@/components/admin/shared/modern-table/settings'
import { TableTextCell } from '@/components/admin/shared/modern-table/cells'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'
import type { BrokenDomainRow } from '@/services/image-health-stats.service'

type ColId = 'domain' | 'eventCount' | 'affectedVideos'

const COL_LABELS: Record<ColId, string> = {
  domain:         '域名',
  eventCount:     '事件总数',
  affectedVideos: '影响视频数',
}

const SETTINGS_COLUMNS = (Object.keys(COL_LABELS) as ColId[]).map((id) => ({
  id,
  label: COL_LABELS[id],
  defaultVisible: true,
  defaultSortable: false,
}))

function buildColumns(): TableColumn<BrokenDomainRow>[] {
  return [
    {
      id: 'domain', header: COL_LABELS.domain,
      width: 320, minWidth: 200, enableResizing: true,
      accessor: (r) => r.domain,
      cell: ({ row }) => <TableTextCell value={row.domain} />,
    },
    {
      id: 'eventCount', header: COL_LABELS.eventCount,
      width: 140, minWidth: 100, enableResizing: true,
      accessor: (r) => r.eventCount,
      cell: ({ row }) => (
        <span className="text-sm font-mono" style={{ color: 'var(--status-danger)' }}>
          {row.eventCount.toLocaleString()}
        </span>
      ),
    },
    {
      id: 'affectedVideos', header: COL_LABELS.affectedVideos,
      width: 140, minWidth: 100, enableResizing: true,
      accessor: (r) => r.affectedVideos,
      cell: ({ row }) => <TableTextCell value={String(row.affectedVideos)} />,
    },
  ]
}

interface BrokenDomainTableProps {
  rows: BrokenDomainRow[]
  loading?: boolean
}

export function BrokenDomainTable({ rows, loading }: BrokenDomainTableProps) {
  const tableSettings = useTableSettings({
    tableId: 'image-health-broken-domains',
    columns: SETTINGS_COLUMNS,
  })

  const columns = buildColumns()

  return (
    <ModernDataTable
      columns={columns}
      rows={rows}
      loading={loading}
      emptyText="暂无破损域名数据"
      getRowId={(row) => row.domain}
      settingsSlot={{
        settingsColumns: tableSettings.orderedSettings,
        onSettingsChange: tableSettings.updateSetting,
        onSettingsReset: tableSettings.reset,
      }}
    />
  )
}
