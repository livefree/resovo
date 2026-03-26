import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useColumnResize } from '@/components/admin/shared/modern-table/useColumnResize'

describe('useColumnResize (CHG-207)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('applies deltaX to width while resizing', () => {
    const { result } = renderHook(() => useColumnResize({
      tableId: 'video-table',
      initialWidths: { title: 300 },
    }))

    act(() => {
      result.current.startResize('title', 100, 300)
      result.current.updateResize(140)
    })

    expect(result.current.columnWidths.title).toBe(340)
    expect(result.current.resizingColumnId).toBe('title')
  })

  it('enforces min width constraint', () => {
    const { result } = renderHook(() => useColumnResize({
      tableId: 'video-table-min',
      initialWidths: { title: 300 },
      minWidths: { title: 120 },
    }))

    act(() => {
      result.current.startResize('title', 200, 300)
      result.current.updateResize(-1000)
    })

    expect(result.current.columnWidths.title).toBe(120)
  })

  it('persists widths on endResize and restores on remount', () => {
    const first = renderHook(() => useColumnResize({
      tableId: 'video-table-persist',
      initialWidths: { title: 300 },
    }))

    act(() => {
      first.result.current.startResize('title', 100, 300)
      first.result.current.updateResize(180)
      first.result.current.endResize()
    })

    first.unmount()

    const second = renderHook(() => useColumnResize({
      tableId: 'video-table-persist',
    }))

    expect(second.result.current.columnWidths.title).toBe(380)
  })

  it('setColumnWidth writes normalized positive width', () => {
    const { result } = renderHook(() => useColumnResize({
      tableId: 'video-table-set-width',
      minWidths: { status: 96 },
    }))

    act(() => {
      result.current.setColumnWidth('status', 1)
    })
    expect(result.current.columnWidths.status).toBe(96)
  })
})
