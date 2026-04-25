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
import { ResumePrompt, saveProgress, clearProgress } from './ResumePrompt'
import { getInlineEpisodes, getPlayerLayoutClass, getSidePanelClass } from './playerShell.layout'

const VideoPlayer = dynamic(
  () => import('./VideoPlayer').then((m) => ({ default: m.VideoPlayer })),
  { ssr: false }
)

interface PlayerShellProps {
  /** Portal 模式下可省略（从 store.hostOrigin.slug 读取） */
  slug?: string
  /** true 时抑制页面跳转，仅在 GlobalPlayerFullFrame 内使用 */
  portalMode?: boolean
}

export function PlayerShell({ slug: slugProp, portalMode = false }: PlayerShellProps) {
  const hostOriginSlug = usePlayerStore((s) => s.hostOrigin?.slug)
  const slug = slugProp ?? hostOriginSlug ?? ''
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
    activeSourceIndex,
    setActiveSourceIndex,
  } = usePlayerStore()

  const [video, setVideo] = useState<Video | null>(null)
  const [sources, setSources] = useState<Array<{ src: string; type: string; label?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [startTime, setStartTime] = useState<number | undefined>(undefined)
  const [playerVersion, setPlayerVersion] = useState(0)
  const [autoplayOnResume, setAutoplayOnResume] = useState(false)
  const [activePanelTab, setActivePanelTab] = useState<'episodes' | 'sources'>('episodes')

  const shortId = extractShortId(slug)

  useEffect(() => {
    // Snapshot all mini player state BEFORE initPlayer resets them to defaults
    const snap = usePlayerStore.getState()
    const isSameVideo = snap.shortId === shortId
    // Episode: URL param wins if explicit; otherwise inherit from mini player (same video)
    const urlEp = searchParams.get('ep')
    const ep = urlEp ? (Number(urlEp) || 1) : (isSameVideo ? snap.currentEpisode : 1)
    // currentTime and activeSourceIndex are zeroed by initPlayer — must capture now
    const priorTime = isSameVideo ? snap.currentTime : 0
    const priorSourceIndex = isSameVideo ? snap.activeSourceIndex : 0
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
            const newSources = deduplicateLabels(
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
            setSources(newSources)
            // Restore source index from snapshot (initPlayer already zeroed it)
            setActiveSourceIndex(priorSourceIndex < newSources.length ? priorSourceIndex : 0)
            // Seamless mini→full resume: seek + autoplay + suppress ResumePrompt
            if (priorTime > 30) {
              setStartTime(priorTime)
              setAutoplayOnResume(true)
              setPlayerVersion((v) => v + 1)   // 强制 VideoPlayer 以新 startTime+autoplay 重挂
              clearProgress(shortId, ep)
            }
          })
          .catch(() => setSources([]))
      })
      .catch(() => setVideo(null))
      .finally(() => setLoading(false))
    // 技术债(NEW-P0-B)：依赖故意收敛到 shortId，initPlayer/searchParams 等引用稳定引用
    // 修复方案：提取 fetchVideoAndSources(shortId, ep) 为 useCallback 后移除此 disable
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
    // 技术债(NEW-P0-B)：依赖收敛到 currentEpisode；sources/activeSourceIndex 通过闭包读取快照
    // 修复方案：改用 useRef(sources)/useRef(activeSourceIndex) 读取最新值，移除此 disable
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

  // hasEpisodes / hasSources 必须在 useEffect 前声明，避免 TDZ 风险并确保依赖数组可直接引用
  const isTheater = mode === 'theater'
  const activeSrc = sources[activeSourceIndex]?.src ?? ''
  const hasEpisodes = !!video && video.episodeCount > 1
  const hasSources = sources.length > 0
  const inlineEpisodes = getInlineEpisodes(isTheater, video?.episodeCount ?? 0)
  const hasNext = !!video && video.episodeCount > 1 && currentEpisode < video.episodeCount

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
  }, [activePanelTab, hasEpisodes, hasSources])

  if (loading) {
    return (
      <div className="max-w-wide mx-auto px-10 py-4">
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

        {/* 选集网格：gap/maxHeight 使用 player tokens */}
        {hasEpisodes && activePanelTab === 'episodes' ? (
          <div
            className="p-2 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5 overflow-y-auto scrollbar-thin"
            style={{ gap: 'var(--player-ep-gap)', maxHeight: 'var(--player-panel-max-h)' }}
          >
            {Array.from({ length: video!.episodeCount }).map((_, i) => {
              const epNum = i + 1
              const isActive = currentEpisode === epNum
              return (
                <button
                  key={epNum}
                  type="button"
                  onClick={() => setEpisode(epNum)}
                  className="flex items-center justify-center text-sm rounded transition-colors"
                  style={{
                    height: 'var(--player-ep-h)',
                    ...(isActive
                      ? { background: 'var(--accent-default)', color: 'var(--accent-fg)', fontWeight: 700 }
                      : { background: 'var(--bg-surface-sunken)', color: 'var(--fg-muted)' }
                    ),
                  }}
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
      {/* 播放器容器：max-w-wide(1600px)，影院模式去除 px/py */}
      <div
        className={cn('max-w-wide mx-auto', !isTheater && 'px-10 py-4')}
      >
        <div className={cn('mb-4 space-y-1', isTheater && 'px-10 pt-4')}>
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
          {/* 主列：flex-1（1fr 效果） */}
          <div
            className="flex-1 min-w-0 transition-all duration-300"
            data-testid="player-main"
          >
            {/* 视频区：影院模式 radius=0 (spec §15) */}
            <div
              className="w-full relative overflow-hidden shadow-2xl border"
              style={{
                aspectRatio: '16/9',
                background: 'var(--player-video-area-bg)',
                borderColor: 'var(--border-default)',
                borderRadius: isTheater ? 0 : '12px',
              }}
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
                    onPlay={() => { setPlaying(true); setAutoplayOnResume(false) }}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    onTheaterChange={handleTheaterChange}
                    startTime={startTime}
                    autoplay={autoplayOnResume}
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
                  style={{ color: 'var(--player-no-source-fg)' }}
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
          </div>
        </div>

        {/* 下方内容区约束容器（HANDOFF-30 §15）：max-w-1280px，左右各 24px */}
        <div className="max-w-[1280px] mx-auto px-6 mt-6">
          <div
            className="p-4 rounded-lg text-xs text-center border"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
              color: 'var(--fg-muted)',
            }}
            data-testid="player-lower-section"
          >
            更多推荐内容即将上线
          </div>
        </div>
      </div>
    </div>
  )
}
