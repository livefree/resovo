import {
  useAdminTableColumns,
  type AdminColumnMeta,
} from '@/components/admin/shared/table/useAdminTableColumns'

const DEMO_COLUMNS: AdminColumnMeta[] = [
  { id: 'name', width: 220, minWidth: 160, maxWidth: 360, visible: true, resizable: true },
  { id: 'status', width: 120, minWidth: 96, maxWidth: 200, visible: true, resizable: true },
  { id: 'actions', width: 140, minWidth: 120, maxWidth: 220, visible: true, resizable: false },
]

// Demo-only usage sample. This component is not mounted in production pages.
export function AdminTableColumnsDemoUsage() {
  const columnsState = useAdminTableColumns({
    route: '/admin/demo-columns',
    tableId: 'demo-columns-table',
    columns: DEMO_COLUMNS,
  })

  void columnsState
  return null
}
