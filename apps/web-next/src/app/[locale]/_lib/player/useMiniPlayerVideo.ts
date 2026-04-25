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
      // 同步读 store 快照，绕过两个竞态问题：
      // 1. isPlaying：onPause 在 full player 卸载时早于 activeSrc 到达，闭包值已是 false
      // 2. miniAutoplay：RoutePlayerSync 在 setHostMode('mini') 前同步写入此标志
      // 3. currentTime：闭包快照在 activeSrc=null 分支时被清零，需重读最新值
      const snap = usePlayerStore.getState()
      const resumeTime = snap.currentTime
      const autoplay = snap.miniAutoplay
      if (autoplay) snap.setMiniAutoplay(false)   // 消费后立即清零
      shouldAutoplayRef.current = autoplay
      startTimeRef.current = resumeTime

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

  const handleVideoCanPlay = useCallback(() => {
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
  }, [videoRef, updateVideoStatus])

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
    // Re-apply start time if browser reset currentTime during loadedmetadata
    const saved = startTimeRef.current
    if (saved > 0 && video.currentTime < saved * 0.95) {
      video.currentTime = saved
    }
    startTimeRef.current = 0
    setLocalDuration(video.duration)
    setDuration(video.duration)
  }, [videoRef, setDuration])

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
    handleVideoVolumeChange,
    handleAutoplayBlockedClick,
    handleSeek,
  }
}
