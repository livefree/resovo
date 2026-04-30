/**
 * useTableQuery saved views API 单测（CHG-DESIGN-02 Step 6/7）
 * 覆盖：
 *   - saveView 写入 sessionStorage + 推回 store + 返回 view 对象
 *   - applyView(id|view) 把 query 替换为 view 内容（不动 selection）
 *   - deleteView 移除 + storage 同步
 *   - readFromStorage 还原 views 中 query 的 Map 结构
 *   - writeToStorage 不丢弃既有 views（snapshot 写入与 views 写入互不覆盖）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableQuery } from '../../../../../packages/admin-ui/src/components/data-table/use-table-query'
import {
  tableQueryStore,
  buildDefaultSnapshot,
} from '../../../../../packages/admin-ui/src/components/data-table/table-query-store'
import {
  readFromStorage,
  writeToStorage,
  writeViewsToStorage,
} from '../../../../../packages/admin-ui/src/components/data-table/storage-sync'
import type {
  ColumnDescriptor,
  TableRouterAdapter,
  TableQuerySnapshot,
  TableView,
} from '../../../../../packages/admin-ui/src/components/data-table/types'

const COLS: ColumnDescriptor[] = [
  { id: 'name', header: 'Name', defaultVisible: true },
  { id: 'score', header: 'Score', defaultVisible: true },
]

function makeRouter(): TableRouterAdapter {
  const params = new URLSearchParams()
  return {
    getSearchParams: () => params,
    replace: vi.fn(),
  }
}

function resetStore() {
  tableQueryStore.setState({ snapshots: new Map(), views: new Map() })
}

function clearStorage() {
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.clear() } catch { /* ignore */ }
  }
}

describe('useTableQuery — saveView / applyView / deleteView', () => {
  beforeEach(() => {
    resetStore()
    clearStorage()
  })

  it('saveView：返回包含 id/label/scope/query/createdAt/updatedAt 的 TableView', () => {
    const { result } = renderHook(() =>
      useTableQuery({
        tableId: 'tbl-1',
        router: makeRouter(),
        defaults: { pagination: { page: 1, pageSize: 20 } },
        columns: COLS,
      }),
    )
    let view: TableView | undefined
    act(() => {
      view = result.current.saveView('我的视图', 'personal')
    })
    expect(view).toBeDefined()
    expect(view?.label).toBe('我的视图')
    expect(view?.scope).toBe('personal')
    expect(typeof view?.id).toBe('string')
    expect((view?.id ?? '').length).toBeGreaterThan(0)
    expect(view?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(view?.updatedAt).toBe(view?.createdAt)
    expect(view?.query.pagination).toBeDefined()
    expect((view?.query as Record<string, unknown>)['selection']).toBeUndefined()
  })

  it('saveView：推回 store，下次 read views 包含新视图', () => {
    const { result } = renderHook(() =>
      useTableQuery({
        tableId: 'tbl-1',
        router: makeRouter(),
        defaults: { pagination: { page: 1, pageSize: 20 } },
        columns: COLS,
      }),
    )
    expect(result.current.views.length).toBe(0)
    act(() => {
      result.current.saveView('视图 A', 'personal')
    })
    expect(result.current.views.length).toBe(1)
    expect(result.current.views[0]?.label).toBe('视图 A')
  })

  it('saveView：持久化到 sessionStorage（刷新页面后仍可读取）', () => {
    const { result } = renderHook(() =>
      useTableQuery({
        tableId: 'tbl-1',
        router: makeRouter(),
        defaults: { pagination: { page: 1, pageSize: 20 } },
        columns: COLS,
      }),
    )
    act(() => {
      result.current.saveView('Persist Me', 'personal')
    })
    const stored = readFromStorage('tbl-1')
    expect(stored?.views?.length).toBe(1)
    expect(stored?.views?.[0]?.label).toBe('Persist Me')
  })

  it('applyView(id)：把 query 替换为 view 内容（不动 selection）', () => {
    const { result } = renderHook(() =>
      useTableQuery({
        tableId: 'tbl-1',
        router: makeRouter(),
        defaults: { pagination: { page: 1, pageSize: 20 } },
        columns: COLS,
      }),
    )
    act(() => result.current.patch({ pagination: { page: 3 } }))
    expect(result.current.snapshot.pagination.page).toBe(3)
    let savedId = ''
    act(() => {
      savedId = result.current.saveView('保存 page=3', 'personal').id
    })
    act(() => result.current.patch({ pagination: { page: 1 } }))
    expect(result.current.snapshot.pagination.page).toBe(1)
    act(() => result.current.applyView(savedId))
    expect(result.current.snapshot.pagination.page).toBe(3)
  })

  it('applyView 不存在的 id → console.warn + 不变', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() =>
      useTableQuery({
        tableId: 'tbl-1',
        router: makeRouter(),
        defaults: { pagination: { page: 1, pageSize: 20 } },
        columns: COLS,
      }),
    )
    const before = result.current.snapshot
    act(() => result.current.applyView('not-exist'))
    expect(warnSpy).toHaveBeenCalled()
    expect(result.current.snapshot.pagination.page).toBe(before.pagination.page)
    warnSpy.mockRestore()
  })

  it('deleteView：从 store + sessionStorage 移除', () => {
    const { result } = renderHook(() =>
      useTableQuery({
        tableId: 'tbl-1',
        router: makeRouter(),
        defaults: { pagination: { page: 1, pageSize: 20 } },
        columns: COLS,
      }),
    )
    let id1 = ''
    let id2 = ''
    act(() => {
      id1 = result.current.saveView('A', 'personal').id
      id2 = result.current.saveView('B', 'personal').id
    })
    expect(result.current.views.length).toBe(2)
    act(() => result.current.deleteView(id1))
    expect(result.current.views.length).toBe(1)
    expect(result.current.views[0]?.id).toBe(id2)
    const stored = readFromStorage('tbl-1')
    expect(stored?.views?.length).toBe(1)
    expect(stored?.views?.[0]?.id).toBe(id2)
  })
})

