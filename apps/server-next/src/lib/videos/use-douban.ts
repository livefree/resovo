'use client'

/**
 * use-douban.ts — VideoEditDrawer 豆瓣 Tab 数据层 hook（CHG-SN-4-08）
 */

import { useState, useCallback, useEffect } from 'react'
import type { DoubanSuggestItem, DoubanCandidateData } from './types'
import type { DoubanStatus } from '@resovo/types'
import {
  searchDoubanForVideo,
  confirmDoubanMatch,
  ignoreDoubanMatch,
  getDoubanCandidate,
} from './api'

export type { DoubanSuggestItem, DoubanCandidateData }

export interface DoubanTabState {
  candidate: DoubanCandidateData | null
  candidateLoading: boolean
  candidateError: Error | null
  searchResults: DoubanSuggestItem[]
  searching: boolean
  searchError: string | null
  confirming: boolean
  ignoring: boolean
  actionError: string | null
}

export interface DoubanTabActions {
  loadCandidate: () => void
  search: (keyword: string) => Promise<void>
  confirm: (subjectId: string) => Promise<void>
  ignore: () => Promise<void>
  clearSearchResults: () => void
  clearActionError: () => void
}

export function useDoubanTab(
  videoId: string,
  doubanStatus: DoubanStatus | undefined,
  onConfirmed: () => void,
): [DoubanTabState, DoubanTabActions] {
  const [candidate, setCandidate] = useState<DoubanCandidateData | null>(null)
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [candidateError, setCandidateError] = useState<Error | null>(null)
  const [searchResults, setSearchResults] = useState<DoubanSuggestItem[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [ignoring, setIgnoring] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadCandidate = useCallback(() => {
    if (doubanStatus !== 'candidate' && doubanStatus !== 'matched') return
    setCandidateLoading(true)
    setCandidateError(null)
    getDoubanCandidate(videoId)
      .then(setCandidate)
      .catch((e: unknown) => setCandidateError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setCandidateLoading(false))
  }, [videoId, doubanStatus])

  useEffect(() => { loadCandidate() }, [loadCandidate])

  const search = useCallback(async (keyword: string) => {
    setSearching(true)
    setSearchError(null)
    try {
      const res = await searchDoubanForVideo(videoId, keyword)
      setSearchResults(res.candidates)
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : '搜索失败')
    } finally {
      setSearching(false)
    }
  }, [videoId])

  const confirm = useCallback(async (subjectId: string) => {
    setConfirming(true)
    setActionError(null)
    try {
      await confirmDoubanMatch(videoId, subjectId)
      onConfirmed()
      setSearchResults([])
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : '确认失败')
    } finally {
      setConfirming(false)
    }
  }, [videoId, onConfirmed])

  const ignore = useCallback(async () => {
    setIgnoring(true)
    setActionError(null)
    try {
      await ignoreDoubanMatch(videoId)
      onConfirmed()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setIgnoring(false)
    }
  }, [videoId, onConfirmed])

  const clearSearchResults = useCallback(() => { setSearchResults([]) }, [])
  const clearActionError = useCallback(() => { setActionError(null) }, [])

  return [
    { candidate, candidateLoading, candidateError, searchResults, searching, searchError, confirming, ignoring, actionError },
    { loadCandidate, search, confirm, ignore, clearSearchResults, clearActionError },
  ]
}
