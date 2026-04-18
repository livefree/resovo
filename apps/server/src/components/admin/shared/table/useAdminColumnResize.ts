import { useCallback, useEffect, useRef } from 'react'

type ResizeMeta = {
  minWidth: number
  maxWidth: number
  resizable: boolean
}

type ResizeDraft = {
  columnId: string
  startX: number
  startWidth: number
}

type UseAdminColumnResizeOptions = {
  getMeta: (columnId: string) => ResizeMeta | null
  getCurrentWidth: (columnId: string) => number
  onWidthChange: (columnId: string, width: number) => void
}

function clampWidth(width: number, minWidth: number, maxWidth: number): number {
  if (Number.isNaN(width)) return minWidth
  return Math.max(minWidth, Math.min(maxWidth, width))
}

export function useAdminColumnResize(options: UseAdminColumnResizeOptions) {
  const { getMeta, getCurrentWidth, onWidthChange } = options
  const resizeDraftRef = useRef<ResizeDraft | null>(null)

  const startResize = useCallback((columnId: string, clientX: number) => {
    const meta = getMeta(columnId)
    if (!meta || !meta.resizable) return
    resizeDraftRef.current = {
      columnId,
      startX: clientX,
      startWidth: getCurrentWidth(columnId),
    }
  }, [getMeta, getCurrentWidth])

  const stopResize = useCallback(() => {
    resizeDraftRef.current = null
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const onMouseMove = (event: MouseEvent) => {
      if (!resizeDraftRef.current) return
      const { columnId, startX, startWidth } = resizeDraftRef.current
      const meta = getMeta(columnId)
      if (!meta || !meta.resizable) return
      const width = clampWidth(startWidth + (event.clientX - startX), meta.minWidth, meta.maxWidth)
      onWidthChange(columnId, width)
    }

    const onMouseUp = () => {
      stopResize()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [getMeta, onWidthChange, stopResize])

  return {
    startResize,
    stopResize,
  }
}
