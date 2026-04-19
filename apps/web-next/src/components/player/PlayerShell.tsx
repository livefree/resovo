'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { apiClient } from '@/lib/api-client'
import { extractShortId } from '@/lib/video-detail'
import { getVideoDetailHref } from '@/lib/video-route'
import { buildLineDisplayName, deduplicateLabels } from '@/lib/line-display-name'
import type { Video, VideoSource, ApiResponse, ApiListResponse } from '@resovo/types'
import { SourceBar } from './SourceBar'
import { ResumePrompt, saveProgress } from './ResumePrompt'
import { getInlineEpisodes, getPlayerLayoutClass, getSidePanelClass } from './playerShell.layout'

const VideoPlayer = dynamic(
  () => import('./VideoPlayer').then((m) => ({ default: m.VideoPlayer })),
  { ssr: false }
)

interface PlayerShellProps {
  slug: string
}

export function PlayerShell({ slug }: PlayerShellProps) {
  const searchParams = useSearchParams()
  const {
    mode,
    setMode,
    initPlayer,
    currentEpisode,
    setEpisode,
    setPlaying,
    setCurrentTime,
    setDuration,
  } = usePlayerStore()

  const [video, setVideo] = useState<Video | null>(null)
  const [sources, setSources] = useState<Array<{ src: string; type: string; label?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [activeSourceIndex, setActiveSourceIndex] = useState(0)
  const [startTime, setStartTime] = useState<number | undefined>(undefined)
  const [playerVersion, setPlayerVersion] = useState(0)
  const [activePanelTab, setActivePanelTab] = useState<'episodes' | 'sources'>('episodes')

  const shortId = extractShortId(slug)

  useEffect(() => {
    const ep = Number(searchParams.get('ep') ?? '1') || 1
    setLoading(true)
    apiClient
      .get<ApiResponse<Video>>(`/videos/${shortId}`, { skipAuth: true })
      .then((res) => {
        setVideo(res.data)
        initPlayer(shortId, ep)
        apiClient
          .get<ApiListResponse<VideoSource>>(
            `/videos/${shortId}/sources?episode=${ep}`,
            { skipAuth: true }
          )
          .then((r) => {
            setSources(
              deduplicateLabels(
                r.data.map((s, index) => ({
                  src: s.sourceUrl,
                  type: s.type,
                  label: buildLineDisplayName({
                    rawName: s.sourceName,
                    siteDisplayName: s.siteDisplayName,
                    fallbackIndex: index,
                    quality: s.quality,
                  }),
                }))
              )
            )
            setActiveSourceIndex(0)
          })
          .catch(() => setSources([]))
      })
      .catch(() => setVideo(null))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortId])

  useEffect(() => {
    if (!shortId || !video) return
    setStartTime(undefined)
    apiClient
      .get<ApiListResponse<VideoSource>>(
        `/videos/${shortId}/sources?episode=${currentEpisode}`,
        { skipAuth: true }
      )
      .then((res) => {
        const newSources = deduplicateLabels(
          res.data.map((s, index) => ({
            src: s.sourceUrl,
            type: s.type,
            label: buildLineDisplayName({
              rawName: s.sourceName,
              siteDisplayName: s.siteDisplayName,
              fallbackIndex: index,
              quality: s.quality,
            }),
          }))
        )
        setSources(newSources)
        const prevLabel = sources[activeSourceIndex]?.label
        const matched = prevLabel ? newSources.findIndex((s) => s.label === prevLabel) : -1
        setActiveSourceIndex(matched >= 0 ? matched : 0)
      })
      .catch(() => {/* 无源时保留已有源 */})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEpisode])

  const handleTimeUpdate = useCallback(
    (t: number, d: number) => {
      setCurrentTime(t)
      setDuration(d)
      if (t > 0 && shortId) saveProgress(shortId, currentEpisode, t)
    },
    [setCurrentTime, setDuration, shortId, currentEpisode]
  )

  const handleTheaterChange = useCallback(
    (isTheater: boolean) => {
      setMode(isTheater ? 'theater' : 'default')
    },
    [setMode]
  )

  const handleEpisodeChange = useCallback(
    (index: number) => {
      setEpisode(index + 1)
    },
    [setEpisode]
  )

  useEffect(() => {
    if (hasEpisodes && activePanelTab !== 'episodes' && !hasSources) {
      setActivePanelTab('episodes')
      return
    }
    if (hasSources && activePanelTab !== 'sources' && !hasEpisodes) {
      setActivePanelTab('sources')
      return
    }
    if (!hasEpisodes && activePanelTab === 'episodes' && hasSources) {
      setActivePanelTab('sources')
      return
    }
    if (!hasSources && activePanelTab === 'sources' && hasEpisodes) {
      setActivePanelTab('episodes')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanelTab, sources.length, video?.episodeCount])

  const isTheater = mode === 'theater'
  const activeSrc = sources[activeSourceIndex]?.src ?? ''
  const hasEpisodes = !!video && video.episodeCount > 1
  const hasSources = sources.length > 0
  const inlineEpisodes = getInlineEpisodes(isTheater, video?.episodeCount ?? 0)
  const hasNext = !!video && video.episodeCount > 1 && currentEpisode < video.episodeCount

  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-4">
        <div
          className="w-full rounded-lg animate-pulse"
          style={{ aspectRatio: '16/9', background: 'var(--bg-surface)' }}
        />
      </div>
    )
  }

  if (!video) {
    return (
      <div
        className="flex items-center justify-center py-20 text-sm"
        style={{ color: 'var(--fg-muted)' }}
        data-testid="player-error"
      >
        视频不存在或已下架
      </div>
    )
  }

  const detailHref = getVideoDetailHref(video)

  function renderSelectionPanel(extraClassName?: string) {
    if (!hasEpisodes && !hasSources) return null
    return (
      <div
        className={cn('rounded-lg border overflow-hidden flex flex-col', extraClassName)}
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
        data-testid="player-selection-panel"
      >
        {hasEpisodes && hasSources ? (
          <div
            className="p-1.5 border-b grid grid-cols-2 gap-1.5"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface-sunken)' }}
          >
            <button
              type="button"
              data-testid="player-tab-episodes"
              onClick={() => setActivePanelTab('episodes')}
              className={cn('py-1.5 text-xs rounded transition-colors')}
              style={
                activePanelTab === 'episodes'
                  ? { background: 'var(--accent-default)', color: 'var(--accent-fg)', fontWeight: 600 }
                  : { color: 'var(--fg-muted)' }
              }
            >
              选集
            </button>
            <button
              type="button"
              data-testid="player-tab-sources"
              onClick={() => setActivePanelTab('sources')}
              className={cn('py-1.5 text-xs rounded transition-colors')}
              style={
                activePanelTab === 'sources'
                  ? { background: 'var(--accent-default)', color: 'var(--accent-fg)', fontWeight: 600 }
                  : { color: 'var(--fg-muted)' }
              }
            >
              线路
            </button>
          </div>
        ) : (
          <div
            className="p-3 border-b"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface-sunken)' }}
          >
            <h3 className="font-semibold text-sm" style={{ color: 'var(--fg-default)' }}>
              {hasEpisodes ? '选集' : '线路'}
            </h3>
          </div>
        )}

        {hasEpisodes && activePanelTab === 'episodes' ? (
          <div className="p-2 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 max-h-[360px] overflow-y-auto scrollbar-thin">
            {Array.from({ length: video!.episodeCount }).map((_, i) => {
              const epNum = i + 1
              const isActive = currentEpisode === epNum
              return (
                <button
                  key={epNum}
                  type="button"
                  onClick={() => setEpisode(epNum)}
                  className="py-2 text-center text-sm rounded transition-colors"
                  style={
                    isActive
                      ? { background: 'var(--accent-default)', color: 'var(--accent-fg)', fontWeight: 700 }
                      : { background: 'var(--bg-surface-sunken)', color: 'var(--fg-muted)' }
                  }
                  data-testid={`side-episode-${epNum}`}
                >
                  {epNum}
                </button>
              )
            })}
          </div>
        ) : null}

        {hasSources && activePanelTab === 'sources' ? (
          <div className="p-2">
            <div className="rounded-md overflow-hidden" style={{ background: 'var(--bg-surface-sunken)' }}>
              <SourceBar
                sources={sources}
                activeIndex={activeSourceIndex}
                onSourceChange={setActiveSourceIndex}
              />
            </div>
          </div>
        ) : !hasSources && activePanelTab === 'sources' ? (
          <div
            className="p-4 text-xs text-center"
            style={{ color: 'var(--fg-muted)' }}
            data-testid="player-panel-no-source"
          >
            暂无可用播放源
          </div>
        ) : null}
      </div>
    )
  }

  function handleResumeFromPrompt(time: number) {
    setStartTime(time)
    setPlayerVersion((v) => v + 1)
  }

  function handleRestartFromPrompt() {
    setStartTime(0)
    setPlayerVersion((v) => v + 1)
  }

  return (
    <div
      className="w-full"
      style={{ background: 'var(--bg-canvas)' }}
      data-testid="player-shell"
    >
      <div
        className={cn(
          'max-w-screen-xl mx-auto px-4 py-4',
          isTheater && 'max-w-none px-0 py-0'
        )}
      >
        <div className={cn('mb-4 space-y-1', isTheater && 'px-4 pt-4')}>
          <h1
            className="text-xl md:text-2xl font-bold line-clamp-2"
            style={{ color: 'var(--fg-default)' }}
          >
            <Link
              href={detailHref}
              className="hover:underline"
              data-testid="player-title-link"
            >
              {video.title}
            </Link>
            {video.episodeCount > 1 && (
              <span className="ml-2 font-medium text-lg" style={{ color: 'var(--fg-muted)' }}>
                第 {currentEpisode} 集
              </span>
            )}
          </h1>
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--fg-muted)' }}>
            {video.year && <span>{video.year}</span>}
            {video.rating !== null && (
              <span style={{ color: 'var(--accent-default)' }}>★ {video.rating.toFixed(1)}</span>
            )}
          </div>
        </div>

        <div className={getPlayerLayoutClass(isTheater)}>
          <div
            className={cn('flex-1 min-w-0 transition-all duration-300', !isTheater && 'lg:flex-[2]')}
            data-testid="player-main"
          >
            <div
              className="w-full relative rounded-lg overflow-hidden shadow-2xl border"
              style={{ aspectRatio: '16/9', background: 'black', borderColor: 'var(--border-default)' }}
              data-testid="player-video-area"
            >
              {activeSrc ? (
                <>
                  <VideoPlayer
                    key={`player-${shortId}-${currentEpisode}-${activeSourceIndex}-${playerVersion}`}
                    src={activeSrc}
                    title={video.title}
                    episodes={inlineEpisodes}
                    activeEpisodeIndex={currentEpisode - 1}
                    onEpisodeChange={inlineEpisodes ? handleEpisodeChange : undefined}
                    onNext={hasNext ? () => setEpisode(currentEpisode + 1) : undefined}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setPlaying(false)}
                    onTheaterChange={handleTheaterChange}
                    startTime={startTime}
                    className="absolute inset-0"
                  />
                  <div className="absolute inset-0 z-[120] pointer-events-none flex items-end justify-center pb-20 md:pb-24">
                    <ResumePrompt
                      shortId={shortId}
                      episode={currentEpisode}
                      onResume={handleResumeFromPrompt}
                      onRestart={handleRestartFromPrompt}
                      className="pointer-events-auto"
                    />
                  </div>
                </>
              ) : (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                  style={{ color: 'color-mix(in oklch, white 50%, transparent)' }}
                  data-testid="player-no-source"
                >
                  <span className="text-4xl">▶</span>
                  <span className="text-sm">{video.title}</span>
                  {video.episodeCount > 1 && (
                    <span className="text-xs">第 {currentEpisode} 集</span>
                  )}
                  <span className="text-xs mt-1">
                    {sources.length === 0 ? '暂无可用播放源' : '播放源暂时不可用，请切换线路'}
                  </span>
                </div>
              )}
            </div>

            {isTheater ? (
              <div className="mt-3">{renderSelectionPanel()}</div>
            ) : null}
          </div>

          <div className={getSidePanelClass(isTheater)} data-testid="player-side-panel">
            {!isTheater ? renderSelectionPanel('h-full') : null}

            {!isTheater ? (
              <div
                className="p-4 rounded-lg text-xs text-center border"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--fg-muted)',
                }}
              >
                更多推荐内容即将上线
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
