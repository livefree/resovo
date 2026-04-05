/**
 * AdminVideoForm.tsx — 视频新增/编辑表单
 * ADMIN-02: 新增（POST）或编辑元数据（PUT）
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import type { VideoType, VideoStatus, VideoGenre } from '@/types'
import type { DoubanPreviewFound, DoubanPreviewMiss, DoubanPreview } from '@/types/contracts/v1/admin'

const GENRE_OPTIONS: { value: VideoGenre; label: string }[] = [
  { value: 'action',       label: '动作' },
  { value: 'comedy',       label: '喜剧' },
  { value: 'romance',      label: '爱情' },
  { value: 'thriller',     label: '惊悚' },
  { value: 'horror',       label: '恐怖' },
  { value: 'sci_fi',       label: '科幻' },
  { value: 'fantasy',      label: '奇幻/魔幻' },
  { value: 'history',      label: '历史/古装' },
  { value: 'crime',        label: '犯罪' },
  { value: 'mystery',      label: '悬疑' },
  { value: 'war',          label: '战争' },
  { value: 'family',       label: '家庭/亲情' },
  { value: 'biography',    label: '传记/人物' },
  { value: 'martial_arts', label: '武侠/功夫' },
  { value: 'other',        label: '其他' },
]

// ── 类型 ──────────────────────────────────────────────────────────

interface FormData {
  title: string
  titleEn: string
  description: string
  coverUrl: string
  type: VideoType
  genre: VideoGenre | ''
  category: string
  year: string
  country: string
  episodeCount: string
  status: VideoStatus
  rating: string
  director: string
  cast: string
  writers: string
}

interface VideoSourceRow {
  id: string
  source_url: string
  source_name: string
  is_active: boolean
  episode_number: number
  season_number: number
}


const DEFAULT_FORM: FormData = {
  title: '',
  titleEn: '',
  description: '',
  coverUrl: '',
  type: 'movie',
  genre: '',
  category: '',
  year: '',
  country: '',
  episodeCount: '1',
  status: 'completed',
  rating: '',
  director: '',
  cast: '',
  writers: '',
}

const MISS_REASON_LABEL: Record<DoubanPreviewMiss['reason'], string> = {
  already_synced: '该视频已关联豆瓣 ID，无需重新同步',
  no_match: '未找到相似度满足要求的豆瓣条目',
  fetch_failed: '豆瓣接口请求失败，请稍后重试',
}

// ── 辅助 ──────────────────────────────────────────────────────────

function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  hint,
}: {
  label: string
  name: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  hint?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[var(--text)]">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      )}
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

export function AdminVideoForm({ videoId }: { videoId?: string }) {
  const router = useRouter()
  const isEdit = Boolean(videoId)
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(isEdit)
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState<VideoSourceRow[]>([])
  const [doubanLoading, setDoubanLoading] = useState(false)
  const [doubanPreview, setDoubanPreview] = useState<DoubanPreview | null>(null)
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
  const [doubanApplying, setDoubanApplying] = useState(false)

  // 编辑模式：加载现有数据
  useEffect(() => {
    if (!videoId) return
    const load = async () => {
      try {
        const [videoRes, sourcesRes] = await Promise.all([
          apiClient.get<{ data: Record<string, unknown> }>(`/admin/videos/${videoId}`),
          apiClient.get<{ data: VideoSourceRow[] }>(`/admin/sources?videoId=${videoId}&page=1&limit=20`),
        ])
        const v = videoRes.data
        setForm({
          title: String(v.title ?? ''),
          titleEn: String(v.title_en ?? ''),
          description: String(v.description ?? ''),
          coverUrl: String(v.cover_url ?? ''),
          type: (v.type as VideoType) ?? 'movie',
          genre: (v.genre as VideoGenre | null) ?? '',
          category: String(v.category ?? ''),
          year: v.year ? String(v.year) : '',
          country: String(v.country ?? ''),
          episodeCount: String(v.episode_count ?? '1'),
          status: (v.status as VideoStatus) ?? 'completed',
          rating: v.rating ? String(v.rating) : '',
          director: Array.isArray(v.director) ? v.director.join(', ') : '',
          cast: Array.isArray(v.cast) ? v.cast.join(', ') : '',
          writers: Array.isArray(v.writers) ? v.writers.join(', ') : '',
        })
        setSources(sourcesRes.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
        setSources([])
      } finally {
        setFetching(false)
      }
    }
    load()
  }, [videoId])

  function set(key: keyof FormData) {
    return (value: string) => setForm((prev) => ({ ...prev, [key]: value }))
  }

  function splitNames(str: string): string[] {
    return str
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
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

  function toggleField(field: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  async function handleDoubanApply() {
    if (!videoId || !doubanPreview?.found) return
    setDoubanApplying(true)
    try {
      const payload: Record<string, unknown> = { doubanId: doubanPreview.doubanId }
      if (selectedFields.has('description')) payload.description = doubanPreview.description
      if (selectedFields.has('coverUrl')) payload.coverUrl = doubanPreview.coverUrl
      if (selectedFields.has('rating')) payload.rating = doubanPreview.rating
      if (selectedFields.has('director')) payload.director = doubanPreview.directors
      if (selectedFields.has('cast')) payload.cast = doubanPreview.casts
      await apiClient.patch(`/admin/videos/${videoId}`, payload)
      setForm((prev) => ({
        ...prev,
        description: selectedFields.has('description') ? (doubanPreview.description ?? '') : prev.description,
        coverUrl: selectedFields.has('coverUrl') ? (doubanPreview.coverUrl ?? '') : prev.coverUrl,
        rating: selectedFields.has('rating') && doubanPreview.rating !== null ? String(doubanPreview.rating) : prev.rating,
        director: selectedFields.has('director') ? doubanPreview.directors.join(', ') : prev.director,
        cast: selectedFields.has('cast') ? doubanPreview.casts.join(', ') : prev.cast,
      }))
    } finally {
      setDoubanApplying(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const payload = {
        title: form.title,
        titleEn: form.titleEn || null,
        description: form.description || null,
        coverUrl: form.coverUrl || null,
        type: form.type,
        genre: form.genre || null,
        category: form.category || null,
        year: form.year ? parseInt(form.year) : null,
        country: form.country || null,
        episodeCount: form.episodeCount ? parseInt(form.episodeCount) : 1,
        status: form.status,
        rating: form.rating ? parseFloat(form.rating) : null,
        director: splitNames(form.director),
        cast: splitNames(form.cast),
        writers: splitNames(form.writers),
      }

      if (isEdit && videoId) {
        await apiClient.patch(`/admin/videos/${videoId}`, payload)
      } else {
        await apiClient.post('/admin/videos', payload)
      }
      router.push('/admin/videos')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return <p className="text-[var(--muted)]">加载中…</p>
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-5"
      data-testid="admin-video-form"
    >
      {error && (
        <p className="rounded-md bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      <FormField
        label="标题"
        name="title"
        value={form.title}
        onChange={set('title')}
        required
        placeholder="中文标题"
        data-testid="admin-video-form-title"
      />
      <FormField
        label="英文标题"
        name="titleEn"
        value={form.titleEn}
        onChange={set('titleEn')}
        placeholder="English Title"
      />

      {/* 类型 + 状态 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text)]">
            类型 <span className="text-red-400">*</span>
          </label>
          <select
            value={form.type}
            onChange={(e) => set('type')(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            data-testid="admin-video-form-type"
          >
            <option value="movie">电影</option>
            <option value="series">剧集</option>
            <option value="anime">动漫</option>
            <option value="variety">综艺</option>
            <option value="documentary">纪录片</option>
            <option value="short">短片</option>
            <option value="sports">体育</option>
            <option value="music">音乐</option>
            <option value="news">新闻</option>
            <option value="kids">少儿</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text)]">完结状态</label>
          <select
            value={form.status}
            onChange={(e) => set('status')(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="completed">已完结</option>
            <option value="ongoing">连载中</option>
          </select>
        </div>
      </div>

      {/* 年份 + 国家 + 评分 + 集数 */}
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="年份"
          name="year"
          value={form.year}
          onChange={set('year')}
          type="number"
          placeholder="2024"
        />
        <FormField
          label="国家/地区"
          name="country"
          value={form.country}
          onChange={set('country')}
          placeholder="CN"
        />
        <FormField
          label="评分 (0-10)"
          name="rating"
          value={form.rating}
          onChange={set('rating')}
          type="number"
          placeholder="8.5"
        />
        <FormField
          label="集数"
          name="episodeCount"
          value={form.episodeCount}
          onChange={set('episodeCount')}
          type="number"
          placeholder="1"
        />
      </div>

      {/* 题材 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text)]">题材</label>
        <select
          value={form.genre}
          onChange={(e) => set('genre')(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          data-testid="admin-video-form-genre"
        >
          <option value="">— 未分类 —</option>
          {GENRE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <FormField
        label="分类"
        name="category"
        value={form.category}
        onChange={set('category')}
        placeholder="爱情 / 科幻 / 悬疑…"
      />
      <FormField
        label="封面图 URL"
        name="coverUrl"
        value={form.coverUrl}
        onChange={set('coverUrl')}
        placeholder="https://..."
      />
      <FormField
        label="简介"
        name="description"
        value={form.description}
        onChange={set('description')}
        type="textarea"
        placeholder="视频简介…"
      />
      <FormField
        label="导演"
        name="director"
        value={form.director}
        onChange={set('director')}
        placeholder="多人用逗号分隔"
      />
      <FormField
        label="主演"
        name="cast"
        value={form.cast}
        onChange={set('cast')}
        placeholder="多人用逗号分隔"
        hint="例：张三, 李四, 王五"
      />
      <FormField
        label="编剧"
        name="writers"
        value={form.writers}
        onChange={set('writers')}
        placeholder="多人用逗号分隔"
      />

      {isEdit && (
        <>
          <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--bg2)] p-4" data-testid="admin-video-sources-panel">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[var(--text)]">关联源</h2>
              <span className="text-xs text-[var(--muted)]">{sources.length} 条源</span>
            </div>
            <div className="space-y-2">
              {sources.map((source) => (
                <div key={source.id} className="rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                    <span>{source.source_name}</span>
                    <span>{source.is_active ? 'active' : 'inactive'}</span>
                  </div>
                  <div className="mt-1 break-all text-sm text-[var(--text)]">{source.source_url}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">S{source.season_number} / E{source.episode_number}</div>
                </div>
              ))}
              {sources.length === 0 && (
                <div className="rounded border border-dashed border-[var(--border)] px-3 py-6 text-center text-sm text-[var(--muted)]">
                  暂无源数据
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--bg2)] p-4" data-testid="admin-video-douban-panel">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[var(--text)]">豆瓣同步</h2>
              <button
                type="button"
                disabled={doubanLoading}
                onClick={() => { void handleDoubanSearch() }}
                className="rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--bg2)] disabled:opacity-50"
                data-testid="admin-video-douban-search"
              >
                {doubanLoading ? '搜索中…' : '搜索豆瓣'}
              </button>
            </div>

            {doubanPreview && !doubanPreview.found && (
              <div className="rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--muted)]">
                {MISS_REASON_LABEL[doubanPreview.reason]}
              </div>
            )}

            {doubanPreview?.found && (
              <div className="space-y-3" data-testid="admin-video-douban-preview">
                <div className="rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-xs text-[var(--muted)]">
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

                <div className="flex justify-end">
                  {doubanPreview.partial && (
                    <div className="rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-xs text-[var(--muted)]">
                      已匹配到豆瓣条目，但详情抓取失败。你仍可先应用豆瓣 ID，稍后再补全字段。
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={doubanApplying}
                    onClick={() => { void handleDoubanApply() }}
                    className="rounded bg-[var(--accent)] px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
                    data-testid="admin-video-douban-apply"
                  >
                    {doubanApplying
                      ? '应用中…'
                      : selectedFields.size > 0
                        ? `应用选中字段（${selectedFields.size}）`
                        : '仅应用豆瓣 ID'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
          data-testid="admin-video-form-submit"
        >
          {loading ? '保存中…' : isEdit ? '保存修改' : '创建视频'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-[var(--border)] px-5 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"
        >
          取消
        </button>
      </div>
    </form>
  )
}

interface FieldCheckboxProps {
  field: string
  label: string
  value: string
  checked: boolean
  onChange: (field: string) => void
}

function FieldCheckbox({ field, label, value, checked, onChange }: FieldCheckboxProps) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded border border-[var(--border)] bg-[var(--bg3)] px-3 py-2">
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
