import { useMemo, useState } from 'react'

export function useCrawlerSiteSelection(visibleKeys: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const allVisibleSelected = useMemo(
    () => visibleKeys.length > 0 && visibleKeys.every((key) => selected.has(key)),
    [selected, visibleKeys],
  )

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const key of visibleKeys) {
          next.delete(key)
        }
        return next
      })
      return
    }

    setSelected((prev) => {
      const next = new Set(prev)
      for (const key of visibleKeys) {
        next.add(key)
      }
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  return {
    selected,
    allVisibleSelected,
    toggleSelect,
    toggleAll,
    clearSelection,
  }
}
