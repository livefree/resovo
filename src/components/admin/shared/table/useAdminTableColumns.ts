import { useCallback, useMemo } from 'react'
import {
  useAdminTableState,
  type AdminTableColumnState,
  type AdminTableState,
} from '@/components/admin/shared/table/useAdminTableState'
import { useAdminColumnResize } from '@/components/admin/shared/table/useAdminColumnResize'

const DEFAULT_COLUMN_WIDTH = 160
const DEFAULT_MIN_WIDTH = 72
const DEFAULT_MAX_WIDTH = 560

export type AdminColumnMeta = {
  id: string
  visible?: boolean
  width?: number
  minWidth?: number
  maxWidth?: number
  resizable?: boolean
}

export type AdminResolvedColumnMeta = {
  id: string
  visible: boolean
  width: number
  minWidth: number
  maxWidth: number
  resizable: boolean
}

type UseAdminTableColumnsOptions = {
  route: string
  tableId: string
  columns: AdminColumnMeta[]
  defaultState?: Omit<AdminTableState, 'columns'>
  storage?: Storage | null
}

function clampWidth(width: number, minWidth: number, maxWidth: number): number {
  if (Number.isNaN(width)) return minWidth
  return Math.max(minWidth, Math.min(maxWidth, width))
}

function sanitizeMeta(meta: AdminColumnMeta): AdminResolvedColumnMeta {
  const minWidth = meta.minWidth ?? DEFAULT_MIN_WIDTH
  const maxWidth = Math.max(meta.maxWidth ?? DEFAULT_MAX_WIDTH, minWidth)
  const baseWidth = meta.width ?? DEFAULT_COLUMN_WIDTH

  return {
    id: meta.id,
    visible: meta.visible ?? true,
    width: clampWidth(baseWidth, minWidth, maxWidth),
    minWidth,
    maxWidth,
    resizable: meta.resizable ?? true,
  }
}

function toDefaultColumnsState(columns: AdminResolvedColumnMeta[]): AdminTableColumnState {
  return columns.reduce<AdminTableColumnState>((acc, column) => {
    acc[column.id] = {
      visible: column.visible,
      width: column.width,
    }
    return acc
  }, {})
}

export function adaptColumnsState(
  columns: AdminColumnMeta[],
  persistedColumns: AdminTableColumnState | undefined,
): AdminResolvedColumnMeta[] {
  const normalizedColumns = columns.map(sanitizeMeta)
  return normalizedColumns.map((column) => {
    const persisted = persistedColumns?.[column.id]
    const visible = persisted?.visible ?? column.visible
    const width = clampWidth(
      persisted?.width ?? column.width,
      column.minWidth,
      column.maxWidth,
    )

    return {
      ...column,
      visible,
      width,
    }
  })
}

export function useAdminTableColumns(options: UseAdminTableColumnsOptions) {
  const { route, tableId, columns, defaultState, storage } = options

  const normalizedDefaults = useMemo(
    () => columns.map(sanitizeMeta),
    [columns],
  )

  const defaultColumnsState = useMemo(
    () => toDefaultColumnsState(normalizedDefaults),
    [normalizedDefaults],
  )

  const tableDefaultState = useMemo(
    () => ({
      ...(defaultState ?? {}),
      columns: defaultColumnsState,
    }),
    [defaultState, defaultColumnsState],
  )

  const tableState = useAdminTableState({
    route,
    tableId,
    defaultState: tableDefaultState,
    storage,
  })
  const { updatePartial } = tableState

  const resolvedColumns = useMemo(
    () => adaptColumnsState(columns, tableState.state.columns),
    [columns, tableState.state.columns],
  )

  const columnsById = useMemo(
    () => resolvedColumns.reduce<Record<string, AdminResolvedColumnMeta>>((acc, column) => {
      acc[column.id] = column
      return acc
    }, {}),
    [resolvedColumns],
  )

  const setColumnWidth = useCallback((columnId: string, nextWidth: number) => {
    const column = columnsById[columnId]
    if (!column || !column.resizable) return

    const width = clampWidth(nextWidth, column.minWidth, column.maxWidth)
    updatePartial({
      columns: {
        [columnId]: {
          visible: column.visible,
          width,
        },
      },
    })
  }, [columnsById, updatePartial])

  function setColumnVisible(columnId: string, visible: boolean) {
    const column = columnsById[columnId]
    if (!column) return

    updatePartial({
      columns: {
        [columnId]: {
          visible,
          width: column.width,
        },
      },
    })
  }

  function toggleColumnVisibility(columnId: string) {
    const column = columnsById[columnId]
    if (!column) return
    setColumnVisible(columnId, !column.visible)
  }

  function resetColumnsMeta() {
    updatePartial({
      columns: defaultColumnsState,
    })
  }

  const { startResize, stopResize } = useAdminColumnResize({
    getMeta: (columnId) => {
      const column = columnsById[columnId]
      if (!column) return null
      return {
        minWidth: column.minWidth,
        maxWidth: column.maxWidth,
        resizable: column.resizable,
      }
    },
    getCurrentWidth: (columnId) => columnsById[columnId]?.width ?? DEFAULT_COLUMN_WIDTH,
    onWidthChange: setColumnWidth,
  })

  return {
    ...tableState,
    columns: resolvedColumns,
    columnsById,
    setColumnWidth,
    setColumnVisible,
    toggleColumnVisibility,
    resetColumnsMeta,
    startResize,
    stopResize,
  }
}
