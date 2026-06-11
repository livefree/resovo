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
 * v1.7 patch（MODUX-P1-2 / SEQ-20260610-03）：① 删除标题 h3 渲染行——与消费方
 *   （PendingCenter h2）标题重复（item 12）；video.title 仍保留于 Pick 契约不动 types.ts。
 *   ② 决策建议条从独占整行 banner 降为 inline chip（alignSelf flex-start，不占满行宽，
 *   item 11）；文案精简（行动指引以 · 短后缀承载）。data-decision-card-banner 钩子不变。
 *
 * 实装契约（契约一致性硬约束）：
 *   - video Pick 列表 = DecisionCardVideo（id / title / reviewStatus / visibilityStatus /
 *     isPublished / staffNote / reviewLabelKey / sourceCheckStatus / doubanStatus）；
 *     **禁止 ad hoc 接收非 Pick 字段或拓宽为 Partial<VideoQueueRow>**（Opus 观察项硬约束）
 *   - 视觉骨架（v1.7）：header slot → 决策建议 chip（ok/warn/danger 三态，inline 不独占行）→
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
    return { tone: 'danger', icon: '✕', text: '全线路失效 · 建议拒绝' }
  }
  if (probe === 'pending' || render === 'pending' || probe === 'unknown' || render === 'unknown') {
    return { tone: 'warn', icon: '⏳', text: '信号未就绪 · 等待验证' }
  }
  if (probe !== render) {
    return { tone: 'warn', icon: '⚠', text: '信号冲突 · 需核查' }
  }
  if (probe === 'partial') {
    return { tone: 'warn', icon: '⚠', text: '部分线路失效 · 需核查' }
  }
  return { tone: 'ok', icon: '✓', text: '信号健康' }
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

// v1.7：inline chip（不独占整行）—— alignSelf flex-start 收缩到内容宽
function bannerStyle(tone: Tone): React.CSSProperties {
  const palette = TONE_STYLES[tone]
  return {
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: '6px',
    padding: '3px 10px',
    borderRadius: '999px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: palette.border,
    background: palette.background,
    color: palette.color,
    fontSize: 'var(--font-size-xs)',
    fontWeight: 500,
    lineHeight: 1.4,
  }
}

const BANNER_ICON_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
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
