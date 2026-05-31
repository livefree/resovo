'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Drawer, LoadingState, ErrorState, VisChip, DualSignal, Thumb, EnrichmentBadgeCluster, ExternalMetaPanel } from '@resovo/admin-ui'
import type { VideoAdminDetail } from '@/lib/videos'
import { getVideo, patchVideoMeta, createVideo } from '@/lib/videos/api'
import type { VideoType } from '@resovo/types'
import type { TabKey, FormState } from './_videoEdit/types'
import { EMPTY_FORM } from './_videoEdit/types'
import { videoToForm, formToPatch, splitComma } from './_videoEdit/form-helpers'
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
const SELF_TITLE: React.CSSProperties = { fontSize: 'var(--font-size-sm)', fontWeight: 700, flex: 1 }
const ICON_BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '28px', height: '28px', border: 0, borderRadius: 'var(--radius-sm)',
  background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 'var(--font-size-base)',
}
const TAB_BAR: React.CSSProperties = {
  display: 'flex', padding: '0 18px', borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface-raised)', flexShrink: 0,
}
const QUICK_HEAD: React.CSSProperties = {
  display: 'flex', gap: '10px', padding: '10px 18px',
  background: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0, alignItems: 'center',
}
const CONTENT: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: '18px 18px 100px' }
const FOOTER: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '10px 18px', borderTop: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface-raised)', flexShrink: 0,
}
const BTN_PRIMARY: React.CSSProperties = {
  padding: '6px 16px', background: 'var(--accent-default)', color: 'var(--fg-on-accent)',
  border: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--font-size-sm-tight)', fontWeight: 500,
}
const BTN_GHOST: React.CSSProperties = { ...BTN_PRIMARY, background: 'transparent', color: 'var(--fg-muted)', border: '1px solid var(--border-subtle)' }

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 12px', border: 0, borderBottom: active ? '2px solid var(--accent-default)' : '2px solid transparent',
    background: 'transparent', color: active ? 'var(--accent-default)' : 'var(--fg-muted)',
    fontWeight: active ? 600 : 400, fontSize: 'var(--font-size-sm-tight)', cursor: 'pointer', marginBottom: '-1px',
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
  { id: 'external', label: '外部元数据' },
]

