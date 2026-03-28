import { useEffect, useMemo, useRef, useState } from 'react'

export const ADMIN_TABLE_STATE_VERSION = 'v1' as const

export type AdminTableSortState = {
  field: string
  dir: 'asc' | 'desc'
}

export type AdminTableColumnState = Record<string, { visible: boolean; width?: number }>

export type AdminTablePaginationState = {
  page: number
  pageSize: number
}

export type AdminTableFiltersState = Record<string, string | number | boolean | null>

export type AdminTableScrollState = {
  top?: number
  left?: number
}

export type AdminTableState = {
  sort?: AdminTableSortState
  columns?: AdminTableColumnState
  pagination?: AdminTablePaginationState
  filters?: AdminTableFiltersState
  scroll?: AdminTableScrollState
}

export type PersistedAdminTableState = {
  version: typeof ADMIN_TABLE_STATE_VERSION
  state: AdminTableState
}

type UseAdminTableStateOptions = {
  route: string
  tableId: string
  defaultState?: AdminTableState
  storage?: Storage | null
}

function mergeColumns(
  defaults: AdminTableColumnState | undefined,
  incoming: AdminTableColumnState | undefined,
): AdminTableColumnState | undefined {
  if (!defaults && !incoming) return undefined
  if (!defaults) return incoming
  if (!incoming) return defaults

  const merged: AdminTableColumnState = { ...defaults }
  for (const [key, value] of Object.entries(incoming)) {
    merged[key] = {
      ...(defaults[key] ?? {}),
      ...value,
    }
  }
  return merged
}

export function mergeAdminTableState(
  defaults: AdminTableState,
  incoming: Partial<AdminTableState> | undefined,
): AdminTableState {
  if (!incoming) return defaults
  return {
    ...defaults,
    ...incoming,
    sort: incoming.sort ?? defaults.sort,
    pagination: incoming.pagination ?? defaults.pagination,
    filters: {
      ...(defaults.filters ?? {}),
      ...(incoming.filters ?? {}),
    },
    columns: mergeColumns(defaults.columns, incoming.columns),
    scroll: {
      ...(defaults.scroll ?? {}),
      ...(incoming.scroll ?? {}),
    },
  }
}

export function buildAdminTableStorageKey(
  route: string,
  tableId: string,
  version: typeof ADMIN_TABLE_STATE_VERSION = ADMIN_TABLE_STATE_VERSION,
): string {
  return `admin:table:${route}:${tableId}:${version}`
}

export function serializeAdminTableState(state: AdminTableState): string {
  const payload: PersistedAdminTableState = {
    version: ADMIN_TABLE_STATE_VERSION,
    state,
  }
  return JSON.stringify(payload)
}

export function deserializeAdminTableState(raw: string): PersistedAdminTableState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAdminTableState>
    if (parsed.version !== ADMIN_TABLE_STATE_VERSION || typeof parsed.state !== 'object') {
      return null
    }
    return {
      version: ADMIN_TABLE_STATE_VERSION,
      state: parsed.state,
    }
  } catch {
    return null
  }
}

function resolveStorage(override?: Storage | null): Storage | null {
  if (override !== undefined) return override
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function readStateFromStorage(
  storage: Storage | null,
  key: string,
  defaultState: AdminTableState,
): AdminTableState {
  if (!storage) return defaultState
  try {
    const raw = storage.getItem(key)
    if (!raw) return defaultState
    const parsed = deserializeAdminTableState(raw)
    if (!parsed) {
      storage.removeItem(key)
      return defaultState
    }
    return mergeAdminTableState(defaultState, parsed.state)
  } catch {
    return defaultState
  }
}

/**
 * useAdminTableState — 管理员表格状态持久化 hook
 *
 * @param options.route     路由标识（用于存储 key 前缀）
 * @param options.tableId   表格唯一 ID
 * @param options.defaultState  默认状态。**调用方无需 memoize**：hook 内部在 mount 时
 *   快照初始值，后续 prop 引用变化不会触发 storage 重读或状态重置。
 * @param options.storage   可选的自定义 Storage 实现（测试/SSR 场景传 null 禁用持久化）
 */
export function useAdminTableState(options: UseAdminTableStateOptions) {
  const { route, tableId, defaultState = {}, storage: storageOverride } = options

  // 快照 defaultState 初始值，避免调用方传入非 memoize 对象时触发无限 re-render
  const defaultStateRef = useRef<AdminTableState>(defaultState)

  const storage = useMemo(() => resolveStorage(storageOverride), [storageOverride])
  const storageKey = useMemo(() => buildAdminTableStorageKey(route, tableId), [route, tableId])

  // 首帧始终使用 defaultState，保证 SSR 与 hydration 的初始标记一致。
  // 持久化状态在挂载后回放，避免列宽/显隐在 hydration 阶段不一致触发告警。
  const [state, setInternalState] = useState<AdminTableState>(defaultStateRef.current)
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null)

  useEffect(() => {
    setInternalState(readStateFromStorage(storage, storageKey, defaultStateRef.current))
    setHydratedStorageKey(storageKey)
  }, [storage, storageKey])

  useEffect(() => {
    if (!storage || hydratedStorageKey !== storageKey) return
    try {
      storage.setItem(storageKey, serializeAdminTableState(state))
    } catch {
      // ignore storage write failures (quota/private mode)
    }
  }, [storage, storageKey, state, hydratedStorageKey])

  function setState(nextState: AdminTableState) {
    setInternalState(nextState)
  }

  function getState(): AdminTableState {
    return state
  }

  function updatePartial(partial: Partial<AdminTableState>) {
    setInternalState((prev) => mergeAdminTableState(prev, partial))
  }

  function reset() {
    setInternalState(defaultStateRef.current)
    if (!storage) return
    try {
      storage.removeItem(storageKey)
    } catch {
      // ignore storage write failures
    }
  }

  return {
    state,
    storageKey,
    getState,
    setState,
    updatePartial,
    reset,
  }
}
