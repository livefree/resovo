import { useAdminTableColumns } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'

// Demo-only usage sample. This component is not mounted in production pages.
export function AdminTableSortDemoUsage() {
  const tableColumns = useAdminTableColumns({
    route: '/admin/demo-sort',
    tableId: 'demo-sort-table',
    columns: [
      { id: 'name', width: 220, resizable: true },
      { id: 'status', width: 120, resizable: true },
      { id: 'actions', width: 120, resizable: false },
    ],
  })

  const sort = useAdminTableSort({
    tableState: tableColumns,
    columnsById: tableColumns.columnsById,
    defaultSort: { field: 'name', dir: 'asc' },
    sortable: {
      name: true,
      status: true,
      actions: false,
    },
  })

  void sort
  return null
}
