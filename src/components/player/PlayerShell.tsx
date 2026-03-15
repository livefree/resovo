/**
 * PlayerShell.tsx — 播放器外壳 + 布局模式切换
 * Default Mode: 播放器居左，右侧面板（选集 + 推荐）
 * Theater Mode: 全宽，右侧面板收起，下方推荐
 * Client Component（视频播放依赖 DOM，视频数据客户端获取）
 */

'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { apiClient } from '@/lib/api-client'
import { extractShortId } from '@/lib/video-detail'
import type { Video, VideoSource, ApiResponse, ApiListResponse } from '@/types'
import type { VideoSource as PlayerSource } from './VideoPlayer'

// VideoPlayer 动态导入，ssr: false（Video.js 依赖 DOM API）
const VideoPlayer = dynamic(
  () => import('./VideoPlayer').then((m) => ({ default: m.VideoPlayer })),
  { ssr: false }
)

interface PlayerShellProps {
  slug: string
}

export function PlayerShell({ slug }: PlayerShellProps) {
  const searchParams = useSearchParams()
  const { mode, toggleMode, initPlayer, currentEpisode, setEpisode, setPlaying, setCurrentTime } = usePlayerStore()
  const [video, setVideo] = useState<Video | null>(null)
  const [sources, setSources] = useState<PlayerSource[]>([])
  const [loading, setLoading] = useState(true)

  const shortId = extractShortId(slug)

  // 客户端获取视频数据
  useEffect(() => {
    const ep = Number(searchParams.get('ep') ?? '1') || 1
    setLoading(true)
    apiClient
      .get<ApiResponse<Video>>(`/videos/${shortId}`, { skipAuth: true })
      .then((res) => {
        setVideo(res.data)
        initPlayer(shortId, ep)
        // 播放源获取失败不影响视频展示，独立处理
        apiClient
          .get<ApiListResponse<VideoSource>>(
            `/videos/${shortId}/sources?episode=${ep}`,
            { skipAuth: true }
          )
          .then((r) => {
            const mapped: PlayerSource[] = r.data.map((s) => ({
              src: s.sourceUrl,
              type: s.type,
              label: s.sourceName,
            }))
            setSources(mapped)
          })
          .catch(() => setSources([]))
      })
      .catch(() => setVideo(null))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortId])

  const isTheater = mode === 'theater'

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

  // 详情页链接
  const detailHref = `/${video.type}/${video.slug ?? video.shortId}`

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
          {/* ── 播放器区域 ────────────────────────────────── */}
          <div
            className={cn(
              'flex-1 min-w-0 transition-all duration-300',
              !isTheater && 'lg:flex-[2]'
            )}
            data-testid="player-main"
          >
            {/* 播放器 */}
            <div
              className="w-full relative rounded-lg overflow-hidden"
              style={{ aspectRatio: '16/9', background: '#000' }}
              data-testid="player-video-area"
            >
              {sources.length > 0 ? (
                <VideoPlayer
                  sources={sources}
                  episode={currentEpisode}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={setCurrentTime}
                  className="absolute inset-0"
                />
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
                </div>
              )}
            </div>

            {/* 标题行 + 模式切换按钮 */}
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

              {/* 剧场模式切换（仅桌面端） */}
              <button
                onClick={toggleMode}
                className={cn(
                  'hidden lg:flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors',
                  'hover:bg-[var(--secondary)] shrink-0'
                )}
                style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
                data-testid="theater-mode-btn"
                aria-label={isTheater ? 'Exit theater mode' : 'Enter theater mode'}
              >
                {isTheater ? '⊡ 默认' : '⊞ 剧场'}
              </button>
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
            {/* 选集列表 */}
            {video.episodeCount > 1 && (
              <div className="mb-4">
                <h3
                  className="text-sm font-semibold mb-2"
                  style={{ color: 'var(--foreground)' }}
                >
                  选集
                </h3>
                <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto">
                  {Array.from({ length: video.episodeCount }, (_, i) => i + 1).map((ep) => (
                    <button
                      key={ep}
                      onClick={() => setEpisode(ep)}
                      className={cn(
                        'h-8 rounded text-xs font-medium transition-colors border'
                      )}
                      style={
                        currentEpisode === ep
                          ? { background: 'var(--gold)', color: 'black', borderColor: 'transparent' }
                          : { color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--secondary)' }
                      }
                      data-testid={`side-episode-${ep}`}
                    >
                      {ep}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 推荐占位 */}
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
