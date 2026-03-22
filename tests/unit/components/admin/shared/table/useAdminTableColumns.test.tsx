import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  adaptColumnsState,
  useAdminTableColumns,
  type AdminColumnMeta,
} from '@/components/admin/shared/table/useAdminTableColumns'
import {
  buildAdminTableStorageKey,
  serializeAdminTableState,
} from '@/components/admin/shared/table/useAdminTableState'

const COLUMNS: AdminColumnMeta[] = [
  { id: 'name', visible: true, width: 220, minWidth: 120, maxWidth: 400, resizable: true },
  { id: 'status', visible: true, width: 140, minWidth: 100, maxWidth: 220, resizable: true },
  { id: 'actions', visible: true, width: 120, minWidth: 120, maxWidth: 180, resizable: false },
]

describe('useAdminTableColumns', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('merges default column meta with persisted values', () => {
    const merged = adaptColumnsState(COLUMNS, {
      name: { visible: false, width: 350 },
      status: { visible: true, width: 999 },
    })

    expect(merged.find((item) => item.id === 'name')).toMatchObject({
      visible: false,
      width: 350,
    })
    expect(merged.find((item) => item.id === 'status')).toMatchObject({
      visible: true,
      width: 220,
    })
    expect(merged.find((item) => item.id === 'actions')).toMatchObject({
      visible: true,
      width: 120,
    })
  })

  it('updates width via API and respects non-resizable columns', async () => {
    const route = '/admin/test-columns'
    const tableId = 'columns-table'
    const key = buildAdminTableStorageKey(route, tableId)

    const { result } = renderHook(() => (
      useAdminTableColumns({ route, tableId, columns: COLUMNS })
    ))

    act(() => {
      result.current.setColumnWidth('name', 999)
      result.current.setColumnWidth('actions', 160)
    })

    expect(result.current.columnsById.name.width).toBe(400)
    expect(result.current.columnsById.actions.width).toBe(120)

    await waitFor(() => {
      const raw = localStorage.getItem(key)
      expect(raw).toBeTruthy()
      expect(raw).toContain('"name"')
    })
  })

  it('supports toggle visibility (hide and restore)', () => {
    const { result } = renderHook(() => (
      useAdminTableColumns({
        route: '/admin/test-visibility',
        tableId: 'visibility-table',
        columns: COLUMNS,
      })
    ))

    expect(result.current.columnsById.status.visible).toBe(true)

    act(() => {
      result.current.toggleColumnVisibility('status')
    })

    expect(result.current.columnsById.status.visible).toBe(false)

    act(() => {
      result.current.toggleColumnVisibility('status')
    })

    expect(result.current.columnsById.status.visible).toBe(true)
  })

  it('supports resize handlers and reset columns meta', () => {
    const route = '/admin/test-resize'
    const tableId = 'resize-table'

    const { result } = renderHook(() => (
      useAdminTableColumns({ route, tableId, columns: COLUMNS })
    ))

    act(() => {
      result.current.startResize('name', 100)
    })

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 180 }))
      window.dispatchEvent(new MouseEvent('mouseup'))
    })

    expect(result.current.columnsById.name.width).toBe(300)

    act(() => {
      result.current.toggleColumnVisibility('status')
      result.current.resetColumnsMeta()
    })

    expect(result.current.columnsById.name.width).toBe(220)
    expect(result.current.columnsById.status.visible).toBe(true)
  })

  it('loads persisted metadata through useAdminTableState storage', () => {
    const route = '/admin/test-storage'
    const tableId = 'storage-table'
    const key = buildAdminTableStorageKey(route, tableId)

    localStorage.setItem(
      key,
      serializeAdminTableState({
        columns: {
          name: { visible: true, width: 180 },
          status: { visible: false, width: 100 },
        },
      }),
    )

    const { result } = renderHook(() => (
      useAdminTableColumns({ route, tableId, columns: COLUMNS })
    ))

    expect(result.current.columnsById.name.width).toBe(180)
    expect(result.current.columnsById.status.visible).toBe(false)
    expect(result.current.columnsById.actions.width).toBe(120)
  })
})
