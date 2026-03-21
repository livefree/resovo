import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAdminTableColumns } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminColumnFilter } from '@/components/admin/shared/table/useAdminColumnFilter'
import type { AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'

const FILTER_COLUMNS: AdminColumnMeta[] = [
  { id: 'name', width: 220 },
  { id: 'status', width: 120 },
]

const FILTER_DEFAULT_STATE = {
  filters: {
    name: '',
    status: null,
  },
} as const

function useFilterHarness(route = '/admin/filter-test', tableId = 'filter-table') {
  const columns = useAdminTableColumns({
    route,
    tableId,
    columns: FILTER_COLUMNS,
    defaultState: FILTER_DEFAULT_STATE,
  })

  const filter = useAdminColumnFilter({
    tableState: columns,
    columnsById: columns.columnsById,
  })

  return { columns, filter }
}

describe('useAdminColumnFilter', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('supports column filter open/close state', () => {
    const { result } = renderHook(() => useFilterHarness())

    expect(result.current.filter.isFilterOpen('name')).toBe(false)

    act(() => {
      result.current.filter.openFilter('name')
    })
    expect(result.current.filter.isFilterOpen('name')).toBe(true)

    act(() => {
      result.current.filter.closeFilter('name')
    })
    expect(result.current.filter.isFilterOpen('name')).toBe(false)
  })

  it('supports clear column filter and active check', () => {
    const { result } = renderHook(() => useFilterHarness('/admin/filter-clear', 'filter-table'))

    expect(result.current.filter.isColumnFiltered('name')).toBe(false)

    act(() => {
      result.current.filter.setColumnFilterValue('name', 'alpha')
    })

    expect(result.current.filter.getColumnFilterValue('name')).toBe('alpha')
    expect(result.current.filter.isColumnFiltered('name')).toBe(true)

    act(() => {
      result.current.filter.clearColumnFilter('name')
    })

    expect(result.current.filter.getColumnFilterValue('name')).toBe(null)
    expect(result.current.filter.isColumnFiltered('name')).toBe(false)
  })

  it('treats boolean filter value as active', () => {
    const { result } = renderHook(() => useFilterHarness('/admin/filter-bool', 'filter-table'))

    act(() => {
      result.current.filter.setColumnFilterValue('status', false)
    })

    expect(result.current.filter.isColumnFiltered('status')).toBe(true)
  })

  it('provides render context API', () => {
    const { result } = renderHook(() => useFilterHarness('/admin/filter-context', 'filter-table'))

    act(() => {
      result.current.filter.openFilter('name')
      result.current.filter.setColumnFilterValue('name', 'hello')
    })

    const context = result.current.filter.getFilterRenderContext('name')
    expect(context.open).toBe(true)
    expect(context.active).toBe(true)
    expect(context.value).toBe('hello')
  })
})
