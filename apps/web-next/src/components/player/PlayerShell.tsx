'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { apiClient } from '@/lib/api-client'
import { createQualifiedPlayDetector, reportVideoPlayEvent } from '@/lib/play-stats'
import { formatPlayCount } from '@/lib/format-play-count'
import { extractShortId } from '@/lib/short-id'
import { buildEpisodeUrl } from '@/lib/episode-url'
import { getVideoDetailHref } from '@/lib/video-route'
import { buildLineMatrix, buildThemedLines, type VideoLine } from '@/lib/line-matrix'
import { classifyRouteHealth } from '@/lib/line-display-name'
import { useRouteTheme } from '@/lib/route-theme-storage'
import { RouteThemeSelector } from './RouteThemeSelector'
import { CustomThemeDialog } from './CustomThemeDialog'
import { useLocale } from 'next-intl'
import type { Video, VideoSource, ApiResponse, ApiListResponse } from '@resovo/types'
import type { PlayerProps } from '@resovo/player-core'
// PlayerErrorEvent 是 player-core 内部类型 / 顶层 index.ts 未 re-export（不动 player-core 公共 API 防触发 Opus 强制项）
// 通过 PlayerProps['onError'] 反推参数类型 / 升级时自动跟随
type PlayerErrorPayload = Parameters<NonNullable<PlayerProps['onError']>>[0]
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
   */
  previewMode?: boolean
  /**
   * ADR-160 AMENDMENT 2 D-160-AMD2-3：server-side hydration
   * watch page server component 预取的视频数据 / 有值时 useEffect 跳过 client video fetch
   */
  initialVideo?: Video
  /**
   * PLAYER-LINE-BOUND-EP：server-side 预取的**全集** raw sources（省略 episode）。
   * 仅在 initialVideo.shortId === 当前 shortId 时复用（防客户端切视频后 stale 命中）。
   */
  initialSources?: VideoSource[]
}

/**
 * ADR-160 D-160-5 写入开关派生：preview 模式禁用 feedback / audit / view_count 等写入。
 */
export function isPlaybackFeedbackEnabled(previewMode: boolean | undefined): boolean {
  return !previewMode
}

/**
 * SRCHEALTH-P2-1 / F1：success 上报 1/N 采样配置。
 * NEXT_PUBLIC_FEEDBACK_SUCCESS_SAMPLE_N（Next.js 编译期内联，须保持点号静态访问）：
 * N=1（默认）全量上报；N>1 每个 source 的首播成功事件以 1/N 概率上报。
 */
