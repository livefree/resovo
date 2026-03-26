import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useModernTable } from '@/components/admin/shared/modern-table/useModernTable'

describe('useModernTable (CHG-206)', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('initializes with defaults and toggles sort direction', () => {
    const { result } = renderHook(() => useModernTable({
      tableId: 'video-table',
      defaultSort: { field: 'created_at', direction: 'desc' },
      syncSortToUrl: false,
    }))

    expect(result.current.sort).toEqual({ field: 'created_at', direction: 'desc' })

    act(() => {
      result.current.toggleSort('title')
    })
    expect(result.current.sort).toEqual({ field: 'title', direction: 'asc' })

    act(() => {
      result.current.toggleSort('title')
    })
    expect(result.current.sort).toEqual({ field: 'title', direction: 'desc' })
  })

  it('prefers URL sort params on first render and syncs updates back to URL', () => {
    window.history.replaceState({}, '', '/admin/videos?sortField=status&sortDir=asc&page=2')
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')

    const { result } = renderHook(() => useModernTable({
      tableId: 'video-table-url',
      defaultSort: { field: 'created_at', direction: 'desc' },
    }))

    expect(result.current.sort).toEqual({ field: 'status', direction: 'asc' })

    act(() => {
      result.current.setSort({ field: 'title', direction: 'desc' })
    })

    const url = new URL(window.location.href)
    expect(url.searchParams.get('sortField')).toBe('title')
    expect(url.searchParams.get('sortDir')).toBe('desc')
    expect(replaceStateSpy).toHaveBeenCalled()
  })

  it('persists and restores pagination + column width by tableId', () => {
    const first = renderHook(() => useModernTable({
      tableId: 'video-table-persist',
      syncSortToUrl: false,
      initialColumnWidths: { title: 300 },
    }))

    act(() => {
      first.result.current.setPage(3)
      first.result.current.setPageSize(50)
      first.result.current.setColumnWidth('title', 420)
    })

    first.unmount()

    const second = renderHook(() => useModernTable({
      tableId: 'video-table-persist',
      syncSortToUrl: false,
    }))

    expect(second.result.current.page).toBe(1)
    expect(second.result.current.pageSize).toBe(50)
    expect(second.result.current.columnWidths.title).toBe(420)
  })

  it('supports row selection helpers', () => {
    const { result } = renderHook(() => useModernTable({
      tableId: 'video-table-selection',
      syncSortToUrl: false,
    }))

    act(() => {
      result.current.toggleRow('v1')
    })
    expect(result.current.isRowSelected('v1')).toBe(true)

    act(() => {
      result.current.toggleAll(['v1', 'v2', 'v3'])
    })
    expect(result.current.isRowSelected('v1')).toBe(true)
    expect(result.current.isRowSelected('v2')).toBe(true)
    expect(result.current.isRowSelected('v3')).toBe(true)

    act(() => {
      result.current.toggleAll(['v1', 'v2', 'v3'])
    })
    expect(result.current.isRowSelected('v1')).toBe(false)
    expect(result.current.isRowSelected('v2')).toBe(false)
    expect(result.current.isRowSelected('v3')).toBe(false)

    act(() => {
      result.current.toggleRow('v9')
      result.current.clearSelection()
    })
    expect(result.current.selectedRowIds.size).toBe(0)
  })

  it('keeps and restores scroll position', () => {
    const { result } = renderHook(() => useModernTable({
      tableId: 'video-table-scroll',
      syncSortToUrl: false,
    }))

    const scrollElement = { scrollTop: 0, scrollLeft: 0 }

    act(() => {
      result.current.rememberScroll(120, 88)
      result.current.restoreScrollTo(scrollElement)
    })

    expect(result.current.scrollPosition).toEqual({ top: 120, left: 88 })
    expect(scrollElement.scrollTop).toBe(120)
    expect(scrollElement.scrollLeft).toBe(88)
  })
})
