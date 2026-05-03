'use client'

import React, { useState } from 'react'
import { LoadingState, ErrorState } from '@resovo/admin-ui'
import { VE } from '@/i18n/messages/zh-CN/videos-edit'
import { useVideoImages } from '@/lib/videos/use-images'
import type { VideoImageKind, ImageSlotInfo } from '@/lib/videos/types'

// ── styles ──────────────────────────────────────────────────────────

const SLOT_CARD: React.CSSProperties = {
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
  overflow: 'hidden', background: 'var(--bg-surface-raised)',
}
const SLOT_BTN: React.CSSProperties = {
  flex: 1, padding: '4px 0', fontSize: '11px', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--fg-muted)',
  cursor: 'pointer',
}
const PRESENT_PILL: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '1px 6px',
  fontSize: '10px', borderRadius: 'var(--radius-full)',
  background: 'var(--state-success-bg)', color: 'var(--state-success-fg)',
}
const MISSING_PILL: React.CSSProperties = {
  ...PRESENT_PILL,
  background: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)',
}
const INPUT_INLINE: React.CSSProperties = {
  flex: 1, padding: '4px 6px', fontSize: '11px',
  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)', color: 'var(--fg-default)',
}

// ── props ────────────────────────────────────────────────────────────

export interface TabImagesProps {
  readonly videoId: string
}

const KIND_ORDER: ReadonlyArray<VideoImageKind> = ['poster', 'backdrop', 'banner_backdrop', 'logo']
const KIND_ASPECT: Record<VideoImageKind, string> = {
  poster: '2/3',
  backdrop: '16/9',
  banner_backdrop: '16/9',
  logo: '3/1',
}

// ── SlotCard ────────────────────────────────────────────────────────

function SlotCard({
  kind, info, pending, onUpdate,
}: {
  kind: VideoImageKind
  info: ImageSlotInfo | null
  pending: boolean
  onUpdate: (kind: VideoImageKind, url: string) => Promise<void>
}): React.ReactElement {
  const [urlInput, setUrlInput] = useState('')
  const [editing, setEditing] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const m = VE.images
  const slot = m.slots[kind]
  const hasImage = Boolean(info?.url)

  const handleUpdate = async () => {
    if (!urlInput.trim()) return
    setUpdateError(null)
    try {
      await onUpdate(kind, urlInput.trim())
      setEditing(false)
      setUrlInput('')
    } catch {
      setUpdateError(m.errors.updateFailed)
    }
  }

  return (
    <div style={SLOT_CARD}>
      <div style={{ aspectRatio: KIND_ASPECT[kind], background: 'var(--bg-surface)', position: 'relative', overflow: 'hidden' }}>
        {hasImage
          ? <img src={info!.url!} alt={slot.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-subtle)', fontSize: '11px' }}>暂无图片</div>
        }
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>{slot.label}</span>
          {kind === 'poster' && <span style={{ fontSize: '9px', color: 'var(--state-error-fg)', fontWeight: 700 }}>{m.required}</span>}
          <span style={{ flex: 1 }} />
          <span style={hasImage ? PRESENT_PILL : MISSING_PILL}>
            {hasImage ? m.present : m.missing}
          </span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--fg-muted)', marginBottom: '6px' }}>{slot.desc}</div>
        {updateError && (
          <div style={{ fontSize: '10px', color: 'var(--state-error-fg)', marginBottom: '4px' }}>{updateError}</div>
        )}
        {editing ? (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input
              style={INPUT_INLINE}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={m.urlPlaceholder}
              aria-label={`${slot.label} URL`}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleUpdate() }}
              autoFocus
            />
            <button type="button" style={SLOT_BTN} onClick={() => void handleUpdate()} disabled={pending || !urlInput.trim()}>
              {pending ? '…' : m.actions.update}
            </button>
            <button type="button" style={SLOT_BTN} onClick={() => { setEditing(false); setUrlInput('') }}>
              {m.actions.cancel}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="button" style={SLOT_BTN} onClick={() => setEditing(true)}>
              {m.actions.inputUrl}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────

export function TabImages({ videoId }: TabImagesProps): React.ReactElement {
  const [state, actions] = useVideoImages(videoId)
  const m = VE.images

  if (state.loading && !state.images) return <LoadingState variant="spinner" />
  if (state.error && !state.images) return (
    <ErrorState error={state.error} title={m.errors.loadFailed} onRetry={actions.reload} />
  )

  const uploadedCount = KIND_ORDER.filter((k) => Boolean(state.images?.[k]?.url)).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>{m.title}</span>
        <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>{m.uploadedCount(uploadedCount, KIND_ORDER.length)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {KIND_ORDER.map((kind) => (
          <SlotCard
            key={kind}
            kind={kind}
            info={state.images?.[kind] ?? null}
            pending={state.updatePending.has(kind)}
            onUpdate={actions.update}
          />
        ))}
      </div>
    </div>
  )
}
