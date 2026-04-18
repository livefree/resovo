'use client'

import { useMemo, useRef, useState } from 'react'

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
  const widthsRef = useRef<Record<string, number>>({
    ...initialWidths,
    ...readPersistedWidths(storage, storageKey),
  })
  const [session, setSession] = useState<ResizeSession | null>(null)
  const sessionRef = useRef<ResizeSession | null>(null)

  function setColumnWidth(columnId: string, width: number) {
    const minWidth = minWidths[columnId] ?? defaultMinWidth
    const nextWidth = clampWidth(width, minWidth)
    const next = { ...widthsRef.current, [columnId]: nextWidth }
    widthsRef.current = next
    setColumnWidths(next)
  }

  function startResize(columnId: string, startX: number, startWidth: number) {
    const minWidth = minWidths[columnId] ?? defaultMinWidth
    const nextSession = {
      columnId,
      startX,
      startWidth: clampWidth(startWidth, minWidth),
      minWidth,
    }
    sessionRef.current = nextSession
    setSession(nextSession)
  }

  function updateResize(currentX: number) {
    const activeSession = sessionRef.current
    if (!activeSession) return
    const deltaX = currentX - activeSession.startX
    const next = {
        ...widthsRef.current,
        [activeSession.columnId]: clampWidth(activeSession.startWidth + deltaX, activeSession.minWidth),
      }
    widthsRef.current = next
    setColumnWidths(next)
  }

  function endResize() {
    const persistedWidths = {
      ...initialWidths,
      ...widthsRef.current,
    }
    if (storage) {
      try {
        storage.setItem(storageKey, JSON.stringify({
          version: COLUMN_RESIZE_STATE_VERSION,
          widths: persistedWidths,
        }))
      } catch {
        // ignore storage write errors
      }
    }
    sessionRef.current = null
    setSession(null)
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
