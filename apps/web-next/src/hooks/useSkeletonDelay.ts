import { useState, useEffect } from 'react'

/**
 * Defers skeleton visibility to avoid flash for fast loads.
 *
 * Returns false while `loading` is true but the delay hasn't elapsed;
 * returns true once the delay fires. Resets immediately when loading stops.
 *
 * @param loading - Current loading state
 * @param delayMs - Wait before showing skeleton: 300ms (inline), 800ms (page), null = immediate
 */
export function useSkeletonDelay(loading: boolean, delayMs: 300 | 800 | null): boolean {
  const [visible, setVisible] = useState(delayMs === null ? loading : false)

  useEffect(() => {
    if (!loading) {
      setVisible(false)
      return
    }
    if (delayMs === null) {
      setVisible(true)
      return
    }
    const id = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(id)
  }, [loading, delayMs])

  return visible
}
