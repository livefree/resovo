/**
 * url-sync 单测（CHG-SN-2-13）
 * 覆盖：serialize（page/sort/filter）/ deserialize（各 FilterValue kind）/ namespace / fallback / 容错
 */
import { describe, it, expect, vi } from 'vitest'
import { snapshotToSearchParams, searchParamsToSnapshot } from '../../../../../packages/admin-ui/src/components/data-table/url-sync'
import type { TableQueryDefaults, FilterValue, ColumnDescriptor } from '../../../../../packages/admin-ui/src/components/data-table/types'

const DEFAULTS: TableQueryDefaults = {
  pagination: { page: 1, pageSize: 20 },
  sort: { field: undefined, direction: 'asc' },
  filters: new Map(),
}

const COLUMNS: ColumnDescriptor[] = [
  { id: 'title', header: 'Title', enableSorting: true },
  { id: 'status', header: 'Status', enableSorting: true },
  { id: 'rating', header: 'Rating' },
  { id: 'price', header: 'Price' },
  { id: 'createdAt', header: 'Created' },
]

function makeParams(entries: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(entries)
}

// ── serialize ────────────────────────────────────────────────────

describe('snapshotToSearchParams — page', () => {
  it('page=1（默认）时省略 page key', () => {
    const params = snapshotToSearchParams(
      { pagination: { page: 1, pageSize: 20 }, sort: DEFAULTS.sort, filters: new Map() },
      DEFAULTS,
      makeParams(),
      undefined,
    )
    expect(params.has('page')).toBe(false)
  })

  it('page=3 时写入 page=3', () => {
    const params = snapshotToSearchParams(
      { pagination: { page: 3, pageSize: 20 }, sort: DEFAULTS.sort, filters: new Map() },
      DEFAULTS,
      makeParams(),
      undefined,
    )
    expect(params.get('page')).toBe('3')
  })
})

describe('snapshotToSearchParams — sort', () => {
  it('field=undefined 时省略 sort/sortDir', () => {
    const params = snapshotToSearchParams(
      { pagination: { page: 1, pageSize: 20 }, sort: { field: undefined, direction: 'asc' }, filters: new Map() },
      DEFAULTS,
      makeParams(),
      undefined,
    )
    expect(params.has('sort')).toBe(false)
    expect(params.has('sortDir')).toBe(false)
  })

  it('field=title direction=desc 时写入 sort + sortDir', () => {
    const params = snapshotToSearchParams(
      { pagination: { page: 1, pageSize: 20 }, sort: { field: 'title', direction: 'desc' }, filters: new Map() },
      DEFAULTS,
      makeParams(),
      undefined,
    )
    expect(params.get('sort')).toBe('title')
    expect(params.get('sortDir')).toBe('desc')
  })
})

