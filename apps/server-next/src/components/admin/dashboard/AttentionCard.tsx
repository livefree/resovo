/**
 * AttentionCard.tsx — Dashboard 第 1 行左：异常列表（CHG-DESIGN-07 7C）
 *
 * 真源：reference.md §5.1.2 AttentionCard mock 蓝图
 *   - head: warn icon + 标题「需要关注」+ sub「按优先级排序的当前异常」+ 右侧 xs btn「全部解决」
 *   - body padding 0；每条 12×16 高，从第二条起 border-top: 1px solid var(--border-subtle)
 *   - 单条：sev icon + (title 13/600 + meta 11 muted) + xs btn
 */
import React from 'react'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import type { DashboardAttentionItem, AttentionSeverity } from '@/lib/dashboard-data'

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
  color: 'var(--state-warning-fg)',
  flexShrink: 0,
}

const HEAD_TITLE_STYLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--fg-default)',
  margin: 0,
}

const HEAD_SUB_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
  margin: 0,
}

const HEAD_ACTION_STYLE: React.CSSProperties = {
  marginLeft: 'auto',
  height: '24px',
  padding: '0 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-muted)',
  font: 'inherit',
  fontSize: '11px',
  cursor: 'pointer',
  flexShrink: 0,
}

const BODY_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  // body padding 0：每条自带 padding（reference §5.1.2）
}

const ROW_BASE_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '12px 16px',
}

const SEV_ICON_BASE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  width: '20px',
  height: '20px',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const ROW_META_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  flex: 1,
  minWidth: 0,
}

const ROW_TITLE_STYLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--fg-default)',
  margin: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const ROW_META_TEXT_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
  margin: 0,
}

const ROW_ACTION_STYLE: React.CSSProperties = {
  height: '22px',
  padding: '0 8px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-muted)',
  font: 'inherit',
  fontSize: '11px',
  cursor: 'pointer',
  flexShrink: 0,
}

function severityIconColor(severity: AttentionSeverity): string {
  switch (severity) {
    case 'danger': return 'var(--state-error-fg)'
    case 'warn': return 'var(--state-warning-fg)'
    case 'info': return 'var(--state-info-fg)'
  }
}

function SeverityIcon({ severity }: { severity: AttentionSeverity }) {
  const Icon = severity === 'danger' ? AlertCircle : severity === 'warn' ? AlertTriangle : Info
  return (
    <span aria-hidden="true" style={{ ...SEV_ICON_BASE_STYLE, color: severityIconColor(severity) }}>
      <Icon size={16} />
    </span>
  )
}

export interface AttentionCardProps {
  readonly items: readonly DashboardAttentionItem[]
}

export function AttentionCard({ items }: AttentionCardProps) {
  return (
    <section style={CARD_STYLE} data-card="attention" aria-label="需要关注">
      <header style={HEAD_STYLE} data-card-head>
        <span aria-hidden="true" style={HEAD_ICON_STYLE}>
          <AlertTriangle size={18} />
        </span>
        <div>
          <h3 style={HEAD_TITLE_STYLE}>需要关注</h3>
          <p style={HEAD_SUB_STYLE}>按优先级排序的当前异常</p>
        </div>
        <button type="button" style={HEAD_ACTION_STYLE} data-card-action="resolve-all">
          全部解决
        </button>
      </header>
      <div style={BODY_STYLE} data-card-body>
        {items.map((item, idx) => (
          <div
            key={item.id}
            style={{
              ...ROW_BASE_STYLE,
              borderTop: idx === 0 ? 'none' : '1px solid var(--border-subtle)',
            }}
            data-attention-item={item.id}
            data-severity={item.severity}
          >
            <SeverityIcon severity={item.severity} />
            <div style={ROW_META_STYLE}>
              <p style={ROW_TITLE_STYLE}>{item.title}</p>
              <p style={ROW_META_TEXT_STYLE}>{item.meta}</p>
            </div>
            <button type="button" style={ROW_ACTION_STYLE} data-attention-action="open">
              查看
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
