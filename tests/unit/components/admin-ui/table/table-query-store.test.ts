/**
 * table-query-store 单测（CHG-SN-2-13）
 * 覆盖：buildDefaultSnapshot / applyPatch / store 多 tableId / setSnapshot / getSnapshot
 */
import { describe, it, expect } from 'vitest'
import {
  createTableQueryStore,
  buildDefaultSnapshot,
  applyPatch,
} from '../../../../../packages/admin-ui/src/components/data-table/table-query-store'
import type { ColumnDescriptor, TableQueryPatch } from '../../../../../packages/admin-ui/src/components/data-table/types'

const COLUMNS: ColumnDescriptor[] = [
  { id: 'title', header: 'Title', defaultVisible: true },
  { id: 'status', header: 'Status', defaultVisible: true },
  { id: 'hidden', header: 'Hidden', defaultVisible: false },
]

// ── buildDefaultSnapshot ─────────────────────────────────────────

describe('buildDefaultSnapshot', () => {
  it('defaults 未传时使用内置默认值', () => {
    const s = buildDefaultSnapshot(COLUMNS, undefined)
    expect(s.pagination).toEqual({ page: 1, pageSize: 20 })
    expect(s.sort).toEqual({ field: undefined, direction: 'asc' })
    expect(s.filters.size).toBe(0)
    expect(s.selection).toEqual({ selectedKeys: new Set(), mode: 'page' })
  })

  it('columns.defaultVisible=false 对应 visible=false', () => {
    const s = buildDefaultSnapshot(COLUMNS, undefined)
    expect(s.columns.get('hidden')?.visible).toBe(false)
    expect(s.columns.get('title')?.visible).toBe(true)
  })

  it('自定义 defaults 生效', () => {
    const s = buildDefaultSnapshot(COLUMNS, {
      pagination: { page: 2, pageSize: 50 },
      sort: { field: 'title', direction: 'desc' },
    })
    expect(s.pagination).toEqual({ page: 2, pageSize: 50 })
    expect(s.sort).toEqual({ field: 'title', direction: 'desc' })
  })

  it('columns map 包含所有列的 id', () => {
    const s = buildDefaultSnapshot(COLUMNS, undefined)
    expect(s.columns.has('title')).toBe(true)
    expect(s.columns.has('status')).toBe(true)
    expect(s.columns.has('hidden')).toBe(true)
    expect(s.columns.size).toBe(COLUMNS.length)
  })
})

// ── applyPatch ───────────────────────────────────────────────────

describe('applyPatch', () => {
  const base = buildDefaultSnapshot(COLUMNS, undefined)

  it('pagination patch 仅更新指定字段', () => {
    const result = applyPatch(base, { pagination: { page: 3 } })
    expect(result.pagination).toEqual({ page: 3, pageSize: 20 })
  })

  it('sort patch 替换 sort', () => {
    const result = applyPatch(base, { sort: { field: 'title', direction: 'desc' } })
    expect(result.sort).toEqual({ field: 'title', direction: 'desc' })
  })

  it('filters patch 替换整个 filters map', () => {
    const newFilters = new Map([['title', { kind: 'text', value: 'foo' }] as const])
    const result = applyPatch(base, { filters: newFilters })
    expect(result.filters.get('title')).toEqual({ kind: 'text', value: 'foo' })
  })

  it('columns patch 替换整个 columns map', () => {
    const newCols = new Map([['title', { visible: false }] as const])
    const result = applyPatch(base, { columns: newCols })
    expect(result.columns.get('title')?.visible).toBe(false)
    // other columns untouched (map replaced entirely)
    expect(result.columns.has('status')).toBe(false)
  })

  it('selection patch 替换 selection', () => {
    const result = applyPatch(base, {
      selection: { selectedKeys: new Set(['row-1']), mode: 'page' },
    })
    expect(result.selection.selectedKeys.has('row-1')).toBe(true)
  })

  it('空 patch 不改变 snapshot', () => {
    const result = applyPatch(base, {})
    expect(result).toEqual(base)
  })

  it('sort + filter patch 同时生效', () => {
    const filters = new Map([['status', { kind: 'enum', value: ['approved'] }] as const])
    const result = applyPatch(base, {
      sort: { field: 'status', direction: 'asc' },
      filters,
    })
    expect(result.sort.field).toBe('status')
    expect(result.filters.has('status')).toBe(true)
  })
})

// ── store 多 tableId ─────────────────────────────────────────────

describe('createTableQueryStore — 多 tableId 共存', () => {
  it('初始 getSnapshot 返回 undefined', () => {
    const store = createTableQueryStore()
    expect(store.getState().getSnapshot('videos')).toBeUndefined()
  })

  it('setSnapshot 后 getSnapshot 返回正确快照', () => {
    const store = createTableQueryStore()
    const snap = buildDefaultSnapshot(COLUMNS, undefined)
    store.getState().setSnapshot('videos', snap)
    expect(store.getState().getSnapshot('videos')).toEqual(snap)
  })

  it('两个 tableId 独立存储不互相污染', () => {
    const store = createTableQueryStore()
    const snapA = buildDefaultSnapshot(COLUMNS, { pagination: { page: 1, pageSize: 20 } })
    const snapB = buildDefaultSnapshot(COLUMNS, { pagination: { page: 5, pageSize: 50 } })
    store.getState().setSnapshot('videos', snapA)
    store.getState().setSnapshot('banners', snapB)
    expect(store.getState().getSnapshot('videos')?.pagination.pageSize).toBe(20)
    expect(store.getState().getSnapshot('banners')?.pagination.pageSize).toBe(50)
  })

  it('setSnapshot 触发 subscribe 通知', () => {
    const store = createTableQueryStore()
    let notified = false
    const unsub = store.subscribe(() => { notified = true })
    store.getState().setSnapshot('videos', buildDefaultSnapshot(COLUMNS, undefined))
    unsub()
    expect(notified).toBe(true)
  })

  it('多次 setSnapshot 以最后一次为准', () => {
    const store = createTableQueryStore()
    const snap1 = buildDefaultSnapshot(COLUMNS, { pagination: { page: 1, pageSize: 20 } })
    const snap2 = applyPatch(snap1, { pagination: { page: 2 } })
    store.getState().setSnapshot('videos', snap1)
    store.getState().setSnapshot('videos', snap2)
    expect(store.getState().getSnapshot('videos')?.pagination.page).toBe(2)
  })
})
