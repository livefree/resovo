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
  handleAutoplayBlockedClick: () => void
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

  const [activeSrc, setActiveSrc] = useState<string | null>(null)
  const [videoStatus, setVideoStatus] = useState<VideoStatus>('no-src')
  const [isMuted, setIsMuted] = useState(false)
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

  useEffect(() => { shortIdRef.current = shortId }, [shortId])
  useEffect(() => { currentEpisodeRef.current = currentEpisode }, [currentEpisode])
  useEffect(() => { setCurrentTimeRef.current = setCurrentTime }, [setCurrentTime])

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
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (activeSrc) {
      shouldAutoplayRef.current = isPlayingStore
      startTimeRef.current = currentTimeStore  // saved for loadedmetadata re-apply
      video.src = activeSrc
      // Best-effort immediate seek; browsers that reset currentTime on loadedmetadata
      // will be corrected in handleVideoLoadedMetadata via startTimeRef
      if (currentTimeStore > 0) video.currentTime = currentTimeStore
    } else {
      startTimeRef.current = 0
      video.removeAttribute('src')
      video.load()
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
  }, [videoRef])

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

  const handleAutoplayBlockedClick = useCallback(() => {
    videoRef.current?.play().catch(() => { /* still blocked */ })
  }, [videoRef])

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
    handleAutoplayBlockedClick,
  }
}
