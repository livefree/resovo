/**
 * storage-sync-medium.test.ts — DataTable 双 key 双介质持久化单测（DTR-E / DTR-D 行为 / SEQ-20260531-01）
 * 覆盖：布局偏好 localStorage:v2 / views sessionStorage:views:v1 / readFromStorage 合并 /
 *   width 校验丢弃保 visible / 旧合并 :v1 一次性清理 / writeToStorage 不持久化非法 width / SSR 守卫。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  readFromStorage, writeToStorage, writeViewsToStorage, storedPrefsToColumnMap,
} from '../../../../../packages/admin-ui/src/components/data-table/storage-sync'
import type { TableQuerySnapshot, TableView } from '../../../../../packages/admin-ui/src/components/data-table/types'

const LAYOUT_KEY = (id: string) => `admin-ui:table:${id}:v2`
const VIEWS_KEY = (id: string) => `admin-ui:table:${id}:views:v1`
const LEGACY_KEY = (id: string) => `admin-ui:table:${id}:v1`

function snap(pageSize: number, cols: [string, { visible: boolean; width?: number }][]): TableQuerySnapshot {
  return {
    pagination: { page: 1, pageSize },
    sort: { field: undefined, direction: 'asc' },
    filters: new Map(),
    columns: new Map(cols),
    selection: { selectedKeys: new Set(), mode: 'page' },
  }
}
const VIEW: TableView = {
  id: 'vw', label: 'V', scope: 'personal',
  query: { pagination: { page: 1, pageSize: 20 }, sort: { field: undefined, direction: 'asc' }, filters: new Map(), columns: new Map() },
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

describe('双 key 双介质', () => {
  it('布局偏好写 localStorage:v2，views 写 sessionStorage:views:v1', () => {
    writeToStorage('t', snap(50, [['a', { visible: true, width: 200 }]]))
    writeViewsToStorage('t', [VIEW])
    expect(localStorage.getItem(LAYOUT_KEY('t'))).toContain('"pageSize":50')
    expect(sessionStorage.getItem(LAYOUT_KEY('t'))).toBeNull()
    expect(sessionStorage.getItem(VIEWS_KEY('t'))).toContain('"id":"vw"')
    expect(localStorage.getItem(VIEWS_KEY('t'))).toBeNull()
  })
  it('readFromStorage 合并两介质', () => {
    writeToStorage('t', snap(50, [['a', { visible: true, width: 200 }]]))
    writeViewsToStorage('t', [VIEW])
    const stored = readFromStorage('t')
    expect(stored?.pageSize).toBe(50)
    expect(stored?.columns?.a).toEqual({ visible: true, width: 200 })
    expect(stored?.views?.length).toBe(1)
    expect(stored?.views?.[0].id).toBe('vw')
  })
  it('两侧独立：仅写布局 → 无 views；仅写 views → 无布局', () => {
    writeToStorage('only-layout', snap(20, [['a', { visible: true }]]))
    expect(readFromStorage('only-layout')?.views).toBeUndefined()
    writeViewsToStorage('only-views', [VIEW])
    const s = readFromStorage('only-views')
    expect(s?.pageSize).toBeUndefined()
    expect(s?.columns).toBeUndefined()
    expect(s?.views?.length).toBe(1)
  })
  it('全空 → undefined', () => {
    expect(readFromStorage('nope')).toBeUndefined()
  })
})

describe('views Map 结构 round-trip', () => {
  it('query.filters/columns Map 序列化后还原为 Map', () => {
    const v: TableView = {
      ...VIEW, id: 'm',
      query: { pagination: { page: 1, pageSize: 20 }, sort: { field: 'x', direction: 'desc' }, filters: new Map([['k', { kind: 'text', value: 'q' }]]) as never, columns: new Map([['c', { visible: true, width: 90 }]]) },
    }
    writeViewsToStorage('mt', [v])
    const got = readFromStorage('mt')?.views?.[0]
    expect(got?.query.filters instanceof Map).toBe(true)
    expect(got?.query.columns instanceof Map).toBe(true)
    expect((got?.query.columns as Map<string, unknown>).get('c')).toEqual({ visible: true, width: 90 })
  })
})

describe('width 校验（C3）', () => {
  it('读取时 NaN/0/负/字符串/null 丢弃 width 保留 visible', () => {
    localStorage.setItem(LAYOUT_KEY('dirty'), JSON.stringify({
      pageSize: 20,
      columns: {
        ok: { visible: true, width: 120 },
        zero: { visible: true, width: 0 },
        neg: { visible: false, width: -5 },
        str: { visible: true, width: 'abc' },
        nul: { visible: true, width: null },
      },
    }))
    const c = readFromStorage('dirty')?.columns
    expect(c?.ok).toEqual({ visible: true, width: 120 })
    expect(c?.zero).toEqual({ visible: true })
    expect(c?.neg).toEqual({ visible: false })
    expect(c?.str).toEqual({ visible: true })
    expect(c?.nul).toEqual({ visible: true })
  })
  it('写入时不持久化非法 width', () => {
    writeToStorage('w', snap(20, [['x', { visible: true, width: NaN }]]))
    expect(localStorage.getItem(LAYOUT_KEY('w'))).not.toContain('width')
    expect(readFromStorage('w')?.columns?.x).toEqual({ visible: true })
  })
  it('structurally 非法（visible 非 boolean）→ 整体清除 layout key', () => {
    localStorage.setItem(LAYOUT_KEY('bad'), JSON.stringify({ columns: { a: { visible: 'yes' } } }))
    expect(readFromStorage('bad')).toBeUndefined()
    expect(localStorage.getItem(LAYOUT_KEY('bad'))).toBeNull()
  })
  it('JSON 损坏 → 清除该 key 返回 undefined', () => {
    localStorage.setItem(LAYOUT_KEY('corrupt'), '{bad json')
    expect(readFromStorage('corrupt')).toBeUndefined()
    expect(localStorage.getItem(LAYOUT_KEY('corrupt'))).toBeNull()
  })
})

describe('旧合并 :v1 一次性清理不迁移', () => {
  it('不读旧 key 且清理之', () => {
    sessionStorage.setItem(LEGACY_KEY('old'), JSON.stringify({ pageSize: 99, columns: {}, views: [] }))
    expect(readFromStorage('old')).toBeUndefined()
    expect(sessionStorage.getItem(LEGACY_KEY('old'))).toBeNull()
  })
  it('清理旧 key 不影响新 :v2 / :views:v1', () => {
    writeToStorage('mix', snap(30, [['a', { visible: true }]]))
    sessionStorage.setItem(LEGACY_KEY('mix'), 'stale')
    const stored = readFromStorage('mix')
    expect(stored?.pageSize).toBe(30)
    expect(sessionStorage.getItem(LEGACY_KEY('mix'))).toBeNull()
  })
})

describe('storedPrefsToColumnMap', () => {
  it('转 ColumnPreference Map（含 width）', () => {
    const m = storedPrefsToColumnMap({ columns: { a: { visible: true, width: 100 }, b: { visible: false } } })
    expect(m.get('a')).toEqual({ visible: true, width: 100 })
    expect(m.get('b')).toEqual({ visible: false })
  })
  it('无 columns → 空 Map', () => {
    expect(storedPrefsToColumnMap({}).size).toBe(0)
  })
})
