'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { apiClient } from '@/lib/api-client'
import { saveProgress } from '@/components/player/ResumePrompt'
import type { VideoSource, ApiListResponse } from '@resovo/types'

export type VideoStatus = 'no-src' | 'loading' | 'error' | 'autoplay-blocked' | 'idle'

export interface UseMiniPlayerVideoReturn {
  activeSrc: string | null
  videoStatus: VideoStatus
  isMuted: boolean
  localCurrentTime: number
  localDuration: number
  handleToggleMute: () => void
  handleTogglePlay: () => void
  handleVideoCanPlay: () => void
  handleVideoPlay: () => void
  handleVideoPause: () => void
  handleVideoError: () => void
  handleVideoTimeUpdate: () => void
  handleVideoLoadedMetadata: () => void
  handleVideoLoadedData: () => void
  handleVideoVolumeChange: () => void
  handleAutoplayBlockedClick: () => void
  handleSeek: (time: number) => void
}

const TIMEUPDATE_THROTTLE_MS = 250

export function useMiniPlayerVideo(
  videoRef: React.RefObject<HTMLVideoElement | null>
): UseMiniPlayerVideoReturn {
  const shortId = usePlayerStore((s) => s.shortId)
  const currentEpisode = usePlayerStore((s) => s.currentEpisode)
  const isPlayingStore = usePlayerStore((s) => s.isPlaying)
  const currentTimeStore = usePlayerStore((s) => s.currentTime)
  const activeSourceIndex = usePlayerStore((s) => s.activeSourceIndex)
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime)
  const setDuration = usePlayerStore((s) => s.setDuration)
  const setPlaying = usePlayerStore((s) => s.setPlaying)
  const isMutedStore = usePlayerStore((s) => s.isMuted)
  const setIsMutedStore = usePlayerStore((s) => s.setIsMuted)
  const volumeStore = usePlayerStore((s) => s.volume)
  const setVolumeStore = usePlayerStore((s) => s.setVolume)

  const [activeSrc, setActiveSrc] = useState<string | null>(null)
  const [videoStatus, setVideoStatus] = useState<VideoStatus>('no-src')
  // initialize from store (already hydrated from sessionStorage when MiniPlayer mounts)
  const [isMuted, setIsMuted] = useState(isMutedStore)
  const [localCurrentTime, setLocalCurrentTime] = useState(0)
  const [localDuration, setLocalDuration] = useState(0)

  // Stable refs for callbacks
  const shouldAutoplayRef = useRef(false)
  const startTimeRef = useRef<number>(0)
  const lastThrottleTimeRef = useRef(0)
  const videoStatusRef = useRef<VideoStatus>('no-src')
  const shortIdRef = useRef(shortId)
  const currentEpisodeRef = useRef(currentEpisode)
  const setCurrentTimeRef = useRef(setCurrentTime)
  const isMutedRef = useRef(isMutedStore)
  const volumeRef = useRef(volumeStore)
  // P0-2: HLS instance ref
  const hlsRef = useRef<import('hls.js').default | null>(null)

  useEffect(() => { shortIdRef.current = shortId }, [shortId])
  useEffect(() => { currentEpisodeRef.current = currentEpisode }, [currentEpisode])
  useEffect(() => { setCurrentTimeRef.current = setCurrentTime }, [setCurrentTime])
  useEffect(() => { isMutedRef.current = isMutedStore }, [isMutedStore])
  useEffect(() => { volumeRef.current = volumeStore }, [volumeStore])

  const updateVideoStatus = useCallback((status: VideoStatus) => {
    videoStatusRef.current = status
    setVideoStatus(status)
  }, [])

  // Fetch sources on shortId / episode change
  useEffect(() => {
    if (!shortId) {
      setActiveSrc(null)
      updateVideoStatus('no-src')
      return
    }
    updateVideoStatus('loading')
    let cancelled = false
    apiClient
      .get<ApiListResponse<VideoSource>>(
        `/videos/${shortId}/sources?episode=${currentEpisode}`,
        { skipAuth: true }
      )
      .then((res) => {
        if (cancelled) return
        const sources = res.data ?? []
        if (sources.length === 0) {
          setActiveSrc(null)
          updateVideoStatus('no-src')
          return
        }
        const idx = activeSourceIndex < sources.length ? activeSourceIndex : 0
        const url = sources[idx]?.sourceUrl ?? sources[0]?.sourceUrl ?? null
        setActiveSrc(url)
        if (!url) updateVideoStatus('no-src')
        // keep 'loading' until canplay fires
      })
      .catch(() => {
        if (cancelled) return
        setActiveSrc(null)
        updateVideoStatus('no-src')
      })
    return () => { cancelled = true }
  // activeSourceIndex intentionally excluded — resolved per episode load, not per user switch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortId, currentEpisode])

  // Apply src to video element; snapshot autoplay intent and resume position
  // P0-2: HLS.js support for .m3u8 sources on browsers without native HLS
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    function destroyHls() {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }

    let cancelled = false

    if (activeSrc) {
      destroyHls()
      // 同步读 store 快照，绕过竞态：
      // 1. isPlaying：onPause 在 full player 卸载时早于 activeSrc 到达，闭包值已是 false
      // 2. miniAutoplay：RoutePlayerSync 在 setHostMode('mini') 前同步写入此标志
      // 3. resumeTime：优先读 miniResumeTime（RoutePlayerSync 切 mini 前显式快照的权威值，
      //    不会被 fetch sources 期间的中间清零路径污染）；fallback 到 currentTime（hydrate
      //    场景：刷新后从 sessionStorage 恢复 mini，无 miniResumeTime 但 currentTime 有效）
      const snap = usePlayerStore.getState()
      const resumeTime = snap.miniResumeTime > 0 ? snap.miniResumeTime : snap.currentTime
      const autoplay = snap.miniAutoplay
      if (autoplay) snap.setMiniAutoplay(false)   // 消费后立即清零
      if (snap.miniResumeTime > 0) snap.setMiniResumeTime(0)   // 消费后立即清零
      shouldAutoplayRef.current = autoplay
      startTimeRef.current = resumeTime
      // 同步推到 localCurrentTime，避免控件 00:00 闪烁直到首次 timeupdate；
      // 也同步写回 store.currentTime，让 mini 内的进度显示有正确起点
      if (resumeTime > 0) {
        setLocalCurrentTime(resumeTime)
        setCurrentTimeRef.current(resumeTime)
      }

      // apply persisted mute/volume from store (restored from sessionStorage)
      video.muted = isMutedRef.current
      video.volume = volumeRef.current

      const isHls = activeSrc.includes('.m3u8')
      const nativeHls = video.canPlayType('application/vnd.apple.mpegurl')

      if (isHls && !nativeHls) {
        import('hls.js').then(({ default: Hls }) => {
          if (cancelled || !videoRef.current) return
          if (!Hls.isSupported()) {
            videoRef.current.src = activeSrc
            if (resumeTime > 0) videoRef.current.currentTime = resumeTime
            return
          }
          // startPosition 让 hls.js 在 manifest 解析后直接跳到目标位置，
          // 比 loadedmetadata 后再 seek 更可靠（避免 segment 未加载时 currentTime 被重置）
          const hls = new Hls({ startPosition: resumeTime > 0 ? resumeTime : -1 })
          hlsRef.current = hls
          hls.loadSource(activeSrc)
          hls.attachMedia(videoRef.current)
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) updateVideoStatus('error')
          })
        }).catch(() => {
          if (cancelled || !videoRef.current) return
          videoRef.current.src = activeSrc
        })
      } else {
        video.src = activeSrc
        // Best-effort immediate seek; browsers that reset currentTime on loadedmetadata
        // will be corrected in handleVideoLoadedMetadata via startTimeRef
        if (resumeTime > 0) video.currentTime = resumeTime
      }
    } else {
      destroyHls()
      startTimeRef.current = 0
      video.removeAttribute('src')
      video.load()
    }

    return () => {
      cancelled = true
      destroyHls()
    }
  // currentTimeStore / isPlayingStore: intentional snapshot — only on src set, not on every tick
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSrc])

  // 兜底 seek：在 loadedmetadata / loadeddata / canplay 多个事件点尝试恢复 currentTime
  // native HLS / mp4 path 在 readyState=0 时设置 video.currentTime 可能被浏览器忽略；
  // loadedmetadata 时第一次 seek 不一定生效，需后续事件兜底
  const restoreSeekIfNeeded = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const saved = startTimeRef.current
    if (saved <= 0) return
    if (video.currentTime < saved * 0.95) {
      video.currentTime = saved
    }
    // 同步读 video.currentTime 验证：若 seek 已经接近目标则清零标志，停止后续兜底
    if (video.currentTime >= saved * 0.95) {
      startTimeRef.current = 0
    }
  }, [videoRef])

  const handleVideoCanPlay = useCallback(() => {
    restoreSeekIfNeeded()
    if (videoStatusRef.current !== 'autoplay-blocked') {
      updateVideoStatus('idle')
    }
    if (shouldAutoplayRef.current) {
      shouldAutoplayRef.current = false
      videoRef.current?.play().catch((err: Error) => {
        if (err.name === 'NotAllowedError') {
          updateVideoStatus('autoplay-blocked')
        }
      })
    }
  }, [videoRef, updateVideoStatus, restoreSeekIfNeeded])

  const handleVideoLoadedData = useCallback(() => {
    restoreSeekIfNeeded()
  }, [restoreSeekIfNeeded])

  const handleVideoPlay = useCallback(() => {
    updateVideoStatus('idle')
    setPlaying(true)
  }, [setPlaying, updateVideoStatus])

  const handleVideoPause = useCallback(() => {
    setPlaying(false)
  }, [setPlaying])

  const handleVideoError = useCallback(() => {
    updateVideoStatus('error')
    setPlaying(false)
  }, [setPlaying, updateVideoStatus])

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const t = video.currentTime
    // startTimeRef > 0 表示尚未完成 resume seek（loadedmetadata 还没修正 video.currentTime）
    // 此时浏览器 emit 的 timeupdate(0) 不可信，仅更新 localCurrentTime（保持 resumeTime 显示），不写 store
    if (startTimeRef.current > 0) return
    setLocalCurrentTime(t)
    const now = Date.now()
    if (now - lastThrottleTimeRef.current >= TIMEUPDATE_THROTTLE_MS) {
      lastThrottleTimeRef.current = now
      setCurrentTimeRef.current(t)
      const sid = shortIdRef.current
      const ep = currentEpisodeRef.current
      if (sid) saveProgress(sid, ep, t)
    }
  }, [videoRef])

  const handleVideoLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video || isNaN(video.duration)) return
    setLocalDuration(video.duration)
    setDuration(video.duration)
    // 第一次 seek 兜底（不立即清零 startTimeRef，留给 restoreSeekIfNeeded 判断 seek 是否真的生效）
    restoreSeekIfNeeded()
  }, [videoRef, setDuration, restoreSeekIfNeeded])

  const handleToggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
    setIsMutedStore(video.muted)
  }, [videoRef, setIsMutedStore])

  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current
    const status = videoStatusRef.current
    if (!video || status === 'no-src' || status === 'error') return
    if (status === 'autoplay-blocked') {
      video.play().catch(() => { /* still blocked */ })
      return
    }
    if (video.paused) {
      video.play().catch(() => { /* ignore */ })
    } else {
      video.pause()
    }
  }, [videoRef])

  const handleVideoVolumeChange = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setIsMuted(video.muted)
    setIsMutedStore(video.muted)
    setVolumeStore(video.volume)
  }, [videoRef, setIsMutedStore, setVolumeStore])

  const handleAutoplayBlockedClick = useCallback(() => {
    videoRef.current?.play().catch(() => { /* still blocked */ })
  }, [videoRef])

  // P1-3: immediately write store + localStorage after seek, without waiting for timeupdate
  const handleSeek = useCallback((time: number) => {
    setLocalCurrentTime(time)
    setCurrentTimeRef.current(time)
    const sid = shortIdRef.current
    const ep = currentEpisodeRef.current
    if (sid) saveProgress(sid, ep, time)
  }, [])

  return {
    activeSrc,
    videoStatus,
    isMuted,
    localCurrentTime,
    localDuration,
    handleToggleMute,
    handleTogglePlay,
    handleVideoCanPlay,
    handleVideoPlay,
    handleVideoPause,
    handleVideoError,
    handleVideoTimeUpdate,
    handleVideoLoadedMetadata,
    handleVideoLoadedData,
    handleVideoVolumeChange,
    handleAutoplayBlockedClick,
    handleSeek,
  }
}
