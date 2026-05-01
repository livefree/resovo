'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Drawer, LoadingState, ErrorState, VisChip, DualSignal } from '@resovo/admin-ui'
import type { VideoAdminDetail } from '@/lib/videos'
import { getVideo, patchVideoMeta } from '@/lib/videos/api'
import type { TabKey, FormState } from './_videoEdit/types'
import { EMPTY_FORM } from './_videoEdit/types'
import { videoToForm, formToPatch } from './_videoEdit/form-helpers'
import { TabBasicInfo } from './_videoEdit/TabBasicInfo'
import { TabLines } from './_videoEdit/TabLines'
import { TabImages } from './_videoEdit/TabImages'
import { TabDouban } from './_videoEdit/TabDouban'

// ── styles ──────────────────────────────────────────────────────────

const SELF_HEADER: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '10px',
  padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0,
}
const SELF_TITLE: React.CSSProperties = { fontSize: '14px', fontWeight: 700, flex: 1 }
const ICON_BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '28px', height: '28px', border: 0, borderRadius: 'var(--radius-sm)',
  background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: '16px',
}
const TAB_BAR: React.CSSProperties = {
  display: 'flex', padding: '0 18px', borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--bg-inset)', flexShrink: 0,
}
const QUICK_HEAD: React.CSSProperties = {
  display: 'flex', gap: '10px', padding: '10px 18px',
  background: 'var(--bg-inset)', borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0, alignItems: 'center',
}
const POSTER: React.CSSProperties = {
  width: '32px', height: '48px', borderRadius: 'var(--radius-sm)', objectFit: 'cover',
  background: 'var(--bg-surface)', flexShrink: 0,
}
const CONTENT: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: '18px 18px 100px' }
const FOOTER: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '10px 18px', borderTop: '1px solid var(--border-subtle)',
  background: 'var(--bg-inset)', flexShrink: 0,
}
const BTN_PRIMARY: React.CSSProperties = {
  padding: '6px 16px', background: 'var(--accent-default)', color: 'var(--fg-on-accent)',
  border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
}
const BTN_GHOST: React.CSSProperties = { ...BTN_PRIMARY, background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border-subtle)' }

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 12px', border: 0, borderBottom: active ? '2px solid var(--accent-default)' : '2px solid transparent',
    background: 'transparent', color: active ? 'var(--accent-default)' : 'var(--fg-muted)',
    fontWeight: active ? 600 : 400, fontSize: '13px', cursor: 'pointer', marginBottom: '-1px',
  }
}

// ── component ──────────────────────────────────────────────────────

export interface VideoEditDrawerProps {
  readonly open: boolean
  readonly videoId: string | null
  readonly onClose: () => void
  readonly onSaved: () => void
}

const TABS: ReadonlyArray<{ id: TabKey; label: string }> = [
  { id: 'basic', label: '基础信息' },
  { id: 'lines', label: '线路管理' },
  { id: 'images', label: '图片素材' },
  { id: 'douban', label: '豆瓣·元数据' },
]

export function VideoEditDrawer({ open, videoId, onClose, onSaved }: VideoEditDrawerProps) {
  const [video, setVideo] = useState<VideoAdminDetail | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [original, setOriginal] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<Error | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<Error | undefined>()
  const [skippedFields, setSkippedFields] = useState<string[]>([])
  const [tab, setTab] = useState<TabKey>('basic')
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!open || !videoId) return
    let cancelled = false
    setLoading(true)
    setLoadError(undefined)
    setSkippedFields([])
    setTab('basic')
    getVideo(videoId)
      .then((v) => {
        if (cancelled) return
        setVideo(v)
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
      .then((v) => { setVideo(v); const f = videoToForm(v); setForm(f); setOriginal(f) })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [videoId])

  const visibility = video?.visibility_status ?? 'hidden'
  const review = video?.review_status ?? 'pending_review'
  const lastEdit = video?.updated_at
    ? new Date(video.updated_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <Drawer
      open={open}
      placement="right"
      width={fullscreen ? '100vw' : 680}
      onClose={onClose}
      closeOnEscape
      closeOnBackdropClick
      noPadding
      data-testid="data-video-edit-drawer"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* self-rendered header: title + fullscreen + close */}
        <div style={SELF_HEADER}>
          <span style={SELF_TITLE}>
            {video ? `编辑 · ${video.title}` : '编辑视频'}
          </span>
          <button
            type="button" style={ICON_BTN}
            onClick={() => setFullscreen((f) => !f)}
            title={fullscreen ? '退出全屏' : '全屏编辑'}
            aria-label={fullscreen ? '退出全屏' : '全屏编辑'}
          >
            {fullscreen ? '⊡' : '⊞'}
          </button>
          <button type="button" style={ICON_BTN} onClick={onClose} aria-label="关闭">×</button>
        </div>

        {loading && !video && <LoadingState variant="spinner" />}
        {loadError && !video && <ErrorState error={loadError} title="加载失败" onRetry={retryLoad} />}

        {video && (
          <>
            {/* tab bar */}
            <div style={TAB_BAR} role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id} type="button" role="tab"
                  aria-selected={tab === t.id}
                  style={tabBtnStyle(tab === t.id)}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* quick header */}
            <div style={QUICK_HEAD}>
              {video.cover_url
                ? <img src={video.cover_url} alt="" style={POSTER} />
                : <div style={POSTER} aria-hidden="true" />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {video.title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
                  ID <code>{video.id}</code> · {video.type} · {video.year ?? '—'} · {video.source_count} 源
                </div>
              </div>
              <VisChip visibility={visibility} review={review} />
              <DualSignal probe="unknown" render="unknown" />
            </div>

            {/* tab content */}
            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
              noValidate
            >
              <div style={CONTENT}>
                {tab === 'basic' && (
                  <TabBasicInfo
                    form={form} set={set}
                    skippedFields={skippedFields} submitError={submitError}
                  />
                )}
                {tab === 'lines' && <TabLines />}
                {tab === 'images' && <TabImages />}
                {tab === 'douban' && <TabDouban />}
              </div>
              <div style={FOOTER}>
                <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
                  {lastEdit ? `最后编辑 · ${lastEdit}` : '最后编辑 · —'}
                </span>
                <span style={{ flex: 1 }} />
                <button type="button" style={BTN_GHOST} onClick={onClose} data-testid="data-video-edit-cancel">取消</button>
                <button type="submit" style={BTN_PRIMARY} disabled={submitting || !form.title.trim()} data-testid="data-video-edit-submit">
                  {submitting ? '保存中…' : '保存更改'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </Drawer>
  )
}
