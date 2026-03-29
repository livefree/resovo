import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'

// Demo-only usage sample. This component is not mounted in production pages.
export function AdminTableSortDemoUsage() {
  const sort = useAdminTableSort({
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
