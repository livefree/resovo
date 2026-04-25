'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { usePlayerStore } from '@/stores/playerStore'

/**
 * 监听路由变化，在离开 /watch 时按播放状态决定 mini 或 close。
 * 仅在视频播放中（isPlaying=true）离开 /watch 时激活 mini player；
 * 暂停状态离开则直接关闭，不残留浮窗。
 *
 * 注意：不能在路由跳转 effect 里直接读响应式 isPlaying——
 * PlayerShell 卸载时视频 pause 事件会在 effect 运行前将 isPlaying 置 false，
 * 导致"播放中离开"被误判为"暂停离开"。
 * 解决方案：用 watchPlayingRef 在 watch 页面期间持续快照 isPlaying；
 * 一旦离开 watch 页面，ref 不再更新，路由 effect 读取的是冻结的最后值。
 */
export function RoutePlayerSync() {
  const pathname = usePathname()
  const prevRef = useRef<string | null>(null)
  const hostMode = usePlayerStore((s) => s.hostMode)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const setHostMode = usePlayerStore((s) => s.setHostMode)
  const setMiniAutoplay = usePlayerStore((s) => s.setMiniAutoplay)

  // 仅在 watch 页面内更新，离开后冻结，保留导航前的播放状态
  const watchPlayingRef = useRef(false)
  useEffect(() => {
    if (pathname.includes('/watch/')) {
      watchPlayingRef.current = isPlaying
    }
  }, [pathname, isPlaying])

  // 路由跳转检测：读 ref 而非响应式 isPlaying，避免卸载时序竞争
  useEffect(() => {
    const prev = prevRef.current
    const cur = pathname

    if (prev !== null) {
      const wasWatch = prev.includes('/watch/')
      const isWatch = cur.includes('/watch/')

      if (wasWatch && !isWatch && hostMode === 'full') {
        if (watchPlayingRef.current) {
          // setMiniAutoplay 在 setHostMode 前同步写入，确保 useMiniPlayerVideo
          // activeSrc effect 运行时能读到 true（onPause 竞态会在之后才把 isPlaying 置 false）
          setMiniAutoplay(true)
          setHostMode('mini')
        } else {
          setHostMode('closed')
        }
      }
    }

    prevRef.current = cur
  }, [pathname, hostMode, setHostMode])

  return null
}
