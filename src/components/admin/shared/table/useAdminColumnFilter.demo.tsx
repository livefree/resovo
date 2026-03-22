import { AdminColumnFilterContainer } from '@/components/admin/shared/table/AdminColumnFilterContainer'
import { useAdminTableColumns } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminColumnFilter } from '@/components/admin/shared/table/useAdminColumnFilter'

// Demo-only usage sample. This component is not mounted in production pages.
export function AdminColumnFilterDemoUsage() {
  const tableColumns = useAdminTableColumns({
    route: '/admin/demo-filter',
    tableId: 'demo-filter-table',
    columns: [
      { id: 'name', width: 220 },
      { id: 'status', width: 120 },
    ],
    defaultState: {
      filters: {
        name: '',
        status: null,
      },
    },
  })

  const columnFilter = useAdminColumnFilter({
    tableState: tableColumns,
    columnsById: tableColumns.columnsById,
  })

  const context = columnFilter.getFilterRenderContext('name')

  return (
    <AdminColumnFilterContainer context={context}>
      {() => null}
    </AdminColumnFilterContainer>
  )
}
