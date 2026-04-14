/**
 * StagingEditPanel.tsx — 暂存视频侧滑编辑面板（ADMIN-10）
 * 功能：元数据快速编辑 + 豆瓣搜索/确认 + 源健康摘要
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api-client'
import { notify } from '@/components/admin/shared/toast/useAdminToast'
import { AdminFormField } from '@/components/admin/shared/form/AdminFormField'
import { AdminInput } from '@/components/admin/shared/form/AdminInput'
import { DoubanStatusBadge, SourceHealthBadge } from '@/components/admin/staging/StagingReadinessBadge'

// ── 类型 ─────────────────────────────────────────────────────────

interface StagingVideoDetail {
  id: string
  title: string
  titleEn: string | null
  type: string
  year: number | null
  genres: string[]
  coverUrl: string | null
  doubanStatus: 'pending' | 'matched' | 'candidate' | 'unmatched'
  doubanSubjectId: string | null
  sourceCheckStatus: 'pending' | 'ok' | 'partial' | 'all_dead'
  activeSourceCount: number
  metaScore: number
}

interface DoubanCandidate {
  subjectId: string
  title: string
  year: number | null
  coverUrl: string | null
  rating: number | null
  type: string
}

interface StagingEditPanelProps {
  videoId: string | null
  onClose: () => void
  onUpdated: () => void
}

// ── 常量 ─────────────────────────────────────────────────────────

const VIDEO_TYPES = [
  'movie', 'series', 'anime', 'variety', 'documentary',
  'short', 'sports', 'music', 'news', 'kids', 'other',
] as const

const VIDEO_TYPE_LABELS: Record<string, string> = {
  movie: '电影', series: '剧集', anime: '动画', variety: '综艺',
  documentary: '纪录片', short: '短剧', sports: '体育', music: '音乐',
  news: '新闻', kids: '儿童', other: '其他',
}

// ── 子组件：源健康摘要 ────────────────────────────────────────────

function SourceHealthSummary({
  status,
  activeCount,
}: {
  status: string
  activeCount: number
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2">
      <SourceHealthBadge status={status as 'pending' | 'ok' | 'partial' | 'all_dead'} activeCount={activeCount} />
      <span className="text-xs text-[var(--muted)]">活跃源：{activeCount}</span>
    </div>
  )
}

// ── 子组件：豆瓣搜索结果行 ───────────────────────────────────────

function DoubanCandidateRow({
  candidate,
  onConfirm,
  confirming,
}: {
  candidate: DoubanCandidate
  onConfirm: (subjectId: string) => void
  confirming: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2">
      {candidate.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={candidate.coverUrl}
          alt={candidate.title}
          className="h-10 w-7 rounded object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text)] truncate">{candidate.title}</p>
        <p className="text-xs text-[var(--muted)]">
          {candidate.year ?? '—'} · {VIDEO_TYPE_LABELS[candidate.type] ?? candidate.type}
          {candidate.rating != null && ` · ${candidate.rating}`}
        </p>
      </div>
      <button
        type="button"
        disabled={confirming}
        onClick={() => onConfirm(candidate.subjectId)}
        className="shrink-0 rounded bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-black hover:opacity-90 disabled:opacity-40"
      >
        确认
      </button>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export function StagingEditPanel({ videoId, onClose, onUpdated }: StagingEditPanelProps) {
  const [video, setVideo] = useState<StagingVideoDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 元数据编辑
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [type, setType] = useState('')
  const [genresInput, setGenresInput] = useState('')
  const [saving, setSaving] = useState(false)

  // 豆瓣搜索
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [candidates, setCandidates] = useState<DoubanCandidate[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // 补源采集
  const [refetching, setRefetching] = useState(false)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 加载视频详情（无单条 staging API，通过列表接口批量取后按 ID 匹配）
  const loadVideo = useCallback(async (id: string) => {
    setLoadError(null)
    try {
      const res = await apiClient.get<{ data: StagingVideoDetail[] }>(`/admin/staging?page=1&limit=200`)
      const found = res.data.find((v) => v.id === id) ?? null
      if (!found) {
        setLoadError('视频不在暂存状态或已发布')
        return
      }
      setVideo(found)
      setTitle(found.title)
      setYear(found.year != null ? String(found.year) : '')
      setType(found.type)
      setGenresInput((found.genres ?? []).join(', '))
      setSearchKeyword(found.title)
      return found
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '加载失败')
    }
  }, [])

  // 清理轮询
  useEffect(() => () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
  }, [])

  useEffect(() => {
    if (!videoId) {
      setVideo(null)
      setCandidates([])
      setSearchError(null)
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return
    }
    void loadVideo(videoId)
  }, [videoId, loadVideo])

  async function handleSave() {
    if (!videoId || !video) return
    const genreList = genresInput
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean)
    const payload: Record<string, unknown> = {}
    if (title !== video.title) payload.title = title
    const yearNum = year === '' ? null : parseInt(year, 10)
    if (yearNum !== video.year) payload.year = yearNum
    if (type !== video.type) payload.type = type
    const genresChanged = JSON.stringify(genreList) !== JSON.stringify(video.genres ?? [])
    if (genresChanged) payload.genres = genreList

    if (Object.keys(payload).length === 0) {
      notify.info('没有变更')
      return
    }

    setSaving(true)
    try {
      await apiClient.patch(`/admin/staging/${videoId}/meta`, payload)
      notify.success('元数据已保存')
      onUpdated()
      await loadVideo(videoId)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDoubanSearch() {
    if (!videoId || !searchKeyword.trim()) return
    setSearching(true)
    setSearchError(null)
    setCandidates([])
    try {
      const res = await apiClient.post<{ data: { candidates: DoubanCandidate[] } }>(
        `/admin/staging/${videoId}/douban-search`,
        { keyword: searchKeyword.trim() },
      )
      setCandidates(res.data.candidates)
      if (res.data.candidates.length === 0) {
        setSearchError('未找到匹配条目')
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : '搜索失败')
    } finally {
      setSearching(false)
    }
  }

  async function handleDoubanConfirm(subjectId: string) {
    if (!videoId) return
    setConfirmingId(subjectId)
    try {
      await apiClient.post(`/admin/staging/${videoId}/douban-confirm`, { subjectId })
      notify.success('豆瓣条目已确认')
      setCandidates([])
      onUpdated()
      await loadVideo(videoId)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '确认失败')
    } finally {
      setConfirmingId(null)
    }
  }

  async function handleRefetchSources() {
    if (!videoId || refetching) return
    setRefetching(true)
    try {
      await apiClient.post(`/admin/videos/${videoId}/refetch-sources`, {})
      notify.success('补源采集已触发，正在后台执行…')
      onUpdated()

      // 轮询：每 5s 刷新一次，最多 30s（6 次）
      let attempts = 0
      const MAX_ATTEMPTS = 6
      pollTimerRef.current = setInterval(async () => {
        attempts++
        const updated = await loadVideo(videoId)
        if (
          updated?.sourceCheckStatus !== 'all_dead' ||
          attempts >= MAX_ATTEMPTS
        ) {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current)
            pollTimerRef.current = null
          }
          setRefetching(false)
          if (updated?.sourceCheckStatus !== 'all_dead') {
            onUpdated()
          }
        }
      }, 5000)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '触发补源失败')
      setRefetching(false)
    }
  }

  const isOpen = videoId !== null

  return (
    <>
      {/* 遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
          data-testid="staging-edit-panel-overlay"
        />
      )}

      {/* 侧滑面板 */}
      <div
        data-testid="staging-edit-panel"
        className={`fixed right-0 top-0 z-50 flex h-full w-[440px] max-w-full flex-col bg-[var(--bg2)] shadow-2xl transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-modal="true"
        role="dialog"
        aria-label="编辑暂存视频"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--text)]">处理暂存视频</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--bg3)] hover:text-[var(--text)]"
            data-testid="staging-edit-panel-close"
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadError && (
            <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {loadError}
            </div>
          )}

          {!video && !loadError && (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--muted)]">
              加载中…
            </div>
          )}

          {video && (
            <>
              {/* 源健康摘要 */}
              <div className="mb-5">
                <p className="mb-2 text-xs font-medium text-[var(--muted)] uppercase tracking-wide">源健康状态</p>
                <SourceHealthSummary
                  status={video.sourceCheckStatus}
                  activeCount={video.activeSourceCount}
                />
                {video.sourceCheckStatus === 'all_dead' && (
                  <button
                    type="button"
                    onClick={() => void handleRefetchSources()}
                    disabled={refetching}
                    data-testid="staging-refetch-sources-btn"
                    className="mt-2 w-full rounded-md border border-orange-500/40 bg-orange-500/10 py-2 text-xs text-orange-300 hover:bg-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {refetching ? '补源中，等待结果…' : '触发补源采集'}
                  </button>
                )}
              </div>

              {/* 豆瓣状态 */}
              <div className="mb-5">
                <p className="mb-2 text-xs font-medium text-[var(--muted)] uppercase tracking-wide">豆瓣匹配</p>
                <div className="flex items-center gap-2">
                  <DoubanStatusBadge status={video.doubanStatus} />
                  {video.doubanSubjectId && (
                    <span className="text-xs text-[var(--muted)]">#{video.doubanSubjectId}</span>
                  )}
                </div>
              </div>

              {/* 元数据编辑区 */}
              <div className="mb-6">
                <p className="mb-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wide">元数据编辑</p>

                <AdminFormField label="标题">
                  <AdminInput
                    value={title}
                    onChange={setTitle}
                    placeholder="视频标题"
                    disabled={saving}
                  />
                </AdminFormField>

                <AdminFormField label="年份">
                  <AdminInput
                    value={year}
                    onChange={setYear}
                    placeholder="如：2023"
                    type="number"
                    disabled={saving}
                  />
                </AdminFormField>

                <AdminFormField label="类型">
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    disabled={saving}
                    data-testid="staging-edit-type-select"
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                  >
                    {VIDEO_TYPES.map((t) => (
                      <option key={t} value={t}>{VIDEO_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </AdminFormField>

                <AdminFormField label="分类标签（逗号分隔）">
                  <AdminInput
                    value={genresInput}
                    onChange={setGenresInput}
                    placeholder="如：动作, 科幻"
                    disabled={saving}
                  />
                </AdminFormField>

                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  data-testid="staging-edit-save-btn"
                  className="w-full rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? '保存中…' : '保存元数据'}
                </button>
              </div>

              {/* 豆瓣搜索区 */}
              <div>
                <p className="mb-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wide">豆瓣搜索确认</p>

                <div className="mb-3 flex gap-2">
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleDoubanSearch() }}
                    placeholder="输入关键词搜索豆瓣"
                    disabled={searching}
                    data-testid="staging-douban-keyword-input"
                    className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => void handleDoubanSearch()}
                    disabled={searching || !searchKeyword.trim()}
                    data-testid="staging-douban-search-btn"
                    className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg4)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {searching ? '搜索中…' : '搜索'}
                  </button>
                </div>

                {searchError && (
                  <p className="mb-2 text-xs text-[var(--status-danger,#ef4444)]">{searchError}</p>
                )}

                <div className="flex flex-col gap-2" data-testid="staging-douban-candidates">
                  {candidates.map((c) => (
                    <DoubanCandidateRow
                      key={c.subjectId}
                      candidate={c}
                      onConfirm={(id) => void handleDoubanConfirm(id)}
                      confirming={confirmingId === c.subjectId}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
