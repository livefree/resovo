'use client'

/**
 * use-images.ts — VideoEditDrawer 图片 Tab 数据层 hook（CHG-SN-4-08）
 */

import { useState, useCallback, useEffect } from 'react'
import type { VideoImagesData, VideoImageKind } from './types'
import { getVideoImages, updateVideoImage } from './api'

export type { VideoImagesData, VideoImageKind }

export interface ImagesState {
  images: VideoImagesData | null
  loading: boolean
  error: Error | null
  updatePending: Set<VideoImageKind>
}

export interface ImagesActions {
  reload: () => void
  update: (kind: VideoImageKind, url: string) => Promise<void>
}

export function useVideoImages(videoId: string): [ImagesState, ImagesActions] {
  const [images, setImages] = useState<VideoImagesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [updatePending, setUpdatePending] = useState<Set<VideoImageKind>>(new Set())

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    getVideoImages(videoId)
      .then(setImages)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [videoId])

  useEffect(() => { reload() }, [reload])

  const update = useCallback(async (kind: VideoImageKind, url: string) => {
    setUpdatePending((prev) => new Set(prev).add(kind))
    try {
      await updateVideoImage(videoId, kind, url)
      setImages((prev) => prev ? { ...prev, [kind]: { url, status: 'pending_review' } } : prev)
    } finally {
      setUpdatePending((prev) => { const next = new Set(prev); next.delete(kind); return next })
    }
  }, [videoId])

  return [{ images, loading, error, updatePending }, { reload, update }]
}
