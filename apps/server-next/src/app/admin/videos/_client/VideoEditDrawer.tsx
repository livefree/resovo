'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Drawer, LoadingState, ErrorState } from '@resovo/admin-ui'
import type { VideoAdminDetail, VideoMetaPatch } from '@/lib/videos'
import type { VideoType, VideoStatus, VideoGenre } from '@resovo/types'
import { getVideo, patchVideoMeta } from '@/lib/videos/api'
import { VIDEO_TYPE_OPTIONS } from './VideoFilterFields'

// ── form types + helpers ──────────────────────────────────────────

interface FormState {
  title: string; titleEn: string; type: VideoType; year: string
  country: string; description: string; genres: string
  episodeCount: string; status: VideoStatus | ''; rating: string
  director: string; cast: string; writers: string; doubanId: string
}

const EMPTY_FORM: FormState = {
  title: '', titleEn: '', type: 'movie', year: '', country: '', description: '',
  genres: '', episodeCount: '', status: '', rating: '',
  director: '', cast: '', writers: '', doubanId: '',
}

function videoToForm(v: VideoAdminDetail): FormState {
  return {
    title: v.title,
    titleEn: v.title_en ?? '',
    type: v.type,
    year: v.year != null ? String(v.year) : '',
    country: v.country ?? '',
    description: v.description ?? '',
    genres: v.genres.join(', '),
    episodeCount: v.episode_count ? String(v.episode_count) : '',
    status: v.status ?? '',
    rating: v.rating != null ? String(v.rating) : '',
    director: v.director.join(', '),
    cast: v.cast.join(', '),
    writers: v.writers.join(', '),
    doubanId: v.douban_id ?? '',
  }
}

function splitComma(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}

function formToPatch(orig: FormState, curr: FormState): VideoMetaPatch {
  const p: VideoMetaPatch = {}
  if (curr.title !== orig.title) p.title = curr.title
  if (curr.titleEn !== orig.titleEn) p.titleEn = curr.titleEn || null
  if (curr.type !== orig.type) p.type = curr.type
  if (curr.year !== orig.year) p.year = curr.year ? parseInt(curr.year, 10) : null
  if (curr.country !== orig.country) p.country = curr.country || null
  if (curr.description !== orig.description) p.description = curr.description || null
  if (curr.genres !== orig.genres) p.genres = splitComma(curr.genres) as VideoGenre[]
  if (curr.episodeCount !== orig.episodeCount) p.episodeCount = curr.episodeCount ? parseInt(curr.episodeCount, 10) : undefined
  if (curr.status !== orig.status) p.status = (curr.status as VideoStatus) || undefined
  if (curr.rating !== orig.rating) p.rating = curr.rating ? parseFloat(curr.rating) : null
  if (curr.director !== orig.director) p.director = splitComma(curr.director)
  if (curr.cast !== orig.cast) p.cast = splitComma(curr.cast)
  if (curr.writers !== orig.writers) p.writers = splitComma(curr.writers)
  if (curr.doubanId !== orig.doubanId) p.doubanId = curr.doubanId || null
  return p
}

// ── types + style ─────────────────────────────────────────────────

export interface VideoEditDrawerProps {
  readonly open: boolean
  readonly videoId: string | null
  readonly onClose: () => void
  readonly onSaved: () => void
}

const FORM_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', overflowY: 'auto', flex: 1 }
const FOOTER_STYLE: React.CSSProperties = { display: 'flex', gap: '8px', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }
const INPUT_STYLE: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', fontSize: '13px', background: 'var(--bg-surface)', color: 'var(--fg-default)', boxSizing: 'border-box' }
const TEXTAREA_STYLE: React.CSSProperties = { ...INPUT_STYLE, minHeight: '80px', resize: 'vertical' }
const SELECT_STYLE: React.CSSProperties = { ...INPUT_STYLE }
const LABEL_STYLE: React.CSSProperties = { fontSize: '12px', fontWeight: 500, color: 'var(--fg-muted)', marginBottom: '3px' }
const FIELD_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column' }
const BTN_PRIMARY: React.CSSProperties = { padding: '6px 16px', background: 'var(--accent-default)', color: 'var(--fg-on-accent)', border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }
const BTN_GHOST: React.CSSProperties = { ...BTN_PRIMARY, background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border-subtle)' }
const SKIPPED_STYLE: React.CSSProperties = { padding: '8px 12px', background: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }

// ── component ─────────────────────────────────────────────────────

