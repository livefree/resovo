'use client'

/**
 * TabHistory — 审核台 RightPane 审核历史 Tab
 *
 * CHG-SN-4-FIX-C：调 GET /admin/moderation/:id/audit-log 渲染该视频的审计日志时间线。
 *
 * 视觉规约：
 * - 单条时间线 ≤ 36px 行高
 * - 紧凑布局：相对时间 + 操作员 + actionType chip
 * - 失败/空 state 使用 i18n key（不硬编码）
 */
import React from 'react'
import { useReviewHistory } from '@/lib/moderation/use-review-history'
import { M } from '@/i18n/messages/zh-CN/moderation'

export interface TabHistoryProps {
  readonly videoId: string
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '8px 10px',
  borderLeft: '2px solid var(--border-subtle)',
  marginLeft: 4,
  marginBottom: 4,
}

const ROW_HEAD_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
}

const ACTION_CHIP_STYLE: React.CSSProperties = {
  fontSize: 10,
  padding: '1px 6px',
  borderRadius: 999,
  background: 'var(--bg-surface-raised)',
  color: 'var(--fg-muted)',
  fontFamily: 'monospace',
}

const TIME_STYLE: React.CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: 11,
}

const ACTOR_STYLE: React.CSSProperties = {
  color: 'var(--fg-default)',
  fontWeight: 500,
  fontSize: 11,
}

const STATE_STYLE: React.CSSProperties = {
  textAlign: 'center',
  color: 'var(--fg-muted)',
  fontSize: 12,
  padding: '24px 12px',
}

const PAGE_BTN_STYLE: React.CSSProperties = {
  padding: '3px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 11,
}

export function TabHistory({ videoId }: TabHistoryProps): React.ReactElement {
  const [state, actions] = useReviewHistory(videoId)

  if (state.loading && state.events.length === 0) {
    return <div style={STATE_STYLE} data-right-tab="history">{M.history.loading}</div>
  }

  if (state.error) {
    return <div style={{ ...STATE_STYLE, color: 'var(--state-error-fg)' }} data-right-tab="history">{M.history.failed}</div>
  }

  if (state.events.length === 0) {
    return <div style={STATE_STYLE} data-right-tab="history">{M.history.empty}</div>
  }

  const totalPages = Math.max(1, Math.ceil(state.total / state.limit))

  return (
    <div data-right-tab="history">
      {state.events.map((evt) => {
        const actionLabel = M.history.action[evt.actionType] ?? M.history.action.unknown
        return (
          <div key={evt.id} style={ROW_STYLE} data-history-row data-action-type={evt.actionType}>
            <div style={ROW_HEAD_STYLE}>
              <span style={ACTOR_STYLE}>{M.history.actor(evt.actorUsername)}</span>
              <span style={ACTION_CHIP_STYLE}>{actionLabel}</span>
              <span style={{ flex: 1 }} />
              <span style={TIME_STYLE} title={evt.createdAt}>{M.history.relativeTime(evt.createdAt)}</span>
            </div>
          </div>
        )
      })}

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11 }}>
          <button
            style={{ ...PAGE_BTN_STYLE, opacity: state.page === 1 ? 0.5 : 1 }}
            disabled={state.page === 1 || state.loading}
            onClick={() => void actions.loadPage(state.page - 1)}
          >
            {M.history.prevPage}
          </button>
          <span style={{ color: 'var(--fg-muted)' }}>{M.history.pageInfo(state.page, totalPages)}</span>
          <button
            style={{ ...PAGE_BTN_STYLE, opacity: !state.hasNext ? 0.5 : 1 }}
            disabled={!state.hasNext || state.loading}
            onClick={() => void actions.loadPage(state.page + 1)}
          >
            {M.history.nextPage}
          </button>
        </div>
      )}
    </div>
  )
}
