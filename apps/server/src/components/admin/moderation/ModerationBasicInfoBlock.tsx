/**
 * ModerationBasicInfoBlock.tsx — 审核台基础信息内联编辑块（UX-12）
 * 标题：点击切换 input / 年份：点击切换 input
 * 类型：单排单选卡片（立即保存，乐观更新）
 * 分类标签：复选卡片（点击立即保存，乐观更新）
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { notify } from '@/components/admin/shared/toast/useAdminToast'

const TYPE_LABELS: Record<string, string> = {
  movie: '电影', series: '剧集', anime: '动漫', variety: '综艺',
  documentary: '纪录片', short: '短片', sports: '体育', music: '音乐',
  news: '新闻', kids: '少儿', other: '其他',
}

const GENRE_LABELS: Record<string, string> = {
  action: '动作', comedy: '喜剧', romance: '爱情', thriller: '惊悚',
  horror: '恐怖', sci_fi: '科幻', fantasy: '奇幻', history: '历史',
  crime: '犯罪', mystery: '悬疑', war: '战争', family: '家庭',
  biography: '传记', martial_arts: '武侠', other: '其他',
}

export interface VideoBasicInfo {
  id: string
  title: string
  type: string
  year: number | null
  description: string | null
  review_status: string
  meta_score: number
  genres: string[]
  created_at: string
}

interface ModerationBasicInfoBlockProps {
  video: VideoBasicInfo
  videoId: string
  onSaved: () => void
}

export function ModerationBasicInfoBlock({ video, videoId, onSaved }: ModerationBasicInfoBlockProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingYear, setEditingYear] = useState(false)
  const [yearDraft, setYearDraft] = useState('')
  // 乐观本地状态：在 refetch 前即时反映用户操作
  const [localType, setLocalType] = useState(video.type)
  const [localGenres, setLocalGenres] = useState<string[]>(video.genres)
  const [saving, setSaving] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const yearInputRef = useRef<HTMLInputElement>(null)

  // 父组件 refetch 后同步（去掉 onSaved 防止循环）
  useEffect(() => { setLocalType(video.type) }, [video.type])
  useEffect(() => { setLocalGenres(video.genres) }, [video.genres])

  useEffect(() => { if (editingTitle) titleInputRef.current?.focus() }, [editingTitle])
  useEffect(() => { if (editingYear) yearInputRef.current?.focus() }, [editingYear])

  const saveField = useCallback(async (
    patch: { title?: string; year?: number | null; type?: string; genres?: string[] },
    successMsg: string
  ) => {
    setSaving(true)
    try {
      await apiClient.patch(`/admin/moderation/${videoId}/meta`, patch)
      notify.success(successMsg)
      onSaved()
    } catch {
      notify.error('保存失败，已恢复原值')
      // 回滚乐观更新
      setLocalType(video.type)
      setLocalGenres(video.genres)
    } finally {
      setSaving(false)
    }
  }, [videoId, onSaved, video.type, video.genres])

  const handleTypeClick = useCallback((v: string) => {
    if (v === localType || saving) return
    setLocalType(v)
    void saveField({ type: v }, `类型已改为：${TYPE_LABELS[v] ?? v}`)
  }, [localType, saving, saveField])

  const handleGenreToggle = useCallback((v: string) => {
    if (saving) return
    const next = localGenres.includes(v)
      ? localGenres.filter((g) => g !== v)
      : [...localGenres, v]
    setLocalGenres(next)
    void saveField({ genres: next }, '分类标签已保存')
  }, [localGenres, saving, saveField])

  return (
    <div className="space-y-2.5">
      {/* 标题 */}
      {editingTitle ? (
        <input
          ref={titleInputRef}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => {
            setEditingTitle(false)
            const trimmed = titleDraft.trim()
            if (trimmed && trimmed !== video.title) void saveField({ title: trimmed }, `标题已保存`)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.currentTarget.blur() }
            if (e.key === 'Escape') { setEditingTitle(false) }
          }}
          disabled={saving}
          data-testid="meta-title-input"
          className="w-full rounded border border-[var(--accent)] bg-[var(--bg)] px-2 py-1 text-base font-semibold text-[var(--text)] focus:outline-none"
        />
      ) : (
        <h3
          className="cursor-pointer text-base font-semibold text-[var(--text)] hover:underline"
          title="点击编辑标题"
          data-testid="meta-title-display"
          onClick={() => { setTitleDraft(video.title); setEditingTitle(true) }}
        >
          {video.title}
        </h3>
      )}

      {/* 年份 + 状态标签 */}
      <div className="flex flex-wrap items-center gap-2">
        {editingYear ? (
          <input
            ref={yearInputRef}
            type="number"
            min={1900}
            max={2100}
            value={yearDraft}
            onChange={(e) => setYearDraft(e.target.value)}
            onBlur={() => {
              setEditingYear(false)
              const n = yearDraft === '' ? null : parseInt(yearDraft, 10)
              if (n !== video.year) void saveField({ year: n }, `年份已保存`)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.currentTarget.blur() }
              if (e.key === 'Escape') { setEditingYear(false) }
            }}
            disabled={saving}
            data-testid="meta-year-input"
            className="w-20 rounded border border-[var(--accent)] bg-[var(--bg)] px-1.5 py-0.5 text-xs text-[var(--text)] focus:outline-none"
          />
        ) : (
          <span
            className="cursor-pointer text-xs text-[var(--muted)] hover:underline"
            title="点击编辑年份"
            data-testid="meta-year-display"
            onClick={() => { setYearDraft(video.year != null ? String(video.year) : ''); setEditingYear(true) }}
          >
            {video.year ?? '—'}
          </span>
        )}
        <span className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
          {video.review_status}
        </span>
        <span className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
          元数据 {video.meta_score}%
        </span>
      </div>

      {/* 类型：单选卡片（乐观更新） */}
      <div>
        <p className="mb-1 text-[10px] text-[var(--muted)]">类型</p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(TYPE_LABELS).map(([v, label]) => (
            <button
              key={v}
              type="button"
              disabled={saving}
              data-testid={`meta-type-${v}`}
              onClick={() => handleTypeClick(v)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${v === localType ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg3)] text-[var(--muted)] hover:bg-[var(--bg2)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 分类标签：复选卡片（乐观更新） */}
      <div>
        <p className="mb-1 text-[10px] text-[var(--muted)]">分类标签</p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(GENRE_LABELS).map(([v, label]) => {
            const selected = localGenres.includes(v)
            return (
              <button
                key={v}
                type="button"
                disabled={saving}
                data-testid={`genre-option-${v}`}
                onClick={() => handleGenreToggle(v)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${selected ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg3)] text-[var(--muted)] hover:bg-[var(--bg2)]'}`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {video.description && (
        <p className="line-clamp-3 text-xs text-[var(--muted)]">{video.description}</p>
      )}
      <p className="text-xs text-[var(--muted)]">入库：{video.created_at.slice(0, 10)}</p>
    </div>
  )
}