export function VideoEditDrawer({ open, videoId, onClose, onSaved }: VideoEditDrawerProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [original, setOriginal] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<Error | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<Error | undefined>()
  const [skippedFields, setSkippedFields] = useState<string[]>([])

  useEffect(() => {
    if (!open || !videoId) return
    let cancelled = false
    setLoading(true)
    setLoadError(undefined)
    setSkippedFields([])
    getVideo(videoId)
      .then((v) => {
        if (cancelled) return
        const f = videoToForm(v)
        setForm(f)
        setOriginal(f)
      })
      .catch((e: unknown) => { if (!cancelled) setLoadError(e instanceof Error ? e : new Error(String(e))) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, videoId])

  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }))
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !videoId) return
    const patch = formToPatch(original, form)
    if (Object.keys(patch).length === 0) { onClose(); return }
    setSubmitting(true)
    setSubmitError(undefined)
    try {
      const result = await patchVideoMeta(videoId, patch)
      if (result.skippedFields.length > 0) {
        setSkippedFields(result.skippedFields)
      } else {
        onSaved()
        onClose()
      }
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setSubmitting(false)
    }
  }, [form, original, videoId, onClose, onSaved])

  const retryLoad = useCallback(() => {
    if (!videoId) return
    setLoadError(undefined)
    setLoading(true)
    getVideo(videoId)
      .then((v) => { const f = videoToForm(v); setForm(f); setOriginal(f) })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [videoId])

  return (
    <Drawer
      open={open}
      placement="right"
      width={540}
      title="编辑视频基础信息"
      onClose={onClose}
      closeOnEscape
      closeOnBackdropClick
      data-testid="data-video-edit-drawer"
    >
      {loading
        ? <LoadingState variant="spinner" />
        : loadError
          ? <ErrorState error={loadError} title="加载失败" onRetry={retryLoad} />
          : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }} noValidate>
              <div style={FORM_STYLE}>
                {skippedFields.length > 0 && (
                  <div style={SKIPPED_STYLE} role="alert">
                    以下字段因锁定未保存：{skippedFields.join('、')}
                  </div>
                )}
                {submitError && (
                  <div style={{ ...SKIPPED_STYLE, background: 'var(--state-error-bg)', color: 'var(--state-error-fg)' }} role="alert">
                    {submitError.message}
                  </div>
                )}
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>标题 *</label>
                  <input style={INPUT_STYLE} value={form.title} maxLength={200} required onChange={(e) => set('title', e.target.value)} data-testid="edit-title" />
                </div>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>英文标题</label>
                  <input style={INPUT_STYLE} value={form.titleEn} onChange={(e) => set('titleEn', e.target.value)} />
                </div>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>类型</label>
                  <select style={SELECT_STYLE} value={form.type} onChange={(e) => set('type', e.target.value as VideoType)}>
                    {VIDEO_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>年份</label>
                  <input style={INPUT_STYLE} type="number" value={form.year} onChange={(e) => set('year', e.target.value)} />
                </div>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>地区</label>
                  <input style={INPUT_STYLE} value={form.country} maxLength={10} onChange={(e) => set('country', e.target.value)} />
                </div>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>简介</label>
                  <textarea style={TEXTAREA_STYLE} value={form.description} onChange={(e) => set('description', e.target.value)} />
                </div>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>题材（逗号分隔）</label>
                  <input style={INPUT_STYLE} value={form.genres} onChange={(e) => set('genres', e.target.value)} />
                </div>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>集数</label>
                  <input style={INPUT_STYLE} type="number" value={form.episodeCount} onChange={(e) => set('episodeCount', e.target.value)} />
                </div>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>连载状态</label>
                  <select style={SELECT_STYLE} value={form.status} onChange={(e) => set('status', e.target.value as VideoStatus | '')}>
                    <option value="">—</option>
                    <option value="ongoing">连载中</option>
                    <option value="completed">已完结</option>
                  </select>
                </div>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>评分</label>
                  <input style={INPUT_STYLE} type="number" step="0.1" min="0" max="10" value={form.rating} onChange={(e) => set('rating', e.target.value)} />
                </div>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>导演（逗号分隔）</label>
                  <input style={INPUT_STYLE} value={form.director} onChange={(e) => set('director', e.target.value)} />
                </div>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>演员（逗号分隔）</label>
                  <input style={INPUT_STYLE} value={form.cast} onChange={(e) => set('cast', e.target.value)} />
                </div>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>编剧（逗号分隔）</label>
                  <input style={INPUT_STYLE} value={form.writers} onChange={(e) => set('writers', e.target.value)} />
                </div>
                <div style={FIELD_STYLE}>
                  <label style={LABEL_STYLE}>豆瓣 ID</label>
                  <input style={INPUT_STYLE} value={form.doubanId} onChange={(e) => set('doubanId', e.target.value)} />
                </div>
              </div>
              <div style={FOOTER_STYLE}>
                <button type="button" style={BTN_GHOST} onClick={onClose} data-testid="data-video-edit-cancel">取消</button>
                <button type="submit" style={BTN_PRIMARY} disabled={submitting || !form.title.trim()} data-testid="data-video-edit-submit">
                  {submitting ? '保存中…' : '保存'}
                </button>
              </div>
            </form>
          )
      }
    </Drawer>
  )
}