export function VideoEditDrawer({ open, videoId, onClose, onSaved }: VideoEditDrawerProps) {
  // CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-B / ADR-145：双模式 — videoId=null 创建 / 有值编辑
  const isCreating = videoId === null
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
    if (!open) return
    setSkippedFields([])
    setSubmitError(undefined)
    setTab('basic')
    if (videoId === null) {
      // 创建模式：清空表单 + 不 fetch
      setVideo(null)
      setForm(EMPTY_FORM)
      setOriginal(EMPTY_FORM)
      setLoading(false)
      setLoadError(undefined)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(undefined)
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
    if (!form.title.trim()) return
    setSubmitting(true)
    setSubmitError(undefined)
    try {
      if (isCreating) {
        // CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-B：创建模式调 POST /admin/videos
        await createVideo({
          title: form.title.trim(),
          type: (form.type as VideoType) ?? 'movie',
          contentRating: 'general',
          publishMode: 'staging',  // 默认入 staging 走标准审核流（admin 可后续走 Drawer 编辑模式改 visibility）
          titleEn: form.titleEn || null,
          description: form.description || null,
          year: form.year ? Number(form.year) : null,
          country: form.country || null,
          episodeCount: form.episodeCount ? Number(form.episodeCount) : undefined,
          status: form.status || undefined,
          rating: form.rating ? Number(form.rating) : null,
          director: splitComma(form.director),
          cast: splitComma(form.cast),
          writers: splitComma(form.writers),
          genres: splitComma(form.genres),
          doubanId: form.doubanId || null,
        })
        onSaved()
        onClose()
        return
      }
      // 编辑模式（原 PATCH 路径）
      if (!videoId) return
      const patch = formToPatch(original, form)
      if (Object.keys(patch).length === 0) { onClose(); return }
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
  }, [form, original, videoId, isCreating, onClose, onSaved])

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
            {isCreating ? '+ 添加视频' : video ? `编辑 · ${video.title}` : '编辑视频'}
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

        {(video || isCreating) && (
          <>
            {/* tab bar — 创建模式仅 basic tab 可点（lines/images/douban 需先创建视频）*/}
            <div style={TAB_BAR} role="tablist">
              {TABS.map((t) => {
                const disabled = isCreating && t.id !== 'basic'
                return (
                  <button
                    key={t.id} type="button" role="tab"
                    aria-selected={tab === t.id}
                    style={{ ...tabBtnStyle(tab === t.id), opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                    onClick={() => { if (!disabled) setTab(t.id) }}
                    disabled={disabled}
                    title={disabled ? '需先保存创建视频后才能管理' : undefined}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>

            {/* quick header — 仅编辑模式渲染（创建模式无 video 对象）*/}
            {video && !isCreating && (
              <div style={QUICK_HEAD}>
                <Thumb src={video.cover_url} size="poster-sm" loading="eager" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-size-sm-tight)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {video.title}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>
                    ID <code>{video.id}</code> · {video.type} · {video.year ?? '—'} · {video.source_count} 源
                  </div>
                </div>
                <VisChip visibility={visibility} review={review} />
                <DualSignal probe="unknown" render="unknown" />
                {/* META-11 / feature-2：富集徽标簇（density='header'：含 label + 富集时间）*/}
                {video.enrichmentSummary && (
                  <EnrichmentBadgeCluster
                    summary={video.enrichmentSummary}
                    type={video.type}
                    density="header"
                    enrichedAtLabel={
                      video.enrichmentSummary.enrichedAt
                        ? `富集 ${video.enrichmentSummary.enrichedAt.slice(0, 10)}`
                        : undefined
                    }
                  />
                )}
              </div>
            )}

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
                {tab === 'lines' && videoId && <TabLines videoId={videoId} />}
                {tab === 'images' && videoId && <TabImages videoId={videoId} />}
                {tab === 'douban' && videoId && video && (
                  <TabDouban
                    videoId={videoId}
                    doubanStatus={video.douban_status}
                    doubanId={video.douban_id}
                    reviewStatus={video.review_status}
                    onRefresh={onSaved}
                  />
                )}
                {/* META-18 / ADR-172 AMENDMENT 3：外部元数据真源并集视图（条目级） */}
                {tab === 'external' && video && video.enrichmentSummary && (
                  <ExternalMetaPanel
                    summary={video.enrichmentSummary}
                    type={video.type}
                    externalRefs={video.externalRefs}
                    bangumiInfo={video.bangumiInfo}
                    characters={video.bangumiCharacters}
                    catalogFields={{
                      titleOriginal: video.title_original,
                      rating: video.rating,
                      ratingVotes: video.rating_votes,
                      metadataSource: video.metadata_source,
                    }}
                    enrichedAtLabel={
                      video.enrichmentSummary.enrichedAt
                        ? `富集 ${video.enrichmentSummary.enrichedAt.slice(0, 10)}`
                        : undefined
                    }
                    density="drawer"
                    testId="data-video-external-meta"
                  />
                )}
              </div>
              <div style={FOOTER}>
                <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>
                  {isCreating ? '创建后默认入 staging 待审核（admin 可后续编辑改 visibility）' : lastEdit ? `最后编辑 · ${lastEdit}` : '最后编辑 · —'}
                </span>
                <span style={{ flex: 1 }} />
                <button type="button" style={BTN_GHOST} onClick={onClose} data-testid="data-video-edit-cancel">取消</button>
                <button type="submit" style={BTN_PRIMARY} disabled={submitting || !form.title.trim()} data-testid="data-video-edit-submit">
                  {submitting ? (isCreating ? '创建中…' : '保存中…') : (isCreating ? '创建视频' : '保存更改')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </Drawer>
  )
}
