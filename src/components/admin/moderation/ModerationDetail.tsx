/**
 * ModerationDetail.tsx — 审核台右侧详情面板（CHG-223）
 * 展示视频元数据 + 内嵌播放器 + 审核操作按钮（通过 / 拒绝）
 * CHG-341: 修正 tv→series 映射；支持多源切换（limit=10）
 */

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { buildLineDisplayName } from '@/lib/line-display-name'
import { ModerationPlayer } from '@/components/admin/moderation/ModerationPlayer'

interface VideoDetail {
  id: string
  title: string
  type: string
  year: number | null
  description: string | null
  cover_url: string | null
  review_status: string
  visibility_status: string
  created_at: string
}

interface SourceRow {
  id: string
  source_url: string
  source_name: string
  site_key?: string | null
  quality?: string | null
  episode_number: number
  is_active: boolean
}

interface ModerationDetailProps {
  videoId: string | null
  onReviewed?: () => void
}

// 与 VideoMetaSchema 保持一致（CHG-341：修正 tv→series，补全 11 类）
const TYPE_LABELS: Record<string, string> = {
  movie: '电影',
  series: '剧集',
  anime: '动漫',
  variety: '综艺',
  documentary: '纪录片',
  short: '短片',
  sports: '体育',
  music: '音乐',
  news: '新闻',
  kids: '少儿',
  other: '其他',
}

