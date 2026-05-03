'use client'

import React, { useState } from 'react'
import { VisChip, DecisionCard, StaffNoteBar, Thumb } from '@resovo/admin-ui'
import type { VideoQueueRow } from '@resovo/types'
import { EpisodeSelector } from './EpisodeSelector'
import { LinesPanel } from './LinesPanel'
import * as api from '@/lib/moderation/api'
import { M } from '@/i18n/messages/zh-CN/moderation'

interface PendingCenterProps {
  readonly v: VideoQueueRow
  readonly onStaffNoteChange: (videoId: string, note: string | null) => void
  readonly onEditVideo: (videoId: string) => void
}

const BTN_SM: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 12,
}

const SECTION: React.CSSProperties = {
  padding: 12,
  background: 'var(--bg-surface-raised)',
  borderRadius: 6,
  marginBottom: 14,
}

export function PendingCenter({ v, onStaffNoteChange, onEditVideo }: PendingCenterProps): React.ReactElement {
  const [currentEp, setCurrentEp] = useState(1)
  const [noteEditing, setNoteEditing] = useState(false)
  const [noteSubmitting, setNoteSubmitting] = useState(false)

  const handleNoteSubmit = async (note: string | null) => {
    setNoteSubmitting(true)
    try {
      await api.updateStaffNote(v.id, note)
      onStaffNoteChange(v.id, note)
      setNoteEditing(false)
    } catch {
      throw new Error(M.errors.staffNoteFailed)
    } finally {
      setNoteSubmitting(false)
    }
  }

  return (
    <>
      <DecisionCard
        video={v}
        probeState={v.probe}
        renderState={v.render}
        onStaffNoteEdit={() => setNoteEditing(true)}
      />

      {/* Staff note bar */}
      <div style={{ marginBottom: 14 }}>
        <StaffNoteBar
          note={v.staffNote}
          onEdit={() => setNoteEditing(true)}
          editing={noteEditing}
          onSubmit={handleNoteSubmit}
          onCancelEdit={() => setNoteEditing(false)}
          submitting={noteSubmitting}
        />
      </div>

      {/* Video player placeholder */}
      <div
        style={{
          background: 'var(--player-full-bg)',
          borderRadius: 6,
          aspectRatio: '16/9',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--player-full-progress-track)',
            border: '1px solid var(--player-full-buffer-fill)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <span style={{ color: 'white', fontSize: 18 }}>▶</span>
        </div>
        <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'white', background: 'var(--player-mini-overlay)', padding: '2px 6px', borderRadius: 4 }}>
            EP{currentEp}
          </span>
        </div>
      </div>

      {/* Video info */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        <Thumb
          src={v.coverUrl}
          size="poster-lg"
          decorative={false}
          alt={v.title}
          fallback={<span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{v.type}</span>}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--fg-default)' }}>{v.title}</h2>
            <span style={{ color: 'var(--fg-muted)', fontSize: 13 }}>{v.year}</span>
            <VisChip visibility={v.visibilityStatus} review={v.reviewStatus} />
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--fg-muted)' }}>
            {v.type} · {v.episodeCount} 集 · {v.country ?? '—'} · ⭐ {v.rating ?? '—'} · ID <code style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.id}</code>
          </div>
          {v.badges.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {v.badges.map(b => (
                <span key={b} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)', border: '1px solid var(--state-warning-border)' }}>
                  {b}
                </span>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button style={BTN_SM} onClick={() => onEditVideo(v.id)} aria-label={M.aria.editVideo}>✎ 编辑视频</button>
            <button style={BTN_SM} onClick={() => window.open(`/video/${v.id}`, '_blank')} aria-label={M.aria.openFrontend}>↗ 前台</button>
          </div>
        </div>
      </div>

      {/* Episode selector */}
      {v.episodeCount > 1 && (
        <div style={SECTION}>
          <EpisodeSelector total={v.episodeCount} current={currentEp} onSelect={setCurrentEp} />
        </div>
      )}

      {/* Lines panel */}
      <div style={SECTION}>
        <LinesPanel videoId={v.id} />
      </div>
    </>
  )
}
