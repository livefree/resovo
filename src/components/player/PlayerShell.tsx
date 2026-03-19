/**
 * PlayerShell.tsx — 播放器外壳 + 布局模式切换
 * CHG-20: 替换 video.js 为 @livefree/yt-player
 *   - 剧场模式由 YTPlayer onTheaterChange 回调驱动
 *   - 选集由 YTPlayer episodes 面板 + SourceBar 共同管理
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
import type { Video, VideoSource, ApiResponse, ApiListResponse } from '@/types'
import { SourceBar } from './SourceBar'
import { DanmakuBar } from './DanmakuBar'
import { ResumePrompt, saveProgress, loadProgress } from './ResumePrompt'

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

  // episodes 数组传给 YTPlayer 启用选集面板
  const ytEpisodes =
    video && video.episodeCount > 1
      ? Array.from({ length: video.episodeCount }, (_, i) => ({ title: `第${i + 1}集` }))
      : undefined

  const hasNext = !!video && video.episodeCount > 1 && currentEpisode < video.episodeCount

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

  const detailHref = video.slug
    ? `/${video.type}/${video.slug}-${video.shortId}`
    : `/${video.type}/${video.shortId}`

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
        <div
          className={cn(
            'flex gap-4 transition-all duration-300',
            isTheater ? 'flex-col' : 'lg:flex-row flex-col'
          )}
        >
          {/* ── 播放器区域 ─────────────────────────────────── */}
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
              className="w-full relative rounded-t-lg overflow-hidden"
              style={{ aspectRatio: '16/9', background: '#000' }}
              data-testid="player-video-area"
            >
              {activeSrc ? (
                <>
                  <VideoPlayer
                    src={activeSrc}
                    title={video.title}
                    episodes={ytEpisodes}
                    activeEpisodeIndex={currentEpisode - 1}
                    onEpisodeChange={handleEpisodeChange}
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

            {/* 线路选择栏 */}
            {sources.length > 0 && (
              <div className="rounded-none" style={{ background: '#111' }}>
                <SourceBar
                  sources={sources}
                  activeIndex={activeSourceIndex}
                  onSourceChange={setActiveSourceIndex}
                />
              </div>
            )}

            {/* 弹幕控制栏（CHG-22 接入弹幕数据） */}
            <DanmakuBar
              stageRef={playerContainerRef}
              currentTime={currentTime}
            />

            {/* 标题行 */}
            <div className="flex items-start justify-between mt-3 gap-2">
              <div className="flex-1 min-w-0">
                <Link
                  href={detailHref}
                  className="font-semibold text-base hover:text-[var(--gold)] transition-colors line-clamp-1"
                  style={{ color: 'var(--foreground)' }}
                  data-testid="player-title-link"
                >
                  {video.title}
                  {video.episodeCount > 1 && ` 第${currentEpisode}集`}
                </Link>
                {video.titleEn && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {video.titleEn}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── 右侧面板（非剧场模式时显示） ─────────────── */}
          <div
            className={cn(
              'transition-all duration-300 overflow-hidden',
              isTheater
                ? 'lg:w-0 lg:opacity-0 lg:pointer-events-none'
                : 'w-full lg:w-72 xl:w-80 opacity-100'
            )}
            data-testid="player-side-panel"
          >
            <div
              className="p-3 rounded-lg text-xs text-center"
              style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
            >
              更多推荐内容即将上线
            </div>
          </div>
        </div>

        {/* 剧场模式下：下方推荐（仅桌面端） */}
        {isTheater && (
          <div
            className="hidden lg:block mt-4 px-4 py-2 rounded-lg text-xs text-center"
            style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
            data-testid="theater-recommendations"
          >
            剧场模式推荐区域
          </div>
        )}
      </div>
    </div>
  )
}
