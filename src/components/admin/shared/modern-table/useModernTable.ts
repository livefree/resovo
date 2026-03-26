'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TableSortState } from '@/components/admin/shared/modern-table/types'

const MODERN_TABLE_STATE_VERSION = 'v1' as const

type PersistedModernTableState = {
  version: typeof MODERN_TABLE_STATE_VERSION
  state: {
    sort?: TableSortState
    page: number
    pageSize: number
    columnWidths: Record<string, number>
  }
}

export type ModernTableScrollPosition = {
  top: number
  left: number
}

export type UseModernTableOptions = {
  tableId: string
  defaultSort?: TableSortState
  defaultPage?: number
  defaultPageSize?: number
  initialColumnWidths?: Record<string, number>
  storage?: Storage | null
  syncSortToUrl?: boolean
  sortFieldParam?: string
  sortDirParam?: string
}

function resolveStorage(override?: Storage | null): Storage | null {
  if (override !== undefined) return override
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function isValidSortDirection(input: unknown): input is TableSortState['direction'] {
  return input === 'asc' || input === 'desc'
}

function readSortFromUrl(
  search: string,
  sortFieldParam: string,
  sortDirParam: string,
): TableSortState | undefined {
  const params = new URLSearchParams(search)
  const field = params.get(sortFieldParam)
  const direction = params.get(sortDirParam)
  if (!field || !isValidSortDirection(direction)) return undefined
  return { field, direction }
}

function writeSortToUrl(
  sort: TableSortState | undefined,
  sortFieldParam: string,
  sortDirParam: string,
): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!sort) {
    url.searchParams.delete(sortFieldParam)
    url.searchParams.delete(sortDirParam)
  } else {
    url.searchParams.set(sortFieldParam, sort.field)
    url.searchParams.set(sortDirParam, sort.direction)
  }
  window.history.replaceState(window.history.state, '', url.toString())
}

function buildStorageKey(tableId: string): string {
  return `modern-table:${tableId}:${MODERN_TABLE_STATE_VERSION}`
}

function readPersistedState(storage: Storage | null, storageKey: string): PersistedModernTableState['state'] | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedModernTableState>
    if (
      parsed.version !== MODERN_TABLE_STATE_VERSION
      || !parsed.state
      || typeof parsed.state !== 'object'
    ) {
      storage.removeItem(storageKey)
      return null
    }
    return parsed.state as PersistedModernTableState['state']
  } catch {
    return null
  }
}

function clampPositive(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.floor(value))
}

export function useModernTable(options: UseModernTableOptions) {
  const {
    tableId,
    defaultSort,
    defaultPage = 1,
    defaultPageSize = 20,
    initialColumnWidths = {},
    storage: storageOverride,
    syncSortToUrl = true,
    sortFieldParam = 'sortField',
    sortDirParam = 'sortDir',
  } = options

  const storage = useMemo(() => resolveStorage(storageOverride), [storageOverride])
  const storageKey = useMemo(() => buildStorageKey(tableId), [tableId])

  const initialState = useMemo(() => {
    const persisted = readPersistedState(storage, storageKey)
    const urlSort = (
      syncSortToUrl && typeof window !== 'undefined'
        ? readSortFromUrl(window.location.search, sortFieldParam, sortDirParam)
        : undefined
    )
    const sort = urlSort ?? persisted?.sort ?? defaultSort
    const page = persisted?.page ?? defaultPage
    const pageSize = persisted?.pageSize ?? defaultPageSize
    const columnWidths = {
      ...initialColumnWidths,
      ...(persisted?.columnWidths ?? {}),
    }
    return {
      sort,
      page: clampPositive(page),
      pageSize: clampPositive(pageSize),
      columnWidths,
    }
  }, [
    storage,
    storageKey,
    syncSortToUrl,
    sortFieldParam,
    sortDirParam,
    defaultSort,
    defaultPage,
    defaultPageSize,
    initialColumnWidths,
  ])

  const [sort, setSortState] = useState<TableSortState | undefined>(initialState.sort)
  const [page, setPageState] = useState<number>(initialState.page)
  const [pageSize, setPageSizeState] = useState<number>(initialState.pageSize)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(initialState.columnWidths)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set())

  const scrollPositionRef = useRef<ModernTableScrollPosition>({ top: 0, left: 0 })
  const [scrollPosition, setScrollPosition] = useState<ModernTableScrollPosition>({ top: 0, left: 0 })

  useEffect(() => {
    if (!storage) return
    const payload: PersistedModernTableState = {
      version: MODERN_TABLE_STATE_VERSION,
      state: { sort, page, pageSize, columnWidths },
    }
    try {
      storage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      // ignore storage write errors
    }
  }, [storage, storageKey, sort, page, pageSize, columnWidths])

  useEffect(() => {
    if (!syncSortToUrl) return
    writeSortToUrl(sort, sortFieldParam, sortDirParam)
  }, [sort, syncSortToUrl, sortFieldParam, sortDirParam])

  function setSort(nextSort: TableSortState | undefined) {
    setSortState(nextSort)
  }

  function toggleSort(field: string) {
    setSortState((prev) => {
      if (!prev || prev.field !== field) return { field, direction: 'asc' }
      return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
    })
  }

  function setPage(nextPage: number) {
    setPageState(clampPositive(nextPage))
  }

  function setPageSize(nextPageSize: number) {
    setPageSizeState(clampPositive(nextPageSize))
    setPageState(1)
  }

  function setColumnWidth(columnId: string, width: number) {
    const normalized = Math.max(1, Math.floor(width))
    setColumnWidths((prev) => ({ ...prev, [columnId]: normalized }))
  }

  function toggleRow(rowId: string) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  function toggleAll(rowIds: string[]) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      const allSelected = rowIds.length > 0 && rowIds.every((id) => next.has(id))
      if (allSelected) {
        for (const id of rowIds) next.delete(id)
      } else {
        for (const id of rowIds) next.add(id)
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedRowIds(new Set())
  }

  function isRowSelected(rowId: string): boolean {
    return selectedRowIds.has(rowId)
  }

  function rememberScroll(top: number, left: number) {
    const next = { top: Math.max(0, top), left: Math.max(0, left) }
    scrollPositionRef.current = next
    setScrollPosition(next)
  }

  function rememberScrollFrom(element: { scrollTop: number; scrollLeft: number }) {
    rememberScroll(element.scrollTop, element.scrollLeft)
  }

  function restoreScrollTo(element: { scrollTop: number; scrollLeft: number }) {
    element.scrollTop = scrollPositionRef.current.top
    element.scrollLeft = scrollPositionRef.current.left
  }

  return {
    storageKey,
    sort,
    setSort,
    toggleSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    columnWidths,
    setColumnWidth,
    selectedRowIds,
    isRowSelected,
    toggleRow,
    toggleAll,
    clearSelection,
    scrollPosition,
    rememberScroll,
    rememberScrollFrom,
    restoreScrollTo,
  }
}