export function ModerationDetail({ videoId, onReviewed }: ModerationDetailProps) {
  const [video, setVideo] = useState<VideoDetail | null>(null)
  const [sources, setSources] = useState<SourceRow[]>([])
  const [selectedLine, setSelectedLine] = useState<string | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [reviewLoading, setReviewLoading] = useState<'approve' | 'reject' | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchAllActiveSources = useCallback(async (id: string): Promise<SourceRow[]> => {
    const pageSize = 100
    let page = 1
    let total = 0
    const merged: SourceRow[] = []

    do {
      const res = await apiClient.get<{ data: SourceRow[]; total: number }>(
        `/admin/sources?videoId=${id}&status=active&page=${page}&limit=${pageSize}`
      )
      if (page === 1) total = res.total
      merged.push(...res.data)
      if (res.data.length === 0) break
      page += 1
    } while (merged.length < total)

    return merged
  }, [])

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    setSources([])
    setSelectedLine(null)
    setSelectedEpisode(1)
    try {
      const videoRes = await apiClient.get<{ data: VideoDetail }>(`/admin/videos/${id}`)
      setVideo(videoRes.data)
      try {
        const allSources = await fetchAllActiveSources(id)
        setSources(allSources)
        if (allSources.length > 0) {
          const first = allSources[0]
          setSelectedLine(first.source_name || '默认线路')
          setSelectedEpisode(first.episode_number || 1)
        }
      } catch {
        setSources([])
      }
    } catch {
      setError('加载失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [fetchAllActiveSources])

  useEffect(() => {
    if (videoId) {
      void fetchDetail(videoId)
    } else {
      setVideo(null)
      setSources([])
      setSelectedLine(null)
      setSelectedEpisode(1)
      setRejectReason('')
    }
  }, [videoId, fetchDetail])

  const handleReview = useCallback(async (action: 'approve' | 'reject') => {
    if (!videoId) return
    const reason = rejectReason.trim()
    setReviewLoading(action)
    try {
      await apiClient.post(`/admin/videos/${videoId}/review`, action === 'reject' && reason.length > 0
        ? { action, reason }
        : { action })
      if (action === 'reject') setRejectReason('')
      onReviewed?.()
    } catch (_err) {
      setError('审核操作失败，请重试')
    } finally {
      setReviewLoading(null)
    }
  }, [videoId, onReviewed, rejectReason])

  const groupedLines = useMemo(() => {
    const lines = new Map<string, SourceRow[]>()
    for (const row of sources) {
      const normalizedName = row.source_name?.trim()
      const key = normalizedName && normalizedName.length > 0 ? normalizedName : '默认线路'
      const list = lines.get(key)
      if (list) {
        list.push(row)
      } else {
        lines.set(key, [row])
      }
    }

    return Array.from(lines.entries()).map(([name, rows], idx) => ({
      name,
      displayName: buildLineDisplayName({
        rawName: name,
        fallbackIndex: idx,
        quality: rows[0]?.quality ?? null,
      }),
      siteKey: rows[0]?.site_key?.trim() || null,
      rows: rows.slice().sort((a, b) => a.episode_number - b.episode_number),
    }))
  }, [sources])

  const siteKeys = useMemo(() => {
    const unique = new Set<string>()
    for (const line of groupedLines) {
      if (line.siteKey) unique.add(line.siteKey)
    }
    return Array.from(unique)
  }, [groupedLines])

  const isSiteLineOneToOne = useMemo(() => {
    if (groupedLines.length === 0) return false
    const seen = new Map<string, number>()
    for (const line of groupedLines) {
      const key = line.siteKey || '__NO_SITE__'
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    return Array.from(seen.values()).every((count) => count === 1)
  }, [groupedLines])

  const activeLine = groupedLines.find((line) => line.name === selectedLine) ?? groupedLines[0] ?? null
  const lineEpisodes = activeLine
    ? Array.from(new Set(activeLine.rows.map((row) => row.episode_number))).sort((a, b) => a - b)
    : []
  const currentSource = activeLine
    ? activeLine.rows.find((row) => row.episode_number === selectedEpisode) ?? activeLine.rows[0] ?? null
    : null

  if (!videoId) {
    return (
      <div className="flex h-full items-center justify-center p-6" data-testid="moderation-detail-empty">
        <p className="text-sm text-[var(--muted)]">请从左侧选择视频</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4" data-testid="moderation-detail-loading">
        <div className="aspect-video w-full animate-pulse rounded-md bg-[var(--bg3)]" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--bg3)]" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--bg3)]" />
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="flex h-full items-center justify-center p-6" data-testid="moderation-detail-error">
        <p className="text-sm text-red-400">{error ?? '视频不存在'}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4" data-testid="moderation-detail">
      {/* 内嵌播放器 */}
      <ModerationPlayer
        sourceUrl={currentSource?.source_url ?? null}
        title={video.title}
        coverUrl={video.cover_url}
      />

      {/* 线路选择器（按 source_name 聚合） */}
      {groupedLines.length > 0 && (
        <div className="space-y-1" data-testid="moderation-source-selector">
          <div className="flex items-center justify-between">
            <span className="shrink-0 text-xs text-[var(--muted)]">源站/线路</span>
            <span className="shrink-0 text-xs text-[var(--muted)]">
              {groupedLines.findIndex((line) => line.name === activeLine?.name) + 1} / {groupedLines.length}
            </span>
          </div>
          {siteKeys.length > 0 && (
            <div className="text-xs text-[var(--muted)]" data-testid="moderation-site-info">
              源站：{siteKeys.join(' / ')}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {groupedLines.map((line) => (
              <button
                key={line.name}
                type="button"
                onClick={() => {
                  setSelectedLine(line.name)
                  const episodesInLine = new Set(line.rows.map((row) => row.episode_number))
                  const nextEpisode = episodesInLine.has(selectedEpisode)
                    ? selectedEpisode
                    : (line.rows[0]?.episode_number ?? 1)
                  setSelectedEpisode(nextEpisode)
                }}
                data-testid={`moderation-source-btn-${line.name}`}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  line.name === activeLine?.name
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg3)] text-[var(--muted)] hover:bg-[var(--bg2)]'
                }`}
              >
                {isSiteLineOneToOne ? (line.siteKey ?? line.displayName) : line.displayName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 选集选择器（按当前线路展示） */}
      {lineEpisodes.length > 0 && (
        <div className="flex items-center gap-2" data-testid="moderation-episode-selector">
          <span className="shrink-0 text-xs text-[var(--muted)]">
            选集
          </span>
          <div className="flex flex-wrap gap-1">
            {lineEpisodes.map((episode) => (
              <button
                key={episode}
                type="button"
                onClick={() => setSelectedEpisode(episode)}
                data-testid={`moderation-episode-btn-${episode}`}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  episode === (currentSource?.episode_number ?? selectedEpisode)
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg3)] text-[var(--muted)] hover:bg-[var(--bg2)]'
                }`}
              >
                第{episode}集
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 视频元数据 */}
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-[var(--text)]">{video.title}</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          <span>{TYPE_LABELS[video.type] ?? video.type}</span>
          {video.year && <span>· {video.year}</span>}
          <span className="rounded border border-[var(--border)] px-1.5 py-0.5">
            {video.review_status}
          </span>
        </div>
        {video.description && (
          <p className="line-clamp-3 text-xs text-[var(--muted)]">{video.description}</p>
        )}
        <p className="text-xs text-[var(--muted)]">
          入库：{video.created_at.slice(0, 10)}
        </p>
      </div>

      {/* 审核操作按钮 */}
      <div className="space-y-2" data-testid="moderation-actions">
        <div>
          <label className="mb-1 block text-xs text-[var(--muted)]" htmlFor="moderation-reject-reason-input">
            拒绝原因（可选）
          </label>
          <textarea
            id="moderation-reject-reason-input"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="例如：片源不完整、画质异常、集数错误"
            rows={2}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--muted)]"
            data-testid="moderation-reject-reason-input"
          />
        </div>
        <div className="flex gap-2">
        <button
          type="button"
          disabled={reviewLoading != null}
          onClick={() => void handleReview('approve')}
          data-testid="moderation-approve-btn"
          className="flex-1 rounded-md border border-green-500/40 bg-green-500/10 py-2 text-sm font-medium text-green-300 transition-colors hover:bg-green-500/20 disabled:opacity-50"
        >
          {reviewLoading === 'approve' ? '处理中…' : '通过'}
        </button>
        <button
          type="button"
          disabled={reviewLoading != null}
          onClick={() => void handleReview('reject')}
          data-testid="moderation-reject-btn"
          className="flex-1 rounded-md border border-red-500/40 bg-red-500/10 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
        >
          {reviewLoading === 'reject' ? '处理中…' : '拒绝'}
        </button>
        </div>
      </div>
    </div>
  )
}
