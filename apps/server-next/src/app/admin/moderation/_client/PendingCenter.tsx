'use client'

import React, { useState, useEffect } from 'react'
import { VisChip, DecisionCard, StaffNoteBar, Thumb } from '@resovo/admin-ui'
import { formatCountryName, type VideoQueueRow } from '@resovo/types'
import { EpisodeSelector } from './EpisodeSelector'
import { LinesPanel } from './LinesPanel'
import { AdminPlayer } from './AdminPlayer'
import { useSelectedLine } from '@/lib/moderation/use-selected-line'
import * as api from '@/lib/moderation/api'
import { buildMergeHref } from '@/lib/merge/entry'
import { buildAdminPreviewUrl } from '@/lib/admin-preview-url'
import { M } from '@/i18n/messages/zh-CN/moderation'

interface PendingCenterProps {
  readonly v: VideoQueueRow
  readonly onStaffNoteChange: (videoId: string, note: string | null) => void
  readonly onEditVideo: (videoId: string) => void
  /** CHG-358：probe / render-check 完成后通知 PendingQueue refetch（左队列 ModListRow pill 联动）*/
  readonly onSourceHealthChanged?: () => void
}

// ADR-160 D-160-7：preview URL 派生收口到 lib/admin-preview-url（MODUX-P1-3：
// origin + locale 注入 + 双因素 query 单点维护）
function openAdminPreview(v: VideoQueueRow): void {
  window.open(buildAdminPreviewUrl({ type: v.type, slug: v.slug, shortId: v.shortId }), '_blank', 'noopener,noreferrer')
}

// CHG-363-A：跳拆分深链 / -B 卡补 MergeClient 接收 query 自动展开拆分 tab + 预填 videoId
// CHG-VIR-13-A1：buildMergeHref 收口 + 补 from=moderation（来源回链栏消费）
function openSplitWorkspace(videoId: string): void {
  window.open(buildMergeHref({ kind: 'split', videoId, from: 'moderation' }), '_blank', 'noopener,noreferrer')
}

const BTN_SM: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-row)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xs)',
}

const SECTION: React.CSSProperties = {
  padding: 'var(--panel-padding-y) var(--panel-padding-x)',
  background: 'var(--bg-surface-raised)',
  borderRadius: 6,
  marginBottom: 14,
}

export function PendingCenter({ v, onStaffNoteChange, onEditVideo, onSourceHealthChanged }: PendingCenterProps): React.ReactElement {
  const [currentEp, setCurrentEp] = useState(1)
  const [noteEditing, setNoteEditing] = useState(false)
  const { selected, onLineSelect, clearSelection } = useSelectedLine(currentEp)
  const [noteSubmitting, setNoteSubmitting] = useState(false)

  useEffect(() => {
    clearSelection()
    setCurrentEp(1)
  }, [v.id, clearSelection])

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

      {/* AdminPlayer（FIX-D）：替换静态占位；通过 useSelectedLine 受控 */}
      <div style={{ marginBottom: 14 }}>
        <AdminPlayer
          videoId={v.id}
          sourceUrl={selected?.sourceUrl ?? null}
          sourceId={selected?.sourceId ?? null}
          title={v.title}
        />
      </div>

      {/* Video info */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        <Thumb
          src={v.coverUrl}
          size="poster-lg"
          decorative={false}
          alt={v.title}
          fallback={<span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>{v.type}</span>}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--fg-default)' }}>{v.title}</h2>
            <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>{v.year}</span>
            <VisChip visibility={v.visibilityStatus} review={v.reviewStatus} />
          </div>
          <div style={{ marginTop: 4, fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
            {v.type} · {v.episodeCount} 集 · {formatCountryName(v.country, 'zh-CN', '—')} · ⭐ {v.rating ?? '—'} · ID <code style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xxs)' }}>{v.id}</code>
          </div>
          {v.badges.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {v.badges.map(b => (
                <span key={b} style={{ fontSize: 'var(--font-size-xxs)', padding: '2px 8px', borderRadius: 999, background: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)', border: '1px solid var(--state-warning-border)' }}>
                  {b}
                </span>
              ))}
            </div>
          )}
          <div
            style={{
              marginTop: 10,
              display: 'grid',
              gridTemplateColumns: v.episodeCount > 1 ? '1fr 1fr 1fr' : '1fr 1fr',
              gap: 6,
            }}
          >
            <button style={BTN_SM} onClick={() => onEditVideo(v.id)} aria-label={M.aria.editVideo}>✎ 编辑视频</button>
            <button style={BTN_SM} onClick={() => openAdminPreview(v)} aria-label={M.aria.openFrontend}>↗ 前台预览</button>
            {/* CHG-363-A：拆分入口 / 条件 episodeCount > 1（plan §10.2 / 单集视频无拆分语义） */}
            {v.episodeCount > 1 && (
              <button
                style={BTN_SM}
                onClick={() => openSplitWorkspace(v.id)}
                aria-label={M.aria.splitVideo}
                data-testid="pending-center-split-button"
              >
                ✂ 拆分
              </button>
            )}
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
        <LinesPanel
          videoId={v.id}
          selectedKey={selected?.lineKey ?? null}
          onLineSelect={onLineSelect}
          onSourceHealthChanged={onSourceHealthChanged}
        />
      </div>
    </>
  )
}
