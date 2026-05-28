'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { apiClient } from '@/lib/api-client'
import { extractShortId } from '@/lib/video-detail'
import { getVideoDetailHref } from '@/lib/video-route'
import { buildLineDisplayName, deduplicateLabels, applyThemeLabels } from '@/lib/line-display-name'
import { useRouteTheme } from '@/lib/route-theme-storage'
import { RouteThemeSelector } from './RouteThemeSelector'
import { useLocale } from 'next-intl'
import type { Video, VideoSource, ApiResponse, ApiListResponse } from '@resovo/types'
import { SourceBar } from './SourceBar'
import { ResumePrompt, saveProgress } from './ResumePrompt'
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
  /**
   * ADR-160 D-160-5：admin preview 模式（管理员通过 PendingCenter "↗ 前台预览" 进入）
   * - true: 屏蔽所有 feedback / audit / view_count 写入路径（GET 纯只读）
   * - false（默认）: 公开访问，正常上报
   * 当前实装：尚未接入 feedback hook（D-160-5 实证审查是前瞻性 advisory），
   *           本 Props 为未来 watch 页接入 usePlaybackFeedback / view_count 写入时的统一屏蔽闸门。
   *           调用方应通过 `isPlaybackFeedbackEnabled(previewMode)` 派生开关。
   */
  previewMode?: boolean
  /**
   * ADR-160 AMENDMENT 2 D-160-AMD2-3：server-side hydration
   * watch page server component 预取的视频数据 / 有值时 useEffect 跳过 client video fetch
   * （Y-AMD2-1 早返回 pattern）
   */
  initialVideo?: Video
  /** server-side 预取的第 1 集 raw sources（仍走 client themed pipeline / 仅替换 fetch 源 / Y-AMD2-2 episode 切换限制） */
  initialSources?: VideoSource[]
}

/**
 * ADR-160 D-160-5 写入开关派生：preview 模式禁用 feedback / audit / view_count 等写入。
 * 未来 web-next 接入 usePlaybackFeedback / 推荐写回时统一通过本 helper 决定是否启用。
 */
export function isPlaybackFeedbackEnabled(previewMode: boolean | undefined): boolean {
  return !previewMode
}