describe('snapshotToSearchParams — filters', () => {
  it('text filter → f.{id}=value', () => {
    const filters = new Map<string, FilterValue>([['title', { kind: 'text', value: 'hello world' }]])
    const params = snapshotToSearchParams(
      { pagination: { page: 1, pageSize: 20 }, sort: DEFAULTS.sort, filters },
      DEFAULTS,
      makeParams(),
      undefined,
    )
    expect(params.get('f.title')).toBe('hello world')
  })

  it('enum filter → 逗号分隔', () => {
    const filters = new Map<string, FilterValue>([['status', { kind: 'enum', value: ['approved', 'pending'] }]])
    const params = snapshotToSearchParams(
      { pagination: { page: 1, pageSize: 20 }, sort: DEFAULTS.sort, filters },
      DEFAULTS,
      makeParams(),
      undefined,
    )
    expect(params.get('f.status')).toBe('approved,pending')
  })

  it('range filter → f.{id}.min + f.{id}.max', () => {
    const filters = new Map<string, FilterValue>([['rating', { kind: 'range', min: 3, max: 5 }]])
    const params = snapshotToSearchParams(
      { pagination: { page: 1, pageSize: 20 }, sort: DEFAULTS.sort, filters },
      DEFAULTS,
      makeParams(),
      undefined,
    )
    expect(params.get('f.rating.min')).toBe('3')
    expect(params.get('f.rating.max')).toBe('5')
  })

  it('date-range filter → f.{id}.from + f.{id}.to', () => {
    const filters = new Map<string, FilterValue>([['createdAt', { kind: 'date-range', from: '2026-01-01', to: '2026-12-31' }]])
    const params = snapshotToSearchParams(
      { pagination: { page: 1, pageSize: 20 }, sort: DEFAULTS.sort, filters },
      DEFAULTS,
      makeParams(),
      undefined,
    )
    expect(params.get('f.createdAt.from')).toBe('2026-01-01')
    expect(params.get('f.createdAt.to')).toBe('2026-12-31')
  })

  it('bool filter → true/false string', () => {
    const filters = new Map<string, FilterValue>([['active', { kind: 'bool', value: true }]])
    const params = snapshotToSearchParams(
      { pagination: { page: 1, pageSize: 20 }, sort: DEFAULTS.sort, filters },
      DEFAULTS,
      makeParams(),
      undefined,
    )
    expect(params.get('f.active')).toBe('true')
  })

  it('number filter → numeric string', () => {
    const filters = new Map<string, FilterValue>([['price', { kind: 'number', value: 42 }]])
    const params = snapshotToSearchParams(
      { pagination: { page: 1, pageSize: 20 }, sort: DEFAULTS.sort, filters },
      DEFAULTS,
      makeParams(),
      undefined,
    )
    expect(params.get('f.price')).toBe('42')
  })

  it('serialize 后旧 filter 键被清除', () => {
    const initial = makeParams({ 'f.title': 'old', 'f.status': 'old' })
    const filters = new Map<string, FilterValue>([['title', { kind: 'text', value: 'new' }]])
    const params = snapshotToSearchParams(
      { pagination: { page: 1, pageSize: 20 }, sort: DEFAULTS.sort, filters },
      DEFAULTS,
      initial,
      undefined,
    )
    expect(params.get('f.title')).toBe('new')
    expect(params.has('f.status')).toBe(false)
  })
})

describe('snapshotToSearchParams — namespace', () => {
  it('namespace 前缀包装所有键', () => {
    const params = snapshotToSearchParams(
      { pagination: { page: 2, pageSize: 20 }, sort: { field: 'title', direction: 'asc' }, filters: new Map() },
      DEFAULTS,
      makeParams(),
      'videos',
    )
    expect(params.has('page')).toBe(false)
    expect(params.get('videos.page')).toBe('2')
    expect(params.get('videos.sort')).toBe('title')
  })
})

// ── deserialize ──────────────────────────────────────────────────

