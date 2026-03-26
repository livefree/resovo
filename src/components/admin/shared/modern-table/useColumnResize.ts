'use client'

import { useMemo, useState } from 'react'

const COLUMN_RESIZE_STATE_VERSION = 'v1' as const
const DEFAULT_MIN_WIDTH = 72

type ResizeSession = {
  columnId: string
  startX: number
  startWidth: number
  minWidth: number
}

export type UseColumnResizeOptions = {
  tableId: string
  initialWidths?: Record<string, number>
  minWidths?: Record<string, number>
  defaultMinWidth?: number
  storage?: Storage | null
}

function resolveStorage(override?: Storage | null): Storage | null {
  if (override !== undefined) return override
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function buildStorageKey(tableId: string): string {
  return `modern-table:column-resize:${tableId}:${COLUMN_RESIZE_STATE_VERSION}`
}

function clampWidth(width: number, minWidth: number): number {
  if (!Number.isFinite(width)) return minWidth
  return Math.max(minWidth, Math.floor(width))
}

function readPersistedWidths(storage: Storage | null, key: string): Record<string, number> {
  if (!storage) return {}
  try {
    const raw = storage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as {
      version?: string
      widths?: Record<string, number>
    }
    if (parsed.version !== COLUMN_RESIZE_STATE_VERSION || !parsed.widths) {
      storage.removeItem(key)
      return {}
    }
    return parsed.widths
  } catch {
    return {}
  }
}

export function useColumnResize(options: UseColumnResizeOptions) {
  const {
    tableId,
    initialWidths = {},
    minWidths = {},
    defaultMinWidth = DEFAULT_MIN_WIDTH,
    storage: storageOverride,
  } = options

  const storage = useMemo(() => resolveStorage(storageOverride), [storageOverride])
  const storageKey = useMemo(() => buildStorageKey(tableId), [tableId])

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => ({
    ...initialWidths,
    ...readPersistedWidths(storage, storageKey),
  }))
  const [session, setSession] = useState<ResizeSession | null>(null)

  function setColumnWidth(columnId: string, width: number) {
    const minWidth = minWidths[columnId] ?? defaultMinWidth
    const nextWidth = clampWidth(width, minWidth)
    setColumnWidths((prev) => ({ ...prev, [columnId]: nextWidth }))
  }

  function startResize(columnId: string, startX: number, startWidth: number) {
    const minWidth = minWidths[columnId] ?? defaultMinWidth
    setSession({
      columnId,
      startX,
      startWidth: clampWidth(startWidth, minWidth),
      minWidth,
    })
  }

  function updateResize(currentX: number) {
    setSession((prev) => {
      if (!prev) return prev
      const deltaX = currentX - prev.startX
      setColumnWidths((current) => ({
        ...current,
        [prev.columnId]: clampWidth(prev.startWidth + deltaX, prev.minWidth),
      }))
      return prev
    })
  }

  function endResize() {
    setSession((prev) => {
      if (!prev) return prev
      if (storage) {
        try {
          const widths = {
            ...initialWidths,
            ...columnWidths,
          }
          storage.setItem(storageKey, JSON.stringify({
            version: COLUMN_RESIZE_STATE_VERSION,
            widths,
          }))
        } catch {
          // ignore storage write errors
        }
      }
      return null
    })
  }

  return {
    storageKey,
    columnWidths,
    resizingColumnId: session?.columnId,
    setColumnWidth,
    startResize,
    updateResize,
    endResize,
  }
}
