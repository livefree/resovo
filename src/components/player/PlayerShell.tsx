/**
 * PlayerShell.tsx — 播放器外壳 + 布局模式切换
 * CHG-20: 替换 video.js 为 @livefree/yt-player
 *   - 剧场模式由 YTPlayer onTheaterChange 回调驱动
 *   - 默认模式：选集/换源由右侧面板统一管理
 *   - 剧场模式：侧栏收起时回退启用 YTPlayer 内选集
 *   - DanmakuBar 挂载在播放器容器上（CCL overlay 附加）
 * Default Mode: 播放器居左，右侧面板（推荐）
 * Theater Mode: 全宽，右侧面板收起，下方推荐
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { apiClient } from '@/lib/api-client'
import { extractShortId } from '@/lib/video-detail'
import { getVideoDetailHref } from '@/lib/video-route'
import type { Video, VideoSource, ApiResponse, ApiListResponse } from '@/types'
import { SourceBar } from './SourceBar'
import { DanmakuBar } from './DanmakuBar'
import { ResumePrompt, saveProgress } from './ResumePrompt'
import { getInlineEpisodes, getPlayerLayoutClass, getSidePanelClass } from './playerShell.layout'

// VideoPlayer 动态导入，ssr: false（YTPlayer 依赖 DOM API）
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
    currentTime,
  } = usePlayerStore()

  const [video, setVideo] = useState<Video | null>(null)
  const [sources, setSources] = useState<Array<{ src: string; type: string; label?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [activeSourceIndex, setActiveSourceIndex] = useState(0)
  const [startTime, setStartTime] = useState<number | undefined>(undefined)
  const [activePanelTab, setActivePanelTab] = useState<'episodes' | 'sources'>('episodes')

  // 播放器容器 ref，用于 DanmakuBar CCL overlay 挂载
  const playerContainerRef = useRef<HTMLDivElement>(null)

  const shortId = extractShortId(slug)

  // ── 初始加载视频信息 + 播放源 ─────────────────────────────────

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
            setSources(r.data.map((s) => ({ src: s.sourceUrl, type: s.type, label: s.sourceName })))
            setActiveSourceIndex(0)
          })
          .catch(() => setSources([]))
      })
      .catch(() => setVideo(null))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortId])

  // ── 集数切换时重新获取播放源 ──────────────────────────────────

  useEffect(() => {
    if (!shortId || !video) return
    apiClient
      .get<ApiListResponse<VideoSource>>(
        `/videos/${shortId}/sources?episode=${currentEpisode}`,
        { skipAuth: true }
      )
      .then((res) => {
        setSources(res.data.map((s) => ({ src: s.sourceUrl, type: s.type, label: s.sourceName })))
        setActiveSourceIndex(0)
      })
      .catch(() => {/* 无源时保留已有源 */})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEpisode])

  // ── 回调 ──────────────────────────────────────────────────────

  const handleTimeUpdate = useCallback((t: number, d: number) => {
    setCurrentTime(t)
    setDuration(d)
    if (t > 0 && shortId) saveProgress(shortId, currentEpisode, t)
  }, [setCurrentTime, setDuration, shortId, currentEpisode])

  const handleTheaterChange = useCallback((isTheater: boolean) => {
    setMode(isTheater ? 'theater' : 'default')
  }, [setMode])

  const handleEpisodeChange = useCallback((index: number) => {
    setEpisode(index + 1) // YTPlayer 0-based → Resovo 1-based
  }, [setEpisode])

  // ── 派生数据 ──────────────────────────────────────────────────

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

  // ── Loading / Error ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-4">
        <div
          className="w-full rounded-lg animate-pulse"
          style={{ aspectRatio: '16/9', background: 'var(--secondary)' }}
        />
      </div>
    )
  }

  if (!video) {
    return (
      <div
        className="flex items-center justify-center py-20 text-sm"
        style={{ color: 'var(--muted-foreground)' }}
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
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        data-testid="player-selection-panel"
      >
        {hasEpisodes && hasSources ? (
          <div className="p-1.5 border-b grid grid-cols-2 gap-1.5" style={{ borderColor: 'var(--border)', background: 'var(--secondary)' }}>
            <button
              type="button"
              data-testid="player-tab-episodes"
              onClick={() => setActivePanelTab('episodes')}
              className={cn(
                'py-1.5 text-xs rounded transition-colors',
                activePanelTab === 'episodes'
                  ? 'font-semibold bg-[var(--accent)] text-black'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--border)]'
              )}
            >
              选集
            </button>
            <button
              type="button"
              data-testid="player-tab-sources"
              onClick={() => setActivePanelTab('sources')}
              className={cn(
                'py-1.5 text-xs rounded transition-colors',
                activePanelTab === 'sources'
                  ? 'font-semibold bg-[var(--accent)] text-black'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--border)]'
              )}
            >
              线路
            </button>
          </div>
        ) : (
          <div className="p-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--secondary)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              {hasEpisodes ? '选集' : '线路'}
            </h3>
          </div>
        )}

        {hasEpisodes && activePanelTab === 'episodes' ? (
          <div className="p-2 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 max-h-[360px] overflow-y-auto scrollbar-thin">
            {Array.from({ length: video.episodeCount }).map((_, i) => {
              const epNum = i + 1
              const isActive = currentEpisode === epNum
              return (
                <button
                  key={epNum}
                  type="button"
                  onClick={() => setEpisode(epNum)}
                  className={cn(
                    'py-2 text-center text-sm rounded transition-colors',
                    isActive
                      ? 'bg-[var(--accent)] text-black font-bold shadow-sm'
                      : 'bg-[var(--secondary)] hover:bg-[var(--border)] text-[var(--muted-foreground)]'
                  )}
                >
                  {epNum}
                </button>
              )
            })}
          </div>
        ) : null}

        {hasSources && activePanelTab === 'sources' ? (
          <div className="p-2">
            <div className="rounded-md overflow-hidden bg-[var(--secondary)]">
              <SourceBar
                sources={sources}
                activeIndex={activeSourceIndex}
                onSourceChange={setActiveSourceIndex}
              />
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="w-full"
      style={{ background: 'var(--background)' }}
      data-testid="player-shell"
    >
      <div
        className={cn(
          'max-w-screen-xl mx-auto px-4 py-4',
          isTheater && 'max-w-none px-0 py-0'
        )}
      >
        {/* 标题置顶 */}
        <div className={cn('mb-4 space-y-1', isTheater && 'px-4 pt-4')}>
          <h1 className="text-xl md:text-2xl font-bold line-clamp-2" style={{ color: 'var(--foreground)' }}>
            {video.title}
            {video.episodeCount > 1 && <span className="ml-2 font-medium" style={{ color: 'var(--muted-foreground)' }}>第 {currentEpisode} 集</span>}
          </h1>
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {video.year && <span>{video.year}</span>}
            {video.rating !== null && <span style={{ color: 'var(--gold)' }}>★ {video.rating.toFixed(1)}</span>}
            <Link href={detailHref} className="hover:text-[var(--foreground)] transition-colors underline underline-offset-4 ml-1">
              详情信息
            </Link>
          </div>
        </div>

        <div
          className={getPlayerLayoutClass(isTheater)}
        >
          {/* ── 播放器主区 ─────────────────────────────────── */}
          <div
            className={cn(
              'flex-1 min-w-0 transition-all duration-300',
              !isTheater && 'lg:flex-[2]'
            )}
            data-testid="player-main"
          >
            {/* 播放器容器（CCL overlay 挂载于此） */}
            <div
              ref={playerContainerRef}
              className="w-full relative rounded-lg overflow-hidden shadow-2xl border"
              style={{ aspectRatio: '16/9', background: '#000', borderColor: 'var(--border)' }}
              data-testid="player-video-area"
            >
              {activeSrc ? (
                <>
                  <VideoPlayer
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
                  <ResumePrompt
                    shortId={shortId}
                    episode={currentEpisode}
                    onResume={(t) => setStartTime(t)}
                    onRestart={() => setStartTime(0)}
                  />
                </>
              ) : (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                  data-testid="player-no-source"
                >
                  <span className="text-4xl">▶</span>
                  <span className="text-sm">{video.title}</span>
                  {video.episodeCount > 1 && (
                    <span className="text-xs">第 {currentEpisode} 集</span>
                  )}
                  <span className="text-xs mt-1">播放源暂时不可用，请切换线路</span>
                </div>
              )}
            </div>

            {/* 弹幕控制栏 */}
            <DanmakuBar
              stageRef={playerContainerRef}
              currentTime={currentTime}
            />

            {/* 影院模式：将选集/线路移至弹幕下方，宽度与播放器对齐 */}
            {isTheater ? (
              <div className="mt-3">
                {renderSelectionPanel()}
              </div>
            ) : null}
          </div>

          {/* ── 交互面板（默认模式） ─────────────── */}
          <div
            className={getSidePanelClass(isTheater)}
            data-testid="player-side-panel"
          >
            {!isTheater ? renderSelectionPanel('h-full') : null}

            {/* 相关推荐 / 留白占位 */}
            {!isTheater ? (
              <div
                className="p-4 rounded-lg text-xs text-center border"
                style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
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
