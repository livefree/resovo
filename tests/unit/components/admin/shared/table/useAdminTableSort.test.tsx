import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAdminTableColumns } from '@/components/admin/shared/table/useAdminTableColumns'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'
import type { AdminColumnMeta } from '@/components/admin/shared/table/useAdminTableColumns'

const SORT_COLUMNS: AdminColumnMeta[] = [
  { id: 'name', width: 220, resizable: true },
  { id: 'status', width: 120, resizable: true },
  { id: 'actions', width: 120, resizable: false },
]

function useSortHarness(route = '/admin/sort-test', tableId = 'sort-table') {
  const columns = useAdminTableColumns({
    route,
    tableId,
    columns: SORT_COLUMNS,
  })

  const sort = useAdminTableSort({
    tableState: columns,
    columnsById: columns.columnsById,
    defaultSort: { field: 'name', dir: 'asc' },
    sortable: {
      name: true,
      status: true,
      actions: false,
    },
  })

  return { columns, sort }
}

describe('useAdminTableSort', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('supports toggleSort and clearSort', () => {
    const { result } = renderHook(() => useSortHarness())

    expect(result.current.sort.sort).toEqual({ field: 'name', dir: 'asc' })

    act(() => {
      result.current.sort.toggleSort('name')
    })
    expect(result.current.sort.sort).toEqual({ field: 'name', dir: 'desc' })

    act(() => {
      result.current.sort.clearSort()
    })
    expect(result.current.sort.sort).toEqual({ field: 'name', dir: 'asc' })
  })

  it('restores persisted sort state on remount', () => {
    const { result, unmount } = renderHook(() => useSortHarness('/admin/sort-restore', 'sort-table'))

    act(() => {
      result.current.sort.setSort('status', 'desc')
    })

    expect(result.current.sort.sort).toEqual({ field: 'status', dir: 'desc' })

    unmount()

    const { result: remountResult } = renderHook(() => (
      useSortHarness('/admin/sort-restore', 'sort-table')
    ))

    expect(remountResult.current.sort.sort).toEqual({ field: 'status', dir: 'desc' })
  })

  it('blocks non-sortable columns', () => {
    const { result } = renderHook(() => useSortHarness('/admin/sort-block', 'sort-table'))

    act(() => {
      result.current.sort.toggleSort('actions')
    })

    expect(result.current.sort.sort).toEqual({ field: 'name', dir: 'asc' })
    expect(result.current.sort.isSortable('actions')).toBe(false)
    expect(result.current.sort.isSortable('name')).toBe(true)
  })
})