export function getSuccessSampleN(): number {
  const raw = process.env.NEXT_PUBLIC_FEEDBACK_SUCCESS_SAMPLE_N
  if (!raw) return 1
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** 采样判定纯函数（random ∈ [0,1)，命中概率 1/sampleN）；独立导出便于单测覆盖边界 */
export function shouldReportPlaySuccess(sampleN: number, random: number = Math.random()): boolean {
  return random < 1 / sampleN
}

export function PlayerShell({ slug: slugProp, portalMode = false, previewMode = false, initialVideo, initialSources }: PlayerShellProps) {
  // ADR-160 D-160-5：preview 模式禁用所有 feedback / audit 写入路径
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
    activeLineKey,
    setActiveLineKey,
  } = usePlayerStore()

  // PLAYER-LINE-BOUND-EP：state 从 per-episode sources 改为稳定线路矩阵（一次拉全集源构建）
  const [video, setVideo] = useState<Video | null>(initialVideo ?? null)
  const [lineMatrix, setLineMatrix] = useState<VideoLine[]>([])
  // 运行时报错置 dead 的线路 key（当前集维度，切集/切视频重置——同线路他集可重试）
  const [deadLineKeys, setDeadLineKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [startTime, setStartTime] = useState<number | undefined>(undefined)
  const [playerVersion, setPlayerVersion] = useState(0)
  const [activePanelTab, setActivePanelTab] = useState<'episodes' | 'sources'>('episodes')

  // CHG-353 默认主题（zh-CN → 节气 / en → NATO）+ CHG-369 localStorage 持久化（用户选择优先）
  // ADR-165 / CHG-SN-9-ROUTE-LABEL-D-A2：跨设备同步 syncing 状态透到 RouteThemeSelector
  const locale = useLocale()
  const {
    theme: routeTheme,
    customTheme,
    syncing: routeThemeSyncing,
    setTheme: setRouteTheme,
    setCustomTheme,
    clearCustomTheme,
  } = useRouteTheme(locale)
  const [customDialogOpen, setCustomDialogOpen] = useState(false)

  const shortId = extractShortId(slug)

  // ── 初始拉取：一次性取全集源 → 构建线路矩阵（Y6：保留 shortId stale-check，移除 per-episode 双拉竞态）──
  const initTokenRef = useRef(0)
  useEffect(() => {
    const snap = usePlayerStore.getState()
    const isSameVideo = snap.shortId === shortId
    const urlEp = searchParams.get('ep')
    const desiredEp = urlEp ? (Number(urlEp) || 1) : (isSameVideo ? snap.currentEpisode : 1)
    const priorTime = isSameVideo ? snap.currentTime : 0
    const priorLineKey = isSameVideo ? snap.activeLineKey : null
    setLoading(true)
    const token = ++initTokenRef.current
    // initPlayer 重置 activeLineKey=null + 对齐 currentEpisode（URL ep 优先）
    initPlayer(shortId, desiredEp)

    // initial props 仅当对应当前 shortId 时复用（防客户端切视频后命中 SSR stale 数据）
    const canUseInitial = !!initialVideo && initialVideo.shortId === shortId
    const videoPromise: Promise<ApiResponse<Video>> = canUseInitial
      ? Promise.resolve({ data: initialVideo! })
      : apiClient.get<ApiResponse<Video>>(`/videos/${shortId}`, { skipAuth: true })
    const sourcesPromise: Promise<{ data: VideoSource[] }> = canUseInitial && initialSources
      ? Promise.resolve({ data: initialSources })
      : apiClient.get<ApiListResponse<VideoSource>>(`/videos/${shortId}/sources`, { skipAuth: true })

    Promise.all([videoPromise, sourcesPromise])
      .then(([vRes, sRes]) => {
        if (token !== initTokenRef.current) return  // shortId stale-check（切视频丢弃旧响应）
        setVideo(vRes.data)
        const matrix = buildLineMatrix(sRes.data ?? [])
        setLineMatrix(matrix)
        setDeadLineKeys(new Set())
        // 选线路：同视频沿用 priorLineKey（存在于矩阵）/ 否则最优线路（首条，复用后端排序）
        const restoredLine =
          (priorLineKey ? matrix.find((l) => l.key === priorLineKey) : undefined) ?? matrix[0]
        setActiveLineKey(restoredLine?.key ?? null)
        // 收敛集：活跃线路不含 desiredEp → 该线路第 1 集（用户裁定）
        if (restoredLine && !restoredLine.episodes.has(desiredEp)) {
          const firstEp = restoredLine.episodeNumbers[0]
          if (firstEp !== undefined && firstEp !== desiredEp) setEpisode(firstEp)
        }
        // mini→full：设 startTime 让 video 暂停在 priorTime，不 autoplay（ResumePrompt 自然弹出）
        if (priorTime > 30) {
          setStartTime(priorTime)
          setPlayerVersion((v) => v + 1)
        }
      })
      .catch(() => {
        if (token !== initTokenRef.current) return
        setVideo((prev) => (canUseInitial ? prev : null))
        setLineMatrix([])
      })
      .finally(() => {
        if (token === initTokenRef.current) setLoading(false)
      })
    // 依赖收敛到 shortId：initPlayer/searchParams/setEpisode 等引用稳定；切视频由 shortId 变化重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortId])

  // ── 派生（线路优先）────────────────────────────────────────────
  const isTheater = mode === 'theater'
  const activeLineIndex = lineMatrix.length > 0
    ? Math.max(0, lineMatrix.findIndex((l) => l.key === activeLineKey))
    : -1
  const activeLine: VideoLine | undefined =
    activeLineIndex >= 0 ? lineMatrix[activeLineIndex] : undefined
  const episodeNumbers = activeLine?.episodeNumbers ?? []
  const activeSrc = activeLine?.episodes.get(currentEpisode)?.sourceUrl ?? ''
  const hasEpisodes = episodeNumbers.length > 1
  const hasSources = lineMatrix.length > 0
  const activeEpisodeIndex = episodeNumbers.indexOf(currentEpisode)
  const nextEpisode = activeEpisodeIndex >= 0 ? episodeNumbers[activeEpisodeIndex + 1] : undefined
  const hasNext = nextEpisode !== undefined
  const inlineEpisodes = getInlineEpisodes(episodeNumbers)

  // CHG-353：SourceBar 线路标签按主题派生（每线路代表源喂 buildThemedLines）；
  // 运行时报错 dead 的线路合并 isDead（黄线 3：themed dead/pending 用代表源口径）
  const baseThemedLines = useMemo(
    () => buildThemedLines(lineMatrix, routeTheme),
    [lineMatrix, routeTheme],
  )
  const themedLines = useMemo(
    () =>
      baseThemedLines.map((s, i) => {
        const key = lineMatrix[i]?.key
        return key && deadLineKeys.has(key) ? { ...s, isDead: true } : s
      }),
    [baseThemedLines, deadLineKeys, lineMatrix],
  )

  // 闭包/watchdog 读取最新值的 ref（避免 stale；lineMatrix 加载后稳定）
  const lineMatrixRef = useRef(lineMatrix)
  lineMatrixRef.current = lineMatrix
  const activeLineIndexRef = useRef(activeLineIndex)
  activeLineIndexRef.current = activeLineIndex
  const activeLineRef = useRef<VideoLine | undefined>(activeLine)
  activeLineRef.current = activeLine
  const deadLineKeysRef = useRef(deadLineKeys)
  deadLineKeysRef.current = deadLineKeys
  const videoIdRef = useRef<string | null>(video?.id ?? null)
  videoIdRef.current = video?.id ?? null

  // STATS-03-B（ADR-216）：full 播放器 Qualified Play 上报。
  // detector 累计真实观看时长（排除 seek/续播跳跃）；reportedRef 同步去重（防 async 竞态/请求风暴，Codex HIGH-2）。
  const playDetectorRef = useRef(createQualifiedPlayDetector())
  const playReportedRef = useRef<Set<string>>(new Set())

  const maybeReportQualifiedPlay = useCallback(
    (currentTime: number, duration: number) => {
      // preview 守卫（沿用现有 feedback 上报同范式）；无 shortId 不上报
      if (!isPlaybackFeedbackEnabled(previewMode) || !shortId) return
      const { watchSeconds, qualified } = playDetectorRef.current.track(
        currentTime,
        duration > 0 ? duration : null,
      )
      if (!qualified) return
      const sessionId = usePlayerStore.getState().ensurePlaySessionId(shortId)
      const dedupeKey = `${sessionId}|${shortId}|${currentEpisode}`
      if (playReportedRef.current.has(dedupeKey)) return
      playReportedRef.current.add(dedupeKey) // 同步写入，after-await 不再重复发起
      const sourceId = activeLineRef.current?.episodes.get(currentEpisode)?.id ?? null
      void reportVideoPlayEvent(apiClient, {
        shortId,
        sourceId,
        episodeNumber: currentEpisode, // 前端口径统一（line-matrix 归一，电影=1）
        playSessionId: sessionId,
        watchSeconds,
        durationSeconds: duration > 0 ? duration : null,
        locale,
      })
    },
    [previewMode, shortId, currentEpisode, locale],
  )

  const handleTimeUpdate = useCallback(
    (t: number, d: number) => {
      setCurrentTime(t)
      setDuration(d)
      if (t > 0 && shortId) saveProgress(shortId, currentEpisode, t)
      maybeReportQualifiedPlay(t, d)
    },
    [setCurrentTime, setDuration, shortId, currentEpisode, maybeReportQualifiedPlay]
  )

  // STATS-03-B：切集 / 切视频重置观看累计（新的 qualified 判定窗口；reportedRef 不清——key 含 session|short|ep 自然隔离）
  useEffect(() => {
    playDetectorRef.current.reset()
  }, [currentEpisode, shortId])

  const handleTheaterChange = useCallback(
    (theater: boolean) => {
      setMode(theater ? 'theater' : 'default')
    },
    [setMode]
  )

  // BUGFIX-WATCH-EP-URL：选集写回 URL `?ep`（地址栏即时反映 + 刷新按 URL 恢复集号）。
  // 用 history.replaceState 而非 router.replace：同 slug 改 query 不触发 watch server component
  // 重取 video+sources，也不污染历史栈。portalMode（全局播放器）/SSR 下不改 URL。
  const syncEpisodeToUrl = useCallback(
    (ep: number) => {
      if (portalMode || typeof window === 'undefined') return
      const url = buildEpisodeUrl(window.location.pathname, window.location.search, ep)
      window.history.replaceState(window.history.state, '', url)
    },
    [portalMode]
  )

  // 选集（活跃线路内，网格仅列该线路有的集 → 恒有效）
  const handleEpisodeSelect = useCallback(
    (ep: number) => {
      setEpisode(ep)
      setStartTime(undefined)
      syncEpisodeToUrl(ep)
    },
    [setEpisode, syncEpisodeToUrl]
  )

  // 切线路：setActiveLineKey；新线路不含当前集 → 收敛到该线路第 1 集（用户裁定）
  const handleLineChange = useCallback(
    (index: number) => {
      const line = lineMatrix[index]
      if (!line) return
      setActiveLineKey(line.key)
      setStartTime(undefined)
      if (!line.episodes.has(currentEpisode)) {
        const firstEp = line.episodeNumbers[0]
        if (firstEp !== undefined) {
          setEpisode(firstEp)
          syncEpisodeToUrl(firstEp)  // BUGFIX-WATCH-EP-URL：切线收敛改集亦同步 URL
        }
      }
      setPlayerVersion((v) => v + 1)
    },
    [lineMatrix, currentEpisode, setActiveLineKey, setEpisode, syncEpisodeToUrl]
  )

  // ── 报错驱动切换（ADR-166 watchdog/retry 沿用；线路键化）──────────
  const retryAttemptedSetRef = useRef<Set<string>>(new Set())
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorReportedRef = useRef<Set<string>>(new Set())
  const successReportedRef = useRef<Set<string>>(new Set())

  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current !== null) {
      clearTimeout(watchdogTimerRef.current)
      watchdogTimerRef.current = null
    }
  }, [])

  // 切线 + 标 dead + feedback POST（环形扫描"含当前集且非 dead"的其它线路，保持同集换线）
  const switchAwayFromFailedSource = useCallback(
    (failedLineIndex: number, failedLineKey: string, failedSourceId: string | null, errorCode: string) => {
      setDeadLineKeys((prev) => {
        const next = new Set(prev)
        next.add(failedLineKey)
        return next
      })
      const matrix = lineMatrixRef.current
      const ep = usePlayerStore.getState().currentEpisode
      const dead = new Set(deadLineKeysRef.current)
      dead.add(failedLineKey)
      const total = matrix.length
      let next: number | null = null
      for (let step = 1; step < total; step++) {
        const cand = (failedLineIndex + step) % total
        const line = matrix[cand]
        if (!line || dead.has(line.key)) continue
        // 候选必须含当前集；且按**当前集源**的 effectiveScore 判健康（Codex review：
        // 不能用线路 representative/最高分集——某集坏但他集健康的线路会被误判可切入）。
        const candSource = line.episodes.get(ep)
        if (!candSource) continue
        const { isDead, isPending } = classifyRouteHealth(candSource.effectiveScore)
        if (!isDead && !isPending) {
          next = cand
          break
        }
      }
      if (next !== null) {
        setActiveLineKey(matrix[next]!.key)
        setPlayerVersion((v) => v + 1)
      }
      // feedback 上报 — 受 previewMode 守卫 + per-(sourceId, errorCode) 去抖 + 需要 sourceId
      if (!isPlaybackFeedbackEnabled(previewMode)) return
      const videoId = videoIdRef.current
      if (!videoId || !failedSourceId) return
      const dedupeKey = `${failedSourceId}|${errorCode}`
      if (errorReportedRef.current.has(dedupeKey)) return
      errorReportedRef.current.add(dedupeKey)
      void apiClient
        .post('/feedback/playback', { videoId, sourceId: failedSourceId, success: false, errorCode })
        .catch(() => {
          // fire-and-forget；后端 5xx 不阻断切线
        })
    },
    [previewMode, setActiveLineKey]
  )

  const handlePlayerError = useCallback(
    (event: PlayerErrorPayload, controls?: { retry: () => void }) => {
      const failedLineIndex = activeLineIndexRef.current
      const line = activeLineRef.current
      const failedLineKey = line?.key ?? ''
      const ep = usePlayerStore.getState().currentEpisode
      const failedSourceId = line?.episodes.get(ep)?.id ?? null

      // 首次 fatal → 同 tick 调 controls.retry + 启 watchdog（ADR-166 R-166-2）
      if (controls && failedLineKey && !retryAttemptedSetRef.current.has(failedLineKey)) {
        retryAttemptedSetRef.current.add(failedLineKey)
        controls.retry()
        clearWatchdog()
        watchdogTimerRef.current = setTimeout(() => {
          watchdogTimerRef.current = null
          switchAwayFromFailedSource(failedLineIndex, failedLineKey, failedSourceId, event.code)
        }, 3000)
        return
      }

      // 第二次 fatal（或无 controls）→ cancel watchdog + 立即切线
      clearWatchdog()
      switchAwayFromFailedSource(failedLineIndex, failedLineKey, failedSourceId, event.code)
    },
    [clearWatchdog, switchAwayFromFailedSource]
  )

  // onPlay 成功 → cancel watchdog + 清该线路 retry 计数 + 首播成功上报
  const handlePlaySuccess = useCallback(() => {
    setPlaying(true)
    clearWatchdog()
    const line = activeLineRef.current
    if (line) retryAttemptedSetRef.current.delete(line.key)
    if (!isPlaybackFeedbackEnabled(previewMode)) return
    const ep = usePlayerStore.getState().currentEpisode
    const playedId = line?.episodes.get(ep)?.id
    const videoId = videoIdRef.current
    if (!videoId || !playedId) return
    if (successReportedRef.current.has(playedId)) return
    successReportedRef.current.add(playedId)
    if (!shouldReportPlaySuccess(getSuccessSampleN())) return
    void apiClient
      .post('/feedback/playback', { videoId, sourceId: playedId, success: true })
      .catch(() => {
        // fire-and-forget
      })
  }, [setPlaying, clearWatchdog, previewMode])

  // 切线路（activeLineKey 变化）→ cancel 任何 pending watchdog 防 stale 触发
  useEffect(() => {
    return () => clearWatchdog()
  }, [activeLineKey, clearWatchdog])

  // 切集 / 切视频 → cancel watchdog + 清 retry 计数 + 重置 dead（同线路他集可重试）
  useEffect(() => {
    setDeadLineKeys(new Set())
    return () => {
      clearWatchdog()
      retryAttemptedSetRef.current.clear()
    }
  }, [currentEpisode, shortId, clearWatchdog])

  // unmount cleanup
  useEffect(() => {
    return () => clearWatchdog()
  }, [clearWatchdog])

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

        {/* 选集网格：渲染活跃线路实际集号（PLAYER-LINE-BOUND-EP / 非连续集号安全） */}
        {hasEpisodes && activePanelTab === 'episodes' ? (
          <div
            className="p-2 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5 overflow-y-auto scrollbar-thin"
            style={{ gap: 'var(--player-ep-gap)', maxHeight: 'var(--player-panel-max-h)' }}
          >
            {episodeNumbers.map((epNum) => {
              const isActive = currentEpisode === epNum
              return (
                <button
                  key={epNum}
                  type="button"
                  onClick={() => handleEpisodeSelect(epNum)}
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
            <RouteThemeSelector
              currentTheme={routeTheme}
              customTheme={customTheme}
              syncing={routeThemeSyncing}
              onThemeChange={setRouteTheme}
              onOpenCustomDialog={() => setCustomDialogOpen(true)}
            />
            <div className="rounded-md overflow-hidden" style={{ background: 'var(--bg-surface-sunken)' }}>
              <SourceBar
                sources={themedLines}
                activeIndex={activeLineIndex}
                onSourceChange={handleLineChange}
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
            {hasEpisodes && (
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
            <span data-testid="player-play-count">▶ {formatPlayCount(video.playCount)} 次播放</span>
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
                    key={`player-${shortId}-${currentEpisode}-${activeLineIndex}-${playerVersion}`}
                    src={activeSrc}
                    title={video.title}
                    episodes={inlineEpisodes}
                    activeEpisodeIndex={activeEpisodeIndex}
                    onEpisodeChange={
                      inlineEpisodes
                        ? (index: number) => {
                            const ep = episodeNumbers[index]
                            if (ep !== undefined) handleEpisodeSelect(ep)
                          }
                        : undefined
                    }
                    onNext={hasNext ? () => handleEpisodeSelect(nextEpisode!) : undefined}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={handlePlaySuccess}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    onTheaterChange={handleTheaterChange}
                    onError={handlePlayerError}
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
                  {hasEpisodes && (
                    <span className="text-xs">第 {currentEpisode} 集</span>
                  )}
                  <span className="text-xs mt-1">
                    {lineMatrix.length === 0 ? '暂无可用播放源' : '播放源暂时不可用，请切换线路'}
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
      {customDialogOpen && (
        <CustomThemeDialog
          initial={customTheme}
          onConfirm={(data) => {
            setCustomTheme(data)
            setCustomDialogOpen(false)
          }}
          onCancel={() => setCustomDialogOpen(false)}
          onClear={
            customTheme
              ? () => {
                  clearCustomTheme()
                  setCustomDialogOpen(false)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
