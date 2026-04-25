'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { usePlayerStore } from '@/stores/playerStore'

/**
 * 监听路由变化，在离开 /watch 时按播放状态决定 mini 或 close。
 * 仅在视频播放中（isPlaying=true）离开 /watch 时激活 mini player；
 * 暂停状态离开则直接关闭，不残留浮窗。
 */
export function RoutePlayerSync() {
  const pathname = usePathname()
  const prevRef = useRef<string | null>(null)
  const hostMode = usePlayerStore((s) => s.hostMode)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const setHostMode = usePlayerStore((s) => s.setHostMode)

  useEffect(() => {
    const prev = prevRef.current
    const cur = pathname

    if (prev !== null) {
      const wasWatch = prev.includes('/watch/')
      const isWatch = cur.includes('/watch/')

      if (wasWatch && !isWatch && hostMode === 'full') {
        if (isPlaying) {
          setHostMode('mini')
        } else {
          setHostMode('closed')
        }
      }
    }

    prevRef.current = cur
  }, [pathname, hostMode, isPlaying, setHostMode])

  return null
}
