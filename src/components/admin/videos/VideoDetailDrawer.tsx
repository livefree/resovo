'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api-client'

interface VideoDetailDrawerProps {
  videoId: string | null
  open: boolean
  onClose: () => void
  onSaved: () => void
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

const EMPTY_FORM: VideoFormState = {
  title: '',
  description: '',
  year: '',
  type: '',
  country: '',
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

export function VideoDetailDrawer({ videoId, open, onClose, onSaved }: VideoDetailDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [video, setVideo] = useState<VideoDetail | null>(null)
  const [sources, setSources] = useState<VideoSourceRow[]>([])
  const [form, setForm] = useState<VideoFormState>(EMPTY_FORM)

  useEffect(() => {
    if (!open || !videoId) return

    let cancelled = false

    async function load() {
      setLoading(true)
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

    return () => {
      cancelled = true
    }
  }, [open, videoId])

  const sourceSummary = useMemo(
    () => `${sources.length} 条源`,
    [sources.length],
  )

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
      // silent
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" data-testid="video-detail-drawer-overlay">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-[var(--border)] bg-[var(--bg)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]" data-testid="video-detail-drawer-title">视频详情</h2>
            <p className="text-xs text-[var(--muted)]">编辑基础元数据并查看关联源</p>
          </div>
          <button
            type="button"
            className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            onClick={onClose}
            data-testid="video-detail-close"
          >
            关闭
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-4 text-sm text-[var(--muted)]" data-testid="video-detail-loading">加载中…</div>
        ) : (
          <div className="grid flex-1 gap-0 overflow-hidden md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <form className="overflow-y-auto border-r border-[var(--border)] px-5 py-4" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <label className="block text-sm text-[var(--text)]">
                  <span className="mb-1 block text-xs text-[var(--muted)]">标题</span>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    className="w-full rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm"
                    data-testid="video-detail-title-input"
                  />
                </label>
                <label className="block text-sm text-[var(--text)]">
                  <span className="mb-1 block text-xs text-[var(--muted)]">描述</span>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="min-h-28 w-full rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm"
                    data-testid="video-detail-description-input"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm text-[var(--text)]">
                    <span className="mb-1 block text-xs text-[var(--muted)]">年份</span>
                    <input
                      value={form.year}
                      onChange={(event) => setForm((prev) => ({ ...prev, year: event.target.value }))}
                      className="w-full rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm"
                      data-testid="video-detail-year-input"
                    />
                  </label>
                  <label className="block text-sm text-[var(--text)]">
                    <span className="mb-1 block text-xs text-[var(--muted)]">类型</span>
                    <input
                      value={form.type}
                      onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                      className="w-full rounded border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 text-sm"
                      data-testid="video-detail-type-input"
                    />
                  </label>
                </div>
                <label className="block text-sm text-[var(--text)]">
                  <span className="mb-1 block text-xs text-[var(--muted)]">国家/地区</span>
                  <input
                    value={form.country}
                    onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
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
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-[var(--accent)] px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
                  data-testid="video-detail-save"
                >
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </form>

            <div className="overflow-y-auto px-5 py-4" data-testid="video-detail-sources-panel">
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
                {!loading && sources.length === 0 ? (
                  <div className="rounded border border-dashed border-[var(--border)] px-3 py-6 text-center text-sm text-[var(--muted)]">
                    暂无源数据
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
