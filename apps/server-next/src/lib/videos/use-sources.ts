'use client'

/**
 * use-sources.ts — VideoEditDrawer 线路 Tab 数据层 hook（CHG-SN-4-08）
 */

import { useState, useCallback, useEffect } from 'react'
import type { VideoSource, SignalStatus } from './types'
import type { DualSignalDisplayState } from '@resovo/types'
import {
  listVideoSources,
  toggleVideoSource,
  disableDeadSources,
  refetchSources,
  getLineHealthEvents,
  type LineHealthResult,
} from './api'

export type { VideoSource, SignalStatus }

export interface SourcesState {
  sources: VideoSource[]
  loading: boolean
  error: Error | null
  togglePending: Set<string>
  bulkPending: boolean
  refetchPending: boolean
  health: LineHealthResult | null
  healthLoading: boolean
  healthSourceId: string | null
  healthPage: number
}

export interface SourcesActions {
  reload: () => void
  toggle: (sourceId: string, isActive: boolean) => Promise<void>
  disableDead: () => Promise<void>
  refetch: (siteKeys?: string[]) => Promise<void>
  openHealth: (sourceId: string) => void
  closeHealth: () => void
  loadHealthPage: (page: number) => void
}

export function toDisplayState(status: SignalStatus): DualSignalDisplayState {
  if (status === 'pending') return 'pending'
  return status
}

export function useVideoSources(videoId: string): [SourcesState, SourcesActions] {
  const [sources, setSources] = useState<VideoSource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [togglePending, setTogglePending] = useState<Set<string>>(new Set())
  const [bulkPending, setBulkPending] = useState(false)
  const [refetchPending, setRefetchPending] = useState(false)
  const [health, setHealth] = useState<LineHealthResult | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthSourceId, setHealthSourceId] = useState<string | null>(null)
  const [healthPage, setHealthPage] = useState(1)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    listVideoSources(videoId)
      .then(setSources)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [videoId])

  useEffect(() => { reload() }, [reload])

  const toggle = useCallback(async (sourceId: string, isActive: boolean) => {
    setTogglePending((prev) => new Set(prev).add(sourceId))
    const snapshot = sources
    setSources((prev) => prev.map((s) => s.id === sourceId ? { ...s, is_active: isActive } : s))
    try {
      await toggleVideoSource(videoId, sourceId, isActive)
    } catch (e: unknown) {
      setSources(snapshot)
      throw e
    } finally {
      setTogglePending((prev) => { const next = new Set(prev); next.delete(sourceId); return next })
    }
  }, [videoId, sources])

  const disableDead = useCallback(async () => {
    setBulkPending(true)
    try {
      await disableDeadSources(videoId)
      await listVideoSources(videoId).then(setSources)
    } finally {
      setBulkPending(false)
    }
  }, [videoId])

  const refetch = useCallback(async (siteKeys?: string[]) => {
    setRefetchPending(true)
    try { await refetchSources(videoId, siteKeys) } finally { setRefetchPending(false) }
  }, [videoId])

  const loadHealth = useCallback((sid: string, page: number) => {
    setHealthLoading(true)
    getLineHealthEvents(videoId, sid, page)
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setHealthLoading(false))
  }, [videoId])

  const openHealth = useCallback((sourceId: string) => {
    setHealthSourceId(sourceId)
    setHealthPage(1)
    loadHealth(sourceId, 1)
  }, [loadHealth])

  const closeHealth = useCallback(() => {
    setHealthSourceId(null)
    setHealth(null)
  }, [])

  const loadHealthPage = useCallback((page: number) => {
    setHealthPage(page)
    if (healthSourceId) loadHealth(healthSourceId, page)
  }, [healthSourceId, loadHealth])

  const state: SourcesState = {
    sources, loading, error, togglePending, bulkPending, refetchPending,
    health, healthLoading, healthSourceId, healthPage,
  }

  const actions: SourcesActions = { reload, toggle, disableDead, refetch, openHealth, closeHealth, loadHealthPage }

  return [state, actions]
}
