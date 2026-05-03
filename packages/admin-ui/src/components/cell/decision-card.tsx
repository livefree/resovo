'use client'

/**
 * decision-card.tsx — DecisionCard 共享组件实装（CHG-SN-4-04 D-14 第 5 件 · 跨层下沉例外）
 *
 * 真源：decision-card.types.ts（arch-reviewer Opus 2 轮 PASS 契约）+ ADR-106
 *
 * v1.6 patch（CHG-SN-4-FIX-A）：删除 BarSignal 行 + onSignalClick prop —
 *   plan v1.6 §1 G2'：用户判定 "探测/渲染聚合" 与播放器/标题区状态信息重叠；
 *   视频整体信号通过 LinesPanel 头部 + VisChip 表达更直观。probeState/renderState 仍保留，
 *   驱动决策建议 banner 三态。
 *
 * 实装契约（契约一致性硬约束）：
 *   - video Pick 列表 = DecisionCardVideo（id / title / reviewStatus / visibilityStatus /
 *     isPublished / staffNote / reviewLabelKey / sourceCheckStatus / doubanStatus）；
 *     **禁止 ad hoc 接收非 Pick 字段或拓宽为 Partial<VideoQueueRow>**（Opus 观察项硬约束）
 *   - 视觉骨架（v1.6）：header slot → 标题 → 决策建议条（ok/warn/danger 三态）→
 *     StaffNoteBar（仅 staffNote 非空 + onStaffNoteEdit 已传时渲染）→ actions slot
 *   - 决策建议三态推算（基于 probeState + renderState）：
 *     · 'dead' + 'dead'                         → danger（全线路失效——建议拒绝）
 *     · probeState !== renderState（信号冲突）  → warn（信号冲突，建议核查）
 *     · 任一含 'partial'                          → warn（部分失效，建议核查）
 *     · 任一含 'pending' / 'unknown'              → warn（信号未就绪，建议等待 worker）
 *     · 其余（ok/ok）                              → ok（信号健康，可通过）
 *   - 颜色仅消费 design-tokens；零硬编码
 *   - 业务概念零泄漏：actions / header 全经 ReactNode slot 注入
 *
 * 固定 data attribute：
 *   - data-decision-card 挂在根 div + data-decision-card-tone="ok|warn|danger"
 *   - data-decision-card-banner 挂在决策建议条
 *   - data-decision-card-actions / data-decision-card-header 挂在对应 slot
 *   - testId 渲染为 data-testid
 */
import React, { forwardRef } from 'react'
import type { DualSignalDisplayState } from '@resovo/types'
import { StaffNoteBar } from '../feedback/staff-note-bar'
import type { DecisionCardProps } from './decision-card.types'

type Tone = 'ok' | 'warn' | 'danger'

interface DecisionResult {
  readonly tone: Tone
  readonly icon: string
  readonly text: string
}

function decideTone(
  probe: DualSignalDisplayState,
  render: DualSignalDisplayState,
): DecisionResult {
  if (probe === 'dead' && render === 'dead') {
    return { tone: 'danger', icon: '✕', text: '全线路失效——建议拒绝' }
  }
  if (probe === 'pending' || render === 'pending' || probe === 'unknown' || render === 'unknown') {
    return { tone: 'warn', icon: '⏳', text: '信号未就绪，建议等待 worker 验证' }
  }
  if (probe !== render) {
    return { tone: 'warn', icon: '⚠', text: '信号冲突，建议仔细核查后决策' }
  }
  if (probe === 'partial') {
    return { tone: 'warn', icon: '⚠', text: '部分线路失效，建议核查' }
  }
  return { tone: 'ok', icon: '✓', text: '信号健康，可通过' }
}

interface ToneStyle {
  readonly background: string
  readonly border: string
  readonly color: string
}

const TONE_STYLES: Record<Tone, ToneStyle> = {
  ok: {
    background: 'var(--state-success-bg)',
    border: 'var(--state-success-border)',
    color: 'var(--state-success-fg)',
  },
  warn: {
    background: 'var(--state-warning-bg)',
    border: 'var(--state-warning-border)',
    color: 'var(--state-warning-fg)',
  },
  danger: {
    background: 'var(--state-error-bg)',
    border: 'var(--state-error-border)',
    color: 'var(--state-error-fg)',
  },
}

const ROOT_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--fg-default)',
  lineHeight: 1.4,
  wordBreak: 'break-word',
}

function bannerStyle(tone: Tone): React.CSSProperties {
  const palette = TONE_STYLES[tone]
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: palette.border,
    background: palette.background,
    color: palette.color,
    fontSize: '13px',
    fontWeight: 600,
    lineHeight: 1.4,
  }
}

const BANNER_ICON_STYLE: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: 1,
}

type Ref = HTMLDivElement

export const DecisionCard = forwardRef<Ref, DecisionCardProps>(function DecisionCard(
  {
    video,
    probeState,
    renderState,
    actions,
    header,
    onStaffNoteEdit,
    testId,
  },
  ref,
) {
  const decision = decideTone(probeState, renderState)
  const showStaffNote = !!(video.staffNote && video.staffNote.trim())

  return (
    <div
      ref={ref}
      data-decision-card
      data-decision-card-tone={decision.tone}
      data-testid={testId}
      style={ROOT_STYLE}
    >
      {header && (
        <div data-decision-card-header>
          {header}
        </div>
      )}

      <h3 data-decision-card-title style={TITLE_STYLE}>{video.title}</h3>

      <div data-decision-card-banner style={bannerStyle(decision.tone)}>
        <span data-decision-card-icon style={BANNER_ICON_STYLE}>{decision.icon}</span>
        <span data-decision-card-text>{decision.text}</span>
      </div>

      {showStaffNote && onStaffNoteEdit && (
        <StaffNoteBar
          note={video.staffNote}
          onEdit={onStaffNoteEdit}
        />
      )}

      {actions && (
        <div data-decision-card-actions>
          {actions}
        </div>
      )}
    </div>
  )
})
