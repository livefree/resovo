'use client'

/**
 * use-tmdb.ts — VideoEditDrawer TMDB Tab 数据层 hook（ADR-202 / META-39-B）
 * 对齐 use-douban：state（候选/搜索/确认/拒绝）+ actions，消费 tmdb-search/confirm/reject 端点。
 */

import { useState, useCallback } from 'react'
import type { TmdbCandidate, TmdbMediaType } from './types'
import { tmdbSearchForVideo, tmdbConfirmForVideo, tmdbRejectForVideo } from './api'

export type { TmdbCandidate, TmdbMediaType }

export interface TmdbTabState {
  searchResults: TmdbCandidate[]
  searching: boolean
  searchError: string | null
  confirming: boolean
  rejecting: boolean
  actionError: string | null
}

export interface TmdbTabActions {
  search: (query: string, mediaType: TmdbMediaType, year?: number) => Promise<void>
  /** 确认候选并应用选中字段；返回是否成功（冲突/失败 → false + actionError）。 */
  confirm: (tmdbId: number, mediaType: TmdbMediaType, fields: string[], seasonNumber?: number) => Promise<boolean>
  reject: (tmdbId: number) => Promise<void>
  clearSearchResults: () => void
  clearActionError: () => void
}

export function useTmdbTab(videoId: string, onConfirmed: () => void): [TmdbTabState, TmdbTabActions] {
  const [searchResults, setSearchResults] = useState<TmdbCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const search = useCallback(async (query: string, mediaType: TmdbMediaType, year?: number) => {
    setSearching(true)
    setSearchError(null)
    try {
      const res = await tmdbSearchForVideo(videoId, { query, mediaType, year })
      setSearchResults(res.candidates)
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : '搜索失败')
    } finally {
      setSearching(false)
    }
  }, [videoId])

  const confirm = useCallback(async (tmdbId: number, mediaType: TmdbMediaType, fields: string[], seasonNumber?: number): Promise<boolean> => {
    setConfirming(true)
    setActionError(null)
    try {
      await tmdbConfirmForVideo(videoId, { tmdbId, mediaType, seasonNumber, fields })
      onConfirmed()
      setSearchResults([])
      return true
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : '确认失败')
      return false
    } finally {
      setConfirming(false)
    }
  }, [videoId, onConfirmed])

  const reject = useCallback(async (tmdbId: number) => {
    setRejecting(true)
    setActionError(null)
    try {
      await tmdbRejectForVideo(videoId, tmdbId)
      setSearchResults((prev) => prev.filter((c) => c.tmdbId !== tmdbId))
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : '拒绝失败')
    } finally {
      setRejecting(false)
    }
  }, [videoId])

  const clearSearchResults = useCallback(() => { setSearchResults([]) }, [])
  const clearActionError = useCallback(() => { setActionError(null) }, [])

  return [
    { searchResults, searching, searchError, confirming, rejecting, actionError },
    { search, confirm, reject, clearSearchResults, clearActionError },
  ]
}