describe('storage-sync — views schema 兼容性', () => {
  beforeEach(() => clearStorage())

  it('writeToStorage 后 writeViewsToStorage 互不覆盖', () => {
    const snap: TableQuerySnapshot = buildDefaultSnapshot(COLS, undefined)
    writeToStorage('tbl-x', snap)
    expect(readFromStorage('tbl-x')?.pageSize).toBe(20)

    const view: TableView = {
      id: 'v1',
      label: 'A',
      scope: 'personal',
      query: {
        pagination: { page: 1, pageSize: 20 },
        sort: { field: undefined, direction: 'asc' },
        filters: new Map(),
        columns: new Map(),
      },
      createdAt: '2026-04-29T00:00:00Z',
      updatedAt: '2026-04-29T00:00:00Z',
    }
    writeViewsToStorage('tbl-x', [view])

    const stored = readFromStorage('tbl-x')
    expect(stored?.pageSize).toBe(20)
    expect(stored?.views?.length).toBe(1)
  })

  it('writeViewsToStorage 后 writeToStorage 互不覆盖', () => {
    const view: TableView = {
      id: 'v2',
      label: 'B',
      scope: 'personal',
      query: {
        pagination: { page: 2, pageSize: 50 },
        sort: { field: undefined, direction: 'asc' },
        filters: new Map(),
        columns: new Map(),
      },
      createdAt: '2026-04-29T00:00:00Z',
      updatedAt: '2026-04-29T00:00:00Z',
    }
    writeViewsToStorage('tbl-y', [view])
    const snap = buildDefaultSnapshot(COLS, { pagination: { page: 1, pageSize: 100 } })
    writeToStorage('tbl-y', snap)

    const stored = readFromStorage('tbl-y')
    expect(stored?.pageSize).toBe(100)
    expect(stored?.views?.length).toBe(1)
    expect(stored?.views?.[0]?.id).toBe('v2')
  })

  it('readFromStorage 还原 views 中 query.filters 的 Map 结构', () => {
    const view: TableView = {
      id: 'v3',
      label: 'C',
      scope: 'personal',
      query: {
        pagination: { page: 1, pageSize: 20 },
        sort: { field: undefined, direction: 'asc' },
        filters: new Map([['type', { kind: 'text', value: 'movie' }]]),
        columns: new Map([['name', { visible: true }]]),
      },
      createdAt: '2026-04-29T00:00:00Z',
      updatedAt: '2026-04-29T00:00:00Z',
    }
    writeViewsToStorage('tbl-z', [view])
    const stored = readFromStorage('tbl-z')
    const restored = stored?.views?.[0]
    expect(restored).toBeDefined()
    expect(restored?.query.filters instanceof Map).toBe(true)
    expect(restored?.query.columns instanceof Map).toBe(true)
    expect(restored?.query.filters.get('type')).toEqual({ kind: 'text', value: 'movie' })
  })
})
