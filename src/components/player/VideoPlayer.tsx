/**
 * VideoPlayer.tsx — Video.js + HLS.js 播放器组件
 * 支持 HLS（.m3u8）和 MP4；组件卸载时正确销毁实例
 * 必须通过 dynamic import + ssr: false 使用，不可 SSR
 */

'use client'

import { useEffect, useRef } from 'react'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import 'video.js/dist/video-js.css'

export type SourceType = 'hls' | 'mp4' | 'dash'

export interface VideoSource {
  src: string
  type: SourceType
  label?: string
}

interface VideoPlayerProps {
  sources: VideoSource[]
  /** 初始集数，切换时触发重新加载 */
  episode?: number
  /** 断点续播起始时间（秒） */
  startTime?: number
  onReady?: (player: Player) => void
  onPlay?: () => void
  onPause?: () => void
  onTimeUpdate?: (time: number) => void
  onEnded?: () => void
  className?: string
}

const MIME_MAP: Record<SourceType, string> = {
  hls:  'application/x-mpegURL',
  mp4:  'video/mp4',
  dash: 'application/dash+xml',
}

export function VideoPlayer({
  sources,
  episode,
  startTime = 0,
  onReady,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)

  // ── 初始化 Video.js ──────────────────────────────────────────────

  useEffect(() => {
    if (!videoRef.current) return

    // 避免热重载时重复初始化
    if (playerRef.current) return

    const videoEl = document.createElement('video')
    videoEl.className = 'video-js vjs-fill'
    videoRef.current.appendChild(videoEl)

    const vjsSources = sources.map((s) => ({
      src: s.src,
      type: MIME_MAP[s.type],
    }))

    const player = videojs(videoEl, {
      controls: false,     // 使用自定义控制栏（PLAYER-04）
      autoplay: false,
      preload: 'metadata',
      fluid: false,
      fill: true,
      sources: vjsSources,
      html5: {
        vhs: {
          overrideNative: !videojs.browser.IS_SAFARI,
        },
      },
    })

    playerRef.current = player

    // 断点续播起始时间
    if (startTime > 30) {
      player.on('loadedmetadata', () => {
        player.currentTime(startTime)
      })
    }

    // 事件回调
    player.on('ready', () => onReady?.(player))
    player.on('play',  () => onPlay?.())
    player.on('pause', () => onPause?.())
    player.on('ended', () => onEnded?.())
    player.on('timeupdate', () => {
      onTimeUpdate?.(player.currentTime() ?? 0)
    })

    return () => {
      // 组件卸载时销毁播放器实例，防止内存泄漏
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose()
        playerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 集数变化时切换视频源 ─────────────────────────────────────────

  useEffect(() => {
    const player = playerRef.current
    if (!player || player.isDisposed() || sources.length === 0) return

    const vjsSources = sources.map((s) => ({
      src: s.src,
      type: MIME_MAP[s.type],
    }))

    player.src(vjsSources)
    player.currentTime(0)
  }, [episode, sources])

  return (
    <div
      ref={videoRef}
      className={className}
      style={{ width: '100%', height: '100%' }}
      data-testid="video-player"
    />
  )
}
