/**
 * url-sync.ts — snapshot ↔ URLSearchParams 互转（纯函数，零副作用）
 * 真源：ADR-103 §4.2.1 URL 同步规约（CHG-SN-2-13）
 *
 * 编码规约：
 *   page → 'page'（默认 1 时省略）
 *   sort.field → 'sort'；sort.direction → 'sortDir'（field undefined 时均省略）
 *   filters → 'f.{filterId}'；range/date-range 拆成 '.min/.max' / '.from/.to' 子键
 *   urlNamespace='videos' 时所有键加前缀 'videos.'
 *
 * 约束：filterId 本身不得含 '.'（会导致 range/date-range 子键解析歧义）
 */
import type {
  TableQuerySnapshot,
  FilterValue,
  TableSortState,
  TableQueryDefaults,
  ColumnDescriptor,
} from './types'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20
const DEFAULT_SORT: TableSortState = { field: undefined, direction: 'asc' }

// ── namespace helpers ────────────────────────────────────────────

function ns(namespace: string | undefined, key: string): string {
  return namespace ? `${namespace}.${key}` : key
}

// ── serialize ────────────────────────────────────────────────────

export function snapshotToSearchParams(
  snapshot: Pick<TableQuerySnapshot, 'pagination' | 'sort' | 'filters'>,
  defaults: Pick<TableQueryDefaults, 'pagination' | 'sort'>,
  existing: URLSearchParams,
  namespace: string | undefined,
): URLSearchParams {
  const params = new URLSearchParams(existing.toString())

  // page（默认 1 时省略）
  const defaultPage = defaults.pagination?.page ?? DEFAULT_PAGE
  if (snapshot.pagination.page !== defaultPage) {
    params.set(ns(namespace, 'page'), String(snapshot.pagination.page))
  } else {
    params.delete(ns(namespace, 'page'))
  }

  // sort（field undefined 时均省略）
  if (snapshot.sort.field !== undefined) {
    params.set(ns(namespace, 'sort'), snapshot.sort.field)
    params.set(ns(namespace, 'sortDir'), snapshot.sort.direction)
  } else {
    params.delete(ns(namespace, 'sort'))
    params.delete(ns(namespace, 'sortDir'))
  }

  // 先清除旧的 f.* 键
  clearFilterParams(params, namespace)

  // 新 filters
  for (const [filterId, value] of snapshot.filters) {
    serializeFilter(filterId, value, params, namespace)
  }

  return params
}

function clearFilterParams(params: URLSearchParams, namespace: string | undefined): void {
  const prefix = namespace ? `${namespace}.f.` : 'f.'
  const toDelete: string[] = []
  for (const key of params.keys()) {
    if (key.startsWith(prefix)) toDelete.push(key)
  }
  for (const key of toDelete) params.delete(key)
}

function serializeFilter(
  filterId: string,
  value: FilterValue,
  params: URLSearchParams,
  namespace: string | undefined,
): void {
  const fBase = ns(namespace, `f.${filterId}`)
  if (value.kind === 'text') {
    params.set(fBase, value.value)
  } else if (value.kind === 'number') {
    params.set(fBase, String(value.value))
  } else if (value.kind === 'bool') {
    params.set(fBase, value.value ? 'true' : 'false')
  } else if (value.kind === 'enum') {
    params.set(fBase, value.value.join(','))
  } else if (value.kind === 'range') {
    if (value.min !== undefined) params.set(ns(namespace, `f.${filterId}.min`), String(value.min))
    if (value.max !== undefined) params.set(ns(namespace, `f.${filterId}.max`), String(value.max))
  } else if (value.kind === 'date-range') {
    if (value.from !== undefined) params.set(ns(namespace, `f.${filterId}.from`), value.from)
    if (value.to !== undefined) params.set(ns(namespace, `f.${filterId}.to`), value.to)
  }
}

// ── deserialize ──────────────────────────────────────────────────

export interface SearchParamsResult {
  readonly page: number
  readonly sort: TableSortState
  readonly filters: ReadonlyMap<string, FilterValue>
}

