/**
 * RecentActivityCard.tsx — Dashboard 第 3 行左：最近操作流（CHG-DESIGN-07 7C）
 *
 * 真源：reference.md §5.1.2 RecentActivityCard mock 蓝图
 *   - head: clock icon + 标题「最近活动」
 *   - 每条 10×14：28×28 radius 6 bg3 + sev 配色 icon → strong who · what (12) + when (11 muted)
 *   - 行间 border-subtle 分隔
 */
import React from 'react'
import { Clock, User, Cog, AlertCircle } from 'lucide-react'
import type { DashboardActivityItem, AttentionSeverity } from '@/lib/dashboard-data'

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--bg-surface-raised)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

const HEAD_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 14px',
  borderBottom: '1px solid var(--border-subtle)',
}

const HEAD_ICON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  width: '20px',
  height: '20px',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--fg-muted)',
  flexShrink: 0,
}

const HEAD_TITLE_STYLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--fg-default)',
  margin: 0,
}

const BODY_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 14px',
}

const ICON_BOX_BASE_STYLE: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '6px',
  background: 'var(--bg-surface)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const META_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  flex: 1,
  minWidth: 0,
}

const TEXT_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--fg-default)',
  margin: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const TEXT_WHO_STYLE: React.CSSProperties = {
  fontWeight: 600,
}

const WHEN_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
  margin: 0,
}

function severityIconColor(severity: AttentionSeverity): string {
  switch (severity) {
    case 'danger': return 'var(--state-error-fg)'
    case 'warn': return 'var(--state-warning-fg)'
    case 'info': return 'var(--state-info-fg)'
  }
}

function actorIcon(who: string, severity: AttentionSeverity) {
  if (who === '系统') {
    return severity === 'danger' ? <AlertCircle size={14} /> : <Cog size={14} />
  }
  return <User size={14} />
}

export interface RecentActivityCardProps {
  readonly items: readonly DashboardActivityItem[]
}

export function RecentActivityCard({ items }: RecentActivityCardProps) {
  return (
    <section style={CARD_STYLE} data-card="recent-activity" aria-label="最近活动">
      <header style={HEAD_STYLE} data-card-head>
        <span aria-hidden="true" style={HEAD_ICON_STYLE}>
          <Clock size={18} />
        </span>
        <h3 style={HEAD_TITLE_STYLE}>最近活动</h3>
      </header>
      <div style={BODY_STYLE} data-card-body>
        {items.map((item, idx) => (
          <div
            key={item.id}
            style={{
              ...ROW_STYLE,
              borderTop: idx === 0 ? 'none' : '1px solid var(--border-subtle)',
            }}
            data-activity-item={item.id}
            data-severity={item.severity}
          >
            <span
              aria-hidden="true"
              style={{ ...ICON_BOX_BASE_STYLE, color: severityIconColor(item.severity) }}
            >
              {actorIcon(item.who, item.severity)}
            </span>
            <div style={META_STYLE}>
              <p style={TEXT_STYLE}>
                <span style={TEXT_WHO_STYLE}>{item.who}</span>
                {' · '}
                {item.what}
              </p>
              <p style={WHEN_STYLE}>{item.when}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

