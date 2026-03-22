import { useAdminTableState, type AdminTableState } from '@/components/admin/shared/table/useAdminTableState'

const DEFAULT_DEMO_STATE: AdminTableState = {
  sort: { field: 'name', dir: 'asc' },
  pagination: { page: 1, pageSize: 20 },
  filters: { keyword: '' },
}

// Demo-only usage sample. This component is not mounted in production pages.
export function AdminTableStateDemoUsage() {
  const tableState = useAdminTableState({
    route: '/admin/demo',
    tableId: 'demo-table',
    defaultState: DEFAULT_DEMO_STATE,
  })

  void tableState
  return null
}
