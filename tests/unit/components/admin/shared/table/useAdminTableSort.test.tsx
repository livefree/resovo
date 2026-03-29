import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAdminTableSort } from '@/components/admin/shared/table/useAdminTableSort'

describe('useAdminTableSort (CHG-312)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('supports toggleSort and clearSort', () => {
    const { result } = renderHook(() =>
      useAdminTableSort({
        defaultSort: { field: 'name', dir: 'asc' },
        sortable: { name: true, status: true, actions: false },
      }),
    )

    expect(result.current.sort).toEqual({ field: 'name', dir: 'asc' })

    act(() => {
      result.current.toggleSort('name')
    })
    expect(result.current.sort).toEqual({ field: 'name', dir: 'desc' })

    act(() => {
      result.current.clearSort()
    })
    expect(result.current.sort).toEqual({ field: 'name', dir: 'asc' })
  })

  it('blocks non-sortable columns', () => {
    const { result } = renderHook(() =>
      useAdminTableSort({
        defaultSort: { field: 'name', dir: 'asc' },
        sortable: { name: true, status: true, actions: false },
      }),
    )

    act(() => {
      result.current.toggleSort('actions')
    })

    expect(result.current.sort).toEqual({ field: 'name', dir: 'asc' })
    expect(result.current.isSortable('actions')).toBe(false)
    expect(result.current.isSortable('name')).toBe(true)
  })

  it('setSort switches field and direction', () => {
    const { result } = renderHook(() =>
      useAdminTableSort({
        defaultSort: { field: 'name', dir: 'asc' },
        sortable: { name: true, status: true, actions: false },
      }),
    )

    act(() => {
      result.current.setSort('status', 'desc')
    })

    expect(result.current.sort).toEqual({ field: 'status', dir: 'desc' })
    expect(result.current.isSortedBy('status')).toBe(true)
    expect(result.current.isSortedBy('name')).toBe(false)
  })
})
