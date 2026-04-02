'use client'

/**
 * VideoDetailDrawer.tsx — 视频详情侧边抽屉（UX-05）
 * 3 Tab 布局：基础编辑 / 关联源 / 豆瓣同步（预览→选择字段→应用）
 */

import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api-client'

// ── 类型 ──────────────────────────────────────────────────────────

interface VideoDetailDrawerProps {
  videoId: string | null
  open: boolean
  onClose: () => void
  onSaved: () => void
  canSyncDouban?: boolean
}

interface VideoDetail {
  id: string
  title: string
  description: string | null
  year: number | null
  type: string
  country: string | null
}

interface VideoSourceRow {
  id: string
  source_url: string
  source_name: string
  is_active: boolean
  episode_number: number
  season_number: number
}

interface VideoFormState {
  title: string
  description: string
  year: string
  type: string
  country: string
}

interface DoubanPreviewFound {
  found: true
  doubanId: string
  title: string
  year: number | null
  rating: number | null
  description: string | null
  coverUrl: string | null
  directors: string[]
  casts: string[]
}

interface DoubanPreviewMiss {
  found: false
  reason: 'already_synced' | 'no_match' | 'fetch_failed'
}

type DoubanPreview = DoubanPreviewFound | DoubanPreviewMiss

type TabId = 'edit' | 'sources' | 'douban'

// ── 常量 ──────────────────────────────────────────────────────────

const EMPTY_FORM: VideoFormState = {
  title: '', description: '', year: '', type: '', country: '',
}

function toFormState(video: VideoDetail): VideoFormState {
  return {
    title: video.title,
    description: video.description ?? '',
    year: video.year == null ? '' : String(video.year),
    type: video.type,
    country: video.country ?? '',
  }
}

const MISS_REASON_LABEL: Record<DoubanPreviewMiss['reason'], string> = {
  already_synced: '该视频已关联豆瓣 ID，无需重新同步',
  no_match: '未找到相似度满足要求的豆瓣条目',
  fetch_failed: '豆瓣接口请求失败，请稍后重试',
}

// ── 主组件 ──────────────────────────────────────────────────────

