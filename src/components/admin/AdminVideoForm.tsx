/**
 * AdminVideoForm.tsx — 视频新增/编辑表单
 * ADMIN-02: 新增（POST）或编辑元数据（PUT）
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import type { VideoType, VideoStatus } from '@/types'

// ── 类型 ──────────────────────────────────────────────────────────

interface FormData {
  title: string
  titleEn: string
  description: string
  coverUrl: string
  type: VideoType
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

const DEFAULT_FORM: FormData = {
  title: '',
  titleEn: '',
  description: '',
  coverUrl: '',
  type: 'movie',
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

  // 编辑模式：加载现有数据
  useEffect(() => {
    if (!videoId) return
    const load = async () => {
      try {
        const res = await apiClient.get<{ data: Record<string, unknown> }>(`/admin/videos/${videoId}`)
        const v = res.data
        setForm({
          title: String(v.title ?? ''),
          titleEn: String(v.title_en ?? ''),
          description: String(v.description ?? ''),
          coverUrl: String(v.cover_url ?? ''),
          type: (v.type as VideoType) ?? 'movie',
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
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
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
