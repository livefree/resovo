/**
 * useAdminTableSort — 排序状态管理 hook
 *
 * CHG-312: 脱离 useAdminTableColumns/TableStateController 依赖，改为独立 useState。
 * 排序状态不再持久化到 localStorage（由调用方决定是否持久化，或在 CHG-314 删除前维持当前行为）。
 */

import { useState } from 'react'
import type { AdminTableSortState } from '@/components/admin/shared/table/useAdminTableState'

type SortableConfig = string[] | Record<string, boolean>

interface UseAdminTableSortOptions {
  defaultSort?: AdminTableSortState
  sortable?: SortableConfig
}

function canSortField(field: string, sortable: SortableConfig | undefined): boolean {
  if (!sortable) return true
  if (Array.isArray(sortable)) return sortable.includes(field)
  return sortable[field] === true
}

export function useAdminTableSort({ defaultSort, sortable }: UseAdminTableSortOptions) {
  const [sort, setSortState] = useState<AdminTableSortState | undefined>(defaultSort)

  function isSortable(field: string): boolean {
    return canSortField(field, sortable)
  }

  function setSort(field: string, dir: 'asc' | 'desc') {
    if (!isSortable(field)) return
    setSortState({ field, dir })
  }

  function toggleSort(field: string) {
    if (!isSortable(field)) return
    if (!sort || sort.field !== field) {
      setSortState({ field, dir: 'asc' })
      return
    }
    setSortState({ field, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
  }

  function clearSort() {
    setSortState(defaultSort)
  }

  function isSortedBy(field: string): boolean {
    return sort?.field === field
  }

  const sortableFields = (() => {
    if (!sortable) return undefined
    if (Array.isArray(sortable)) return sortable
    return Object.keys(sortable).filter((key) => (sortable as Record<string, boolean>)[key])
  })()

  return {
    sort,
    sortableFields,
    isSortable,
    isSortedBy,
    setSort,
    toggleSort,
    clearSort,
  }
}
