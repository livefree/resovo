import { useCallback, useEffect, useRef, useState } from 'react'

export interface AdminToastState {
  msg: string
  ok: boolean
}

interface UseAdminToastOptions {
  durationMs?: number
}

export function useAdminToast(options?: UseAdminToastOptions) {
  const durationMs = options?.durationMs ?? 3500
  const [toast, setToast] = useState<AdminToastState | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const clearToast = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setToast(null)
  }, [])

  const showToast = useCallback((msg: string, ok: boolean) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }
    setToast({ msg, ok })
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      setToast(null)
    }, durationMs)
  }, [durationMs])

  useEffect(() => clearToast, [clearToast])

  return { toast, showToast, clearToast }
}
