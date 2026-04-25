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
  const setMiniResumeTime = usePlayerStore((s) => s.setMiniResumeTime)

  // 仅在 watch 页面内更新，离开后冻结，保留导航前的播放状态与进度
  // 用 ref 而不是订阅 store.currentTime：
  // 1. 避免 timeupdate 高频触发整个 RoutePlayerSync 重渲染
  // 2. 离开 watch 后的 store.currentTime 写入路径不可信（任何中间清零都会污染快照）
  const watchPlayingRef = useRef(false)
  const watchCurrentTimeRef = useRef(0)
  useEffect(() => {
    if (pathname.includes('/watch/')) {
      watchPlayingRef.current = isPlaying
    }
  }, [pathname, isPlaying])

  // 在 watch 页面期间持续从 store 拉取最新 currentTime 到 ref，离开后冻结
  // 用 subscribe 而非 useEffect+订阅：避免 effect cleanup 时序问题
  useEffect(() => {
    if (!pathname.includes('/watch/')) return
    const unsub = usePlayerStore.subscribe((state) => {
      watchCurrentTimeRef.current = state.currentTime
    })
    // 立即同步一次（防止订阅启动前 store 已有值未捕获）
    watchCurrentTimeRef.current = usePlayerStore.getState().currentTime
    return unsub
  }, [pathname])

  // 路由跳转检测：读 ref 而非响应式 isPlaying，避免卸载时序竞争
  useEffect(() => {
    const prev = prevRef.current
    const cur = pathname

    if (prev !== null) {
      const wasWatch = prev.includes('/watch/')
      const isWatch = cur.includes('/watch/')

      if (wasWatch && !isWatch && hostMode === 'full') {
        if (watchPlayingRef.current) {
          // setMiniAutoplay + setMiniResumeTime 在 setHostMode 前同步写入：
          // 1. miniAutoplay 绕过 onPause 竞态（isPlaying 此时已可能被置 false）
          // 2. miniResumeTime 显式快照离开瞬间的进度，绕过 store.currentTime 在 mini fetch 期间
          //    被任何中间路径清零的不确定性（是 video 进度恢复的权威来源）
          setMiniAutoplay(true)
          setMiniResumeTime(watchCurrentTimeRef.current)
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