describe('searchParamsToSnapshot — page', () => {
  it('无 page key 时返回 defaultPage', () => {
    const result = searchParamsToSnapshot(makeParams(), DEFAULTS, COLUMNS, undefined)
    expect(result.page).toBe(1)
  })

  it('page=5 解析正确', () => {
    const result = searchParamsToSnapshot(makeParams({ page: '5' }), DEFAULTS, COLUMNS, undefined)
    expect(result.page).toBe(5)
  })

  it('page=abc 时 console.warn + fallback to default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = searchParamsToSnapshot(makeParams({ page: 'abc' }), DEFAULTS, COLUMNS, undefined)
    expect(result.page).toBe(1)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('searchParamsToSnapshot — sort', () => {
  it('合法 sort+sortDir 解析', () => {
    const result = searchParamsToSnapshot(makeParams({ sort: 'title', sortDir: 'desc' }), DEFAULTS, COLUMNS, undefined)
    expect(result.sort).toEqual({ field: 'title', direction: 'desc' })
  })

  it('未知 sort field → warn + fallback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = searchParamsToSnapshot(makeParams({ sort: 'unknown_col' }), DEFAULTS, COLUMNS, undefined)
    expect(result.sort.field).toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('enableSorting=false 的列 → warn + fallback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = searchParamsToSnapshot(makeParams({ sort: 'rating' }), DEFAULTS, COLUMNS, undefined)
    expect(result.sort.field).toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('sortDir 非法值时 fallback to asc', () => {
    const result = searchParamsToSnapshot(makeParams({ sort: 'title', sortDir: 'middle' }), DEFAULTS, COLUMNS, undefined)
    expect(result.sort).toEqual({ field: 'title', direction: 'asc' })
  })
})

describe('searchParamsToSnapshot — filters', () => {
  it('bool filter（true）解析', () => {
    const result = searchParamsToSnapshot(makeParams({ 'f.active': 'true' }), DEFAULTS, COLUMNS, undefined)
    expect(result.filters.get('active')).toEqual({ kind: 'bool', value: true })
  })

  it('enum filter（逗号分隔）解析', () => {
    const result = searchParamsToSnapshot(makeParams({ 'f.status': 'approved,pending' }), DEFAULTS, COLUMNS, undefined)
    expect(result.filters.get('status')).toEqual({ kind: 'enum', value: ['approved', 'pending'] })
  })

  it('number filter 解析', () => {
    const result = searchParamsToSnapshot(makeParams({ 'f.price': '42' }), DEFAULTS, COLUMNS, undefined)
    expect(result.filters.get('price')).toEqual({ kind: 'number', value: 42 })
  })

  it('range filter（.min + .max）解析', () => {
    const result = searchParamsToSnapshot(
      makeParams({ 'f.rating.min': '3', 'f.rating.max': '5' }),
      DEFAULTS,
      COLUMNS,
      undefined,
    )
    expect(result.filters.get('rating')).toEqual({ kind: 'range', min: 3, max: 5 })
  })

  it('date-range filter 解析', () => {
    const result = searchParamsToSnapshot(
      makeParams({ 'f.createdAt.from': '2026-01-01', 'f.createdAt.to': '2026-12-31' }),
      DEFAULTS,
      COLUMNS,
      undefined,
    )
    expect(result.filters.get('createdAt')).toEqual({ kind: 'date-range', from: '2026-01-01', to: '2026-12-31' })
  })

  it('text filter 解析（默认启发式）', () => {
    const result = searchParamsToSnapshot(makeParams({ 'f.title': 'hello world' }), DEFAULTS, COLUMNS, undefined)
    expect(result.filters.get('title')).toEqual({ kind: 'text', value: 'hello world' })
  })
})

describe('searchParamsToSnapshot — namespace', () => {
  it('带 namespace 时正确解析前缀键', () => {
    const result = searchParamsToSnapshot(
      makeParams({ 'videos.page': '3', 'videos.sort': 'title', 'videos.sortDir': 'asc' }),
      DEFAULTS,
      COLUMNS,
      'videos',
    )
    expect(result.page).toBe(3)
    expect(result.sort).toEqual({ field: 'title', direction: 'asc' })
  })

  it('不同 namespace 的键不互相干扰', () => {
    const result = searchParamsToSnapshot(
      makeParams({ 'articles.page': '5', 'videos.page': '2' }),
      DEFAULTS,
      COLUMNS,
      'videos',
    )
    expect(result.page).toBe(2)
  })
})

// ── round-trip ───────────────────────────────────────────────────

describe('url-sync round-trip', () => {
  it('serialize → deserialize 往返一致（含 sort + text filter + page）', () => {
    const filters = new Map<string, FilterValue>([
      ['title', { kind: 'text', value: 'foo' }],
    ])
    const params = snapshotToSearchParams(
      { pagination: { page: 2, pageSize: 20 }, sort: { field: 'title', direction: 'desc' }, filters },
      DEFAULTS,
      makeParams(),
      undefined,
    )
    const result = searchParamsToSnapshot(params, DEFAULTS, COLUMNS, undefined)
    expect(result.page).toBe(2)
    expect(result.sort).toEqual({ field: 'title', direction: 'desc' })
    expect(result.filters.get('title')).toEqual({ kind: 'text', value: 'foo' })
  })
})