export function VideoDetailDrawer({
  videoId, open, onClose, onSaved, canSyncDouban = false,
}: VideoDetailDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [video, setVideo] = useState<VideoDetail | null>(null)
  const [sources, setSources] = useState<VideoSourceRow[]>([])
  const [form, setForm] = useState<VideoFormState>(EMPTY_FORM)
  const [tab, setTab] = useState<TabId>('edit')

  // 豆瓣同步状态
  const [doubanLoading, setDoubanLoading] = useState(false)
  const [doubanPreview, setDoubanPreview] = useState<DoubanPreview | null>(null)
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
  const [applyingSave, setApplyingSave] = useState(false)

  useEffect(() => {
    if (!open || !videoId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setTab('edit')
      setDoubanPreview(null)
      setSelectedFields(new Set())
      try {
        const [videoRes, sourcesRes] = await Promise.all([
          apiClient.get<{ data: VideoDetail }>(`/admin/videos/${videoId}`),
          apiClient.get<{ data: VideoSourceRow[] }>(`/admin/sources?videoId=${videoId}&page=1&limit=20`),
        ])
        if (cancelled) return
        setVideo(videoRes.data)
        setForm(toFormState(videoRes.data))
        setSources(sourcesRes.data)
      } catch {
        if (cancelled) return
        setVideo(null)
        setSources([])
        setForm(EMPTY_FORM)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [open, videoId])

  const sourceSummary = useMemo(() => `${sources.length} 条源`, [sources.length])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!videoId) return
    setSaving(true)
    try {
      await apiClient.patch(`/admin/videos/${videoId}`, {
        title: form.title,
        description: form.description || null,
        year: form.year.trim() === '' ? null : Number.parseInt(form.year, 10),
        type: form.type,
        country: form.country || null,
      })
      onSaved()
      onClose()
    } catch {
      // silent — user can retry
    } finally {
      setSaving(false)
    }
  }

  async function handleDoubanSearch() {
    if (!videoId) return
    setDoubanLoading(true)
    setDoubanPreview(null)
    setSelectedFields(new Set())
    try {
      const res = await apiClient.get<{ data: DoubanPreview }>(`/admin/videos/${videoId}/douban-preview`)
      setDoubanPreview(res.data)
      if (res.data.found) {
        // 默认全选有值的字段
        const defaults = new Set<string>()
        if (res.data.description) defaults.add('description')
        if (res.data.coverUrl) defaults.add('coverUrl')
        if (res.data.rating !== null) defaults.add('rating')
        if (res.data.directors.length > 0) defaults.add('director')
        if (res.data.casts.length > 0) defaults.add('cast')
        setSelectedFields(defaults)
      }
    } catch {
      setDoubanPreview({ found: false, reason: 'fetch_failed' })
    } finally {
      setDoubanLoading(false)
    }
  }

  async function handleDoubanApply() {
    if (!videoId || !doubanPreview?.found) return
    setApplyingSave(true)
    try {
      const body: Record<string, unknown> = { doubanId: doubanPreview.doubanId }
      if (selectedFields.has('description')) body.description = doubanPreview.description
      if (selectedFields.has('coverUrl')) body.coverUrl = doubanPreview.coverUrl
      if (selectedFields.has('rating')) body.rating = doubanPreview.rating
      if (selectedFields.has('director')) body.director = doubanPreview.directors
      if (selectedFields.has('cast')) body.cast = doubanPreview.casts
      await apiClient.patch(`/admin/videos/${videoId}`, body)
      onSaved()
      onClose()
    } catch {
      // silent
    } finally {
      setApplyingSave(false)
    }
  }

  function toggleField(field: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  if (!open) return null

  const tabs: { id: TabId; label: string }[] = [
    { id: 'edit', label: '基础编辑' },
    { id: 'sources', label: `关联源（${sources.length}）` },
    ...(canSyncDouban ? [{ id: 'douban' as TabId, label: '豆瓣同步' }] : []),
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" data-testid="video-detail-drawer-overlay">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-[var(--border)] bg-[var(--bg)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]" data-testid="video-detail-drawer-title">视频详情</h2>
            <p className="text-xs text-[var(--muted)]">{video?.title ?? '加载中…'}</p>
          </div>
          <button
            type="button"
            className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            onClick={onClose}
            data-testid="video-detail-close"
          >关闭</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm transition-colors ${
                tab === t.id
                  ? 'border-b-2 border-[var(--accent)] font-medium text-[var(--text)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="px-5 py-4 text-sm text-[var(--muted)]" data-testid="video-detail-loading">加载中…</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Tab: 基础编辑 */}
            {tab === 'edit' && (
              <form className="px-5 py-4" onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <label className="block text-sm text-[var(--text)]">
                    <span className="mb-1 block text-xs text-[var(--muted)]">标题</span>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      className="w-full rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm"
                      data-testid="video-detail-title-input"
                    />
                  </label>
                  <label className="block text-sm text-[var(--text)]">
                    <span className="mb-1 block text-xs text-[var(--muted)]">描述</span>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      className="min-h-28 w-full rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm"
                      data-testid="video-detail-description-input"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm text-[var(--text)]">
                      <span className="mb-1 block text-xs text-[var(--muted)]">年份</span>
                      <input
                        value={form.year}
                        onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
                        className="w-full rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm"
                        data-testid="video-detail-year-input"
                      />
                    </label>
                    <label className="block text-sm text-[var(--text)]">
                      <span className="mb-1 block text-xs text-[var(--muted)]">类型</span>
                      <input
                        value={form.type}
                        onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                        className="w-full rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm"
                        data-testid="video-detail-type-input"
                      />
                    </label>
                  </div>
                  <label className="block text-sm text-[var(--text)]">
                    <span className="mb-1 block text-xs text-[var(--muted)]">国家/地区</span>
                    <input
                      value={form.country}
                      onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                      className="w-full rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm"
                      data-testid="video-detail-country-input"
                    />
                  </label>
                </div>
                <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
                  <button
                    type="button"
                    className="rounded border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"
                    onClick={onClose}
                  >取消</button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded bg-[var(--accent)] px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
                    data-testid="video-detail-save"
                  >{saving ? '保存中…' : '保存'}</button>
                </div>
              </form>
            )}

            {/* Tab: 关联源 */}
            {tab === 'sources' && (
              <div className="px-5 py-4" data-testid="video-detail-sources-panel">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[var(--text)]">关联源</h3>
                  <span className="text-xs text-[var(--muted)]" data-testid="video-detail-source-count">{sourceSummary}</span>
                </div>
                {video ? (
                  <div className="mb-3 rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-xs text-[var(--muted)]">
                    <div>{video.title}</div>
                    <div className="mt-1">ID: {video.id}</div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className="rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2"
                      data-testid={`video-detail-source-${source.id}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                        <span>{source.source_name}</span>
                        <span>{source.is_active ? 'active' : 'inactive'}</span>
                      </div>
                      <div className="mt-1 break-all text-sm text-[var(--text)]">{source.source_url}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">S{source.season_number} / E{source.episode_number}</div>
                    </div>
                  ))}
                  {sources.length === 0 ? (
                    <div className="rounded border border-dashed border-[var(--border)] px-3 py-6 text-center text-sm text-[var(--muted)]">
                      暂无源数据
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Tab: 豆瓣同步 */}
            {tab === 'douban' && (
              <div className="px-5 py-4" data-testid="video-detail-douban-panel">
                <p className="mb-4 text-xs text-[var(--muted)]">
                  从豆瓣搜索匹配条目，预览变更后选择要应用的字段。
                </p>
                <button
                  type="button"
                  disabled={doubanLoading}
                  onClick={() => { void handleDoubanSearch() }}
                  className="rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--bg2)] disabled:opacity-50"
                  data-testid="video-detail-douban-search"
                >{doubanLoading ? '搜索中…' : '搜索豆瓣'}</button>

                {doubanPreview && !doubanPreview.found && (
                  <div className="mt-4 rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm text-[var(--muted)]">
                    {MISS_REASON_LABEL[doubanPreview.reason]}
                  </div>
                )}

                {doubanPreview?.found && (
                  <div className="mt-4 space-y-3" data-testid="video-detail-douban-preview">
                    <div className="rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-xs text-[var(--muted)]">
                      豆瓣匹配：<span className="font-medium text-[var(--text)]">{doubanPreview.title}</span>
                      {doubanPreview.year ? ` (${doubanPreview.year})` : ''}
                      <span className="ml-2">ID: {doubanPreview.doubanId}</span>
                    </div>

                    <div className="space-y-2">
                      {doubanPreview.description && (
                        <FieldCheckbox
                          field="description"
                          label="简介"
                          value={doubanPreview.description}
                          checked={selectedFields.has('description')}
                          onChange={toggleField}
                        />
                      )}
                      {doubanPreview.coverUrl && (
                        <FieldCheckbox
                          field="coverUrl"
                          label="封面"
                          value={doubanPreview.coverUrl}
                          checked={selectedFields.has('coverUrl')}
                          onChange={toggleField}
                        />
                      )}
                      {doubanPreview.rating !== null && (
                        <FieldCheckbox
                          field="rating"
                          label="评分"
                          value={String(doubanPreview.rating)}
                          checked={selectedFields.has('rating')}
                          onChange={toggleField}
                        />
                      )}
                      {doubanPreview.directors.length > 0 && (
                        <FieldCheckbox
                          field="director"
                          label="导演"
                          value={doubanPreview.directors.join('、')}
                          checked={selectedFields.has('director')}
                          onChange={toggleField}
                        />
                      )}
                      {doubanPreview.casts.length > 0 && (
                        <FieldCheckbox
                          field="cast"
                          label="演员"
                          value={doubanPreview.casts.join('、')}
                          checked={selectedFields.has('cast')}
                          onChange={toggleField}
                        />
                      )}
                    </div>

                    <div className="flex justify-end border-t border-[var(--border)] pt-3">
                      <button
                        type="button"
                        disabled={applyingSave || selectedFields.size === 0}
                        onClick={() => { void handleDoubanApply() }}
                        className="rounded bg-[var(--accent)] px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
                        data-testid="video-detail-douban-apply"
                      >{applyingSave ? '应用中…' : `应用选中字段（${selectedFields.size}）`}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 子组件 ────────────────────────────────────────────────────────

interface FieldCheckboxProps {
  field: string
  label: string
  value: string
  checked: boolean
  onChange: (field: string) => void
}

function FieldCheckbox({ field, label, value, checked, onChange }: FieldCheckboxProps) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(field)}
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0">
        <div className="text-xs font-medium text-[var(--text)]">{label}</div>
        <div className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">{value}</div>
      </div>
    </label>
  )
}
