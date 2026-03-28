import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import {
  ADMIN_TABLE_STATE_VERSION,
  buildAdminTableStorageKey,
  deserializeAdminTableState,
  serializeAdminTableState,
  useAdminTableState,
  type AdminTableState,
} from '@/components/admin/shared/table/useAdminTableState'

const DEFAULT_STATE: AdminTableState = {
  sort: { field: 'name', dir: 'asc' },
  columns: {
    name: { visible: true, width: 180 },
    status: { visible: true, width: 120 },
  },
  pagination: { page: 1, pageSize: 20 },
  filters: { keyword: '', enabled: true },
  scroll: { top: 0, left: 0 },
}

describe('useAdminTableState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reads/writes state with v1 payload', async () => {
    const route = '/admin/videos'
    const tableId = 'video-table'
    const key = buildAdminTableStorageKey(route, tableId)

    const { result, unmount } = renderHook(() => (
      useAdminTableState({ route, tableId, defaultState: DEFAULT_STATE })
    ))

    expect(result.current.storageKey).toBe(key)
    expect(result.current.getState().sort?.field).toBe('name')

    act(() => {
      result.current.setState({
        ...DEFAULT_STATE,
        sort: { field: 'createdAt', dir: 'desc' },
      })
    })

    await waitFor(() => {
      const raw = localStorage.getItem(key)
      expect(raw).toBeTruthy()
      const parsed = deserializeAdminTableState(raw ?? '')
      expect(parsed?.version).toBe(ADMIN_TABLE_STATE_VERSION)
      expect(parsed?.state.sort).toEqual({ field: 'createdAt', dir: 'desc' })
    })

    unmount()

    const { result: remountResult } = renderHook(() => (
      useAdminTableState({ route, tableId, defaultState: DEFAULT_STATE })
    ))

    await waitFor(() => {
      expect(remountResult.current.state.sort).toEqual({ field: 'createdAt', dir: 'desc' })
    })
  })

  it('merges default state with partial state from storage', async () => {
    const route = '/admin/sources'
    const tableId = 'source-table'
    const key = buildAdminTableStorageKey(route, tableId)

    const partialState: AdminTableState = {
      columns: {
        name: { visible: false },
      },
      filters: {
        keyword: 'abc',
      },
    }

    localStorage.setItem(key, serializeAdminTableState(partialState))

    const { result } = renderHook(() => (
      useAdminTableState({ route, tableId, defaultState: DEFAULT_STATE })
    ))

    await waitFor(() => {
      expect(result.current.state.columns?.name).toEqual({ visible: false, width: 180 })
      expect(result.current.state.columns?.status).toEqual({ visible: true, width: 120 })
      expect(result.current.state.filters).toEqual({ keyword: 'abc', enabled: true })
      expect(result.current.state.pagination).toEqual({ page: 1, pageSize: 20 })
    })
  })

  it('resets invalid version payload to default state', async () => {
    const route = '/admin/users'
    const tableId = 'user-table'
    const key = buildAdminTableStorageKey(route, tableId)

    localStorage.setItem(
      key,
      JSON.stringify({
        version: 'v0',
        state: {
          sort: { field: 'email', dir: 'desc' },
        },
      }),
    )

    const { result } = renderHook(() => (
      useAdminTableState({ route, tableId, defaultState: DEFAULT_STATE })
    ))

    expect(result.current.state).toEqual(DEFAULT_STATE)

    await waitFor(() => {
      const raw = localStorage.getItem(key)
      const parsed = deserializeAdminTableState(raw ?? '')
      expect(parsed?.version).toBe(ADMIN_TABLE_STATE_VERSION)
      expect(parsed?.state).toEqual(DEFAULT_STATE)
    })
  })

  it('supports updatePartial and reset API', async () => {
    const route = '/admin/subtitles'
    const tableId = 'subtitle-table'
    const key = buildAdminTableStorageKey(route, tableId)

    const { result } = renderHook(() => (
      useAdminTableState({ route, tableId, defaultState: DEFAULT_STATE })
    ))

    act(() => {
      result.current.updatePartial({
        sort: { field: 'updatedAt', dir: 'desc' },
        pagination: { page: 3, pageSize: 50 },
      })
    })

    expect(result.current.state.sort).toEqual({ field: 'updatedAt', dir: 'desc' })
    expect(result.current.state.pagination).toEqual({ page: 3, pageSize: 50 })

    act(() => {
      result.current.reset()
    })

    expect(result.current.state).toEqual(DEFAULT_STATE)

    await waitFor(() => {
      const raw = localStorage.getItem(key)
      const parsed = deserializeAdminTableState(raw ?? '')
      expect(parsed?.state).toEqual(DEFAULT_STATE)
    })
  })
})
