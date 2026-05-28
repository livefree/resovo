'use client'

/**
 * BatchActionsBar.tsx — 审核台批量操作底栏（CHG-348 / SPLIT-B）
 *
 * 来源：CHG-SN-8-GAPS-MOD-BATCH bulk action bar（原 ModerationConsole.tsx fixed-bottom JSX 抽出）
 *
 * 视觉零变化：rem/spacing/border/shadow 与原内嵌实现完全等同。
 *
 * Props 极简：
 *   - selectedCount: 已选条数（影响按钮 label 显示 "(N)"）
 *   - onApprove / onReject / onClear: 三个交互回调
 *   - pending: 批量通过中（按钮 disabled + label "处理中…"）
 */

import React from 'react'

const BTN_SM: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-row)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xs)',
}

const BTN_PRIMARY: React.CSSProperties = {
  ...BTN_SM,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  borderColor: 'var(--accent-default)',
}

const BAR_STYLE: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: 12,
  padding: '12px 16px',
  background: 'var(--bg-surface-elevated)',
  borderTop: '2px solid var(--accent-default)',
  boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
  zIndex: 50,
}

const COUNT_STYLE: React.CSSProperties = {
  alignSelf: 'center',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

const APPROVE_BTN_STYLE: React.CSSProperties = {
  ...BTN_PRIMARY,
  fontSize: 'var(--font-size-sm-tight)',
}

const REJECT_BTN_STYLE: React.CSSProperties = {
  ...BTN_SM,
  color: 'var(--state-danger-fg)',
  borderColor: 'var(--state-danger-border)',
  fontSize: 'var(--font-size-sm-tight)',
}

const CLEAR_BTN_STYLE: React.CSSProperties = {
  ...BTN_SM,
  fontSize: 'var(--font-size-sm-tight)',
}

export interface BatchActionsBarProps {
  readonly selectedCount: number
  readonly onApprove: () => void
  readonly onReject: () => void
  readonly onClear: () => void
  readonly pending: boolean
  /** CHG-364-A：批量合并按钮回调 / 条件 selectedCount >= 2 才显示（merge 协议至少 1 source + 1 target） */
  readonly onMerge?: () => void
}

export function BatchActionsBar({
  selectedCount,
  onApprove,
  onReject,
  onClear,
  pending,
  onMerge,
}: BatchActionsBarProps): React.ReactElement {
  return (
    <div style={BAR_STYLE} data-testid="moderation-batch-bar">
      <span style={COUNT_STYLE}>已选 {selectedCount} 条</span>
      <button
        type="button"
        style={APPROVE_BTN_STYLE}
        disabled={pending}
        onClick={onApprove}
        data-testid="moderation-batch-approve"
      >
        {pending ? '处理中…' : `✓ 批量通过 (${selectedCount})`}
      </button>
      <button
        type="button"
        style={REJECT_BTN_STYLE}
        disabled={pending}
        onClick={onReject}
        data-testid="moderation-batch-reject"
      >
        ✕ 批量拒绝 ({selectedCount})
      </button>
      {/* CHG-364-A：合并入口 / 至少 2 条才有合并语义（ADR-105 MergeSchema sourceVideoIds + targetVideoId） */}
      {onMerge && selectedCount >= 2 && (
        <button
          type="button"
          style={CLEAR_BTN_STYLE}
          onClick={onMerge}
          data-testid="moderation-batch-merge"
        >
          ↔ 合并 ({selectedCount})
        </button>
      )}
      <button
        type="button"
        style={CLEAR_BTN_STYLE}
        onClick={onClear}
        data-testid="moderation-batch-clear"
      >
        清除选择
      </button>
    </div>
  )
}
