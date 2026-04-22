'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { usePlayerStore } from '@/stores/playerStore'

/**
 * 监听路由变化，在离开 /watch 时自动将 hostMode 从 full 切为 mini。
 * 挂在 Root layout，跨整个 SPA 生命周期存活。
 */
export function RoutePlayerSync() {
  const pathname = usePathname()
  const prevRef = useRef<string | null>(null)
  const hostMode = usePlayerStore((s) => s.hostMode)
  const setHostMode = usePlayerStore((s) => s.setHostMode)

  useEffect(() => {
    const prev = prevRef.current
    const cur = pathname

    if (prev !== null) {
      const wasWatch = prev.includes('/watch/')
      const isWatch = cur.includes('/watch/')

      if (wasWatch && !isWatch && hostMode === 'full') {
        setHostMode('mini')
      }
    }

    prevRef.current = cur
  }, [pathname, hostMode, setHostMode])

  return null
}