export function PlayerShell({ slug: slugProp, portalMode = false, previewMode = false, initialVideo, initialSources }: PlayerShellProps) {
  // ADR-160 D-160-5：preview 模式禁用所有 feedback / audit 写入路径
  // 当前 PlayerShell 唯一写路径是 saveProgress（localStorage / 客户端本地）— 不在 D-160-5 屏蔽范围
  // 未来 feedback hook 接入时按本变量守卫
  const feedbackEnabled = isPlaybackFeedbackEnabled(previewMode)
  void feedbackEnabled  // 显式保留：未来 usePlaybackFeedback / view_count 写入引用
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

  // ADR-160 AMENDMENT 2 D-160-AMD2-3：state init 用 server-side hydrated video
  // sources 仍走 client themed pipeline（applyThemeLabels 依赖 useLocale）→ state init 用 []
  const [video, setVideo] = useState<Video | null>(initialVideo ?? null)
  const [sources, setSources] = useState<Array<{ src: string; type: string; label?: string; quality?: string | null; isDead?: boolean; isPending?: boolean }>>([])
  const [loading, setLoading] = useState(true)
  const [startTime, setStartTime] = useState<number | undefined>(undefined)
  const [playerVersion, setPlayerVersion] = useState(0)
  const [activePanelTab, setActivePanelTab] = useState<'episodes' | 'sources'>('episodes')

  // CHG-353 默认主题（zh-CN → 节气 / en → NATO）+ CHG-369 localStorage 持久化（用户选择优先）
  const locale = useLocale()
  const { theme: routeTheme, setTheme: setRouteTheme } = useRouteTheme(locale)

  const shortId = extractShortId(slug)

  // ADR-160 AMENDMENT 2 D-160-AMD2-3：fetchedEpisodeRef 记录"已 fetch / 正在 fetch 的 episode"
  // - 初始 fetch useEffect 在 setVideo 同时 claim ref = initial ep（不等 sources 完成 / 防 episode-switch 双拉）
  // - 初始 sources 完成时做 stale check：ep ≠ store.currentEpisode → 不 setSources（用户在 fetch 期间切集 / 让 episode-switch 接手最新 ep）
  // - episode-switch useEffect 依赖 [currentEpisode, video]：video 变化后重跑兜住 "在 sources fetch 期间切集" 时序；
  //   基于 ref 判定避免重复 fetch（claim before fetch）
  const fetchedEpisodeRef = useRef<number | null>(null)

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
    // 同步 claim ref = initial ep / 在 videoPromise 异步链之前就标记 / 避免 episode-switch effect
    // 在 useEffect 1 异步链解析前先发起 fetch 造成双拉（initialVideo 场景 video 已非 null）
    fetchedEpisodeRef.current = ep
    // 同步 initPlayer 让 store.currentEpisode 立即对齐 URL ep（urlEp ≠ store default 1 时尤为重要 /
    // 否则 useEffect 2 在 mount 时看到 store.currentEpisode=stale → ref ≠ currentEpisode → fetch stale ep）
    initPlayer(shortId, ep)
    // ADR-160 AMENDMENT 2 Y-AMD2-1：派发 video fetch 源 — server-side hydrated 或 client fetch
    const videoPromise = initialVideo
      ? Promise.resolve<ApiResponse<Video>>({ data: initialVideo })
      : apiClient.get<ApiResponse<Video>>(`/videos/${shortId}`, { skipAuth: true })
    // sources 仅当 ep === 第 1 集 + 有 initialSources 时复用（Y-AMD2-2 episode 切换走 client）
    const useInitialSources = !!initialSources && ep === 1
    videoPromise
      .then((res) => {
        setVideo(res.data)
        // Promise.resolve 用宽松 shape（{ data }）匹配 ApiListResponse 子集；then 仅消费 r.data
        const sourcesPromise: Promise<{ data: VideoSource[] }> = useInitialSources
          ? Promise.resolve({ data: initialSources! })
          : apiClient.get<ApiListResponse<VideoSource>>(
              `/videos/${shortId}/sources?episode=${ep}`,
              { skipAuth: true }
            )
        sourcesPromise
          .then((r) => {
            // stale check：用户在 fetch 期间切集 → episode 不再是 initial ep → 丢弃响应，让 episode-switch effect 拉最新 ep
            if (ep !== usePlayerStore.getState().currentEpisode) {
              fetchedEpisodeRef.current = null
              return
            }
            // CHG-353：按主题赋标签（后端已按 effective_score 排序 / CHG-352）
            const themed = applyThemeLabels(
              r.data.map((s) => ({ effectiveScore: s.effectiveScore, quality: s.quality })),
              routeTheme,
            )
            const newSources = deduplicateLabels(
              r.data.map((s, index) => ({
                src: s.sourceUrl,
                type: s.type,
                // 主题标签优先；若 effectiveScore 缺失（老后端兜底）→ fallback buildLineDisplayName
                label: s.effectiveScore !== undefined
                  ? themed[index].themeLabel
                  : buildLineDisplayName({
                      rawName: s.sourceName,
                      siteDisplayName: s.siteDisplayName,
                      fallbackIndex: index,
                      quality: s.quality,
                    }),
                quality: s.quality,
                isDead: themed[index].isDead,
                isPending: themed[index].isPending,
              }))
            )
            setSources(newSources)
            // Restore source index from snapshot (initPlayer already zeroed it)
            setActiveSourceIndex(priorSourceIndex < newSources.length ? priorSourceIndex : 0)
            // mini→full：仅设 startTime 让 video 暂停在 priorTime，不 autoplay
            // 不调 clearProgress，让 ResumePrompt 自然弹出，由用户点击继续触发 user-gesture
            // （否则 player-core useSourceLoader 在 autoplay 失败时会自动 muted=true 重试，造成静音 bug）
            // 未来共享 video 实例落地后再做无缝衔接
            if (priorTime > 30) {
              setStartTime(priorTime)
              setPlayerVersion((v) => v + 1)
            }
          })
          .catch(() => {
            // sources 失败的 stale check 同 then 分支
            if (ep !== usePlayerStore.getState().currentEpisode) {
              fetchedEpisodeRef.current = null
              return
            }
            setSources([])
          })
      })
      .catch(() => setVideo(null))
      .finally(() => setLoading(false))
    // 技术债(NEW-P0-B)：依赖故意收敛到 shortId，initPlayer/searchParams 等引用稳定引用
    // 修复方案：提取 fetchVideoAndSources(shortId, ep) 为 useCallback 后移除此 disable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortId])

  useEffect(() => {
    if (!shortId || !video) return
    // 直接读 store 最新 currentEpisode / 避免 closure capture 的 stale 值（useEffect 1 同步 initPlayer
    // 改 store 不会触发 re-render → effect closure 仍是 mount render 时的旧 ep / 会触发 stale fetch）
    const latestEpisode = usePlayerStore.getState().currentEpisode
    // fetchedEpisodeRef === latestEpisode → 已 fetch / 正在 fetch（初始 useEffect 已 claim）→ 跳过避免双拉；
    // 不等 → 用户切集（或在初始 fetch 期间已切但被 stale 丢弃），claim 当前 ep 再 fetch
    if (fetchedEpisodeRef.current === latestEpisode) return
    fetchedEpisodeRef.current = latestEpisode
    setStartTime(undefined)
    const targetEp = latestEpisode
    apiClient
      .get<ApiListResponse<VideoSource>>(
        `/videos/${shortId}/sources?episode=${targetEp}`,
        { skipAuth: true }
      )
      .then((res) => {
        // stale check：fetch 期间用户又切集 → 丢弃响应让下次 effect 接手
        if (targetEp !== usePlayerStore.getState().currentEpisode) return
        // CHG-353：切集后重新按主题赋标签（保持与初始 fetch 一致）
        const themed = applyThemeLabels(
          res.data.map((s) => ({ effectiveScore: s.effectiveScore, quality: s.quality })),
          routeTheme,
        )
        const newSources = deduplicateLabels(
          res.data.map((s, index) => ({
            src: s.sourceUrl,
            type: s.type,
            label: s.effectiveScore !== undefined
              ? themed[index].themeLabel
              : buildLineDisplayName({
                  rawName: s.sourceName,
                  siteDisplayName: s.siteDisplayName,
                  fallbackIndex: index,
                  quality: s.quality,
                }),
            quality: s.quality,
            isDead: themed[index].isDead,
            isPending: themed[index].isPending,
          }))
        )
        setSources(newSources)
        const prevLabel = sources[activeSourceIndex]?.label
        const matched = prevLabel ? newSources.findIndex((s) => s.label === prevLabel) : -1
        setActiveSourceIndex(matched >= 0 ? matched : 0)
      })
      .catch(() => {
        // stale 时不能复位 ref（已被后续 effect 占用）；否则会让用户切回该 ep 时无法重拉
        if (targetEp === usePlayerStore.getState().currentEpisode) {
          fetchedEpisodeRef.current = null
        }
      })
    // 技术债(NEW-P0-B)：依赖收敛到 currentEpisode + video；sources/activeSourceIndex 通过闭包读取快照
    // video 加入依赖：兜住 "在初始 sources fetch 期间切集" 时序（video 变化触发 effect 重跑 → ref 判定 fetch 最新 ep）
    // 修复方案：改用 useRef(sources)/useRef(activeSourceIndex) 读取最新值，移除此 disable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEpisode, video])

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
            {/* CHG-369 / plan §17.2 #16：主题选择器 + localStorage 持久化 */}
            <RouteThemeSelector currentTheme={routeTheme} onThemeChange={setRouteTheme} />
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
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
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