export function searchParamsToSnapshot(
  params: URLSearchParams,
  defaults: Pick<TableQueryDefaults, 'pagination' | 'sort'>,
  columns: readonly ColumnDescriptor[],
  namespace: string | undefined,
): SearchParamsResult {
  const defaultPage = defaults.pagination?.page ?? DEFAULT_PAGE
  const defaultSort = defaults.sort ?? DEFAULT_SORT

  // page
  const pageRaw = params.get(ns(namespace, 'page'))
  let page = defaultPage
  if (pageRaw !== null) {
    const parsed = parseInt(pageRaw, 10)
    if (Number.isFinite(parsed) && parsed >= 1) {
      page = parsed
    } else {
      console.warn(`[url-sync] invalid page="${pageRaw}", using default`)
    }
  }

  // sort
  const sortField = params.get(ns(namespace, 'sort'))
  const sortDir = params.get(ns(namespace, 'sortDir'))
  let sort: TableSortState = defaultSort
  if (sortField !== null) {
    const validColumn = columns.some((c) => c.id === sortField && c.enableSorting)
    if (validColumn) {
      const direction = sortDir === 'asc' || sortDir === 'desc' ? sortDir : 'asc'
      sort = { field: sortField, direction }
    } else {
      console.warn(`[url-sync] unknown sort field="${sortField}", using default`)
    }
  }

  // filters — collect all f.* keys
  const filters = deserializeFilters(params, namespace)

  return { page, sort, filters }
}

function deserializeFilters(
  params: URLSearchParams,
  namespace: string | undefined,
): ReadonlyMap<string, FilterValue> {
  const prefix = namespace ? `${namespace}.f.` : 'f.'
  const rangeMap = new Map<string, { min?: number; max?: number }>()
  const dateRangeMap = new Map<string, { from?: string; to?: string }>()
  const simpleMap = new Map<string, string>()

  for (const [key, value] of params.entries()) {
    if (!key.startsWith(prefix)) continue
    const rest = key.slice(prefix.length) // e.g. "status" or "price.min"
    const dotIdx = rest.lastIndexOf('.')
    if (dotIdx !== -1) {
      const filterId = rest.slice(0, dotIdx)
      const subKey = rest.slice(dotIdx + 1)
      if (subKey === 'min' || subKey === 'max') {
        const existing = rangeMap.get(filterId) ?? {}
        const num = parseFloat(value)
        if (Number.isFinite(num)) {
          rangeMap.set(filterId, { ...existing, [subKey]: num })
        } else {
          console.warn(`[url-sync] invalid range ${subKey}="${value}" for filter "${filterId}"`)
        }
      } else if (subKey === 'from' || subKey === 'to') {
        const existing = dateRangeMap.get(filterId) ?? {}
        dateRangeMap.set(filterId, { ...existing, [subKey]: value })
      }
    } else {
      simpleMap.set(rest, value)
    }
  }

  const result = new Map<string, FilterValue>()

  for (const [filterId, entry] of rangeMap) {
    result.set(filterId, { kind: 'range', ...entry })
  }
  for (const [filterId, entry] of dateRangeMap) {
    result.set(filterId, { kind: 'date-range', ...entry })
  }
  for (const [filterId, raw] of simpleMap) {
    if (rangeMap.has(filterId) || dateRangeMap.has(filterId)) continue
    result.set(filterId, inferFilterValue(filterId, raw))
  }

  return result
}

function inferFilterValue(filterId: string, raw: string): FilterValue {
  if (raw === 'true' || raw === 'false') {
    return { kind: 'bool', value: raw === 'true' }
  }
  if (raw.includes(',')) {
    return { kind: 'enum', value: raw.split(',').filter((s) => s.length > 0) }
  }
  const num = Number(raw)
  if (raw.length > 0 && Number.isFinite(num)) {
    return { kind: 'number', value: num }
  }
  void filterId
  return { kind: 'text', value: raw }
}
