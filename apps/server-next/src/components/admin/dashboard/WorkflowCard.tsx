/**
 * WorkflowCard.tsx — Dashboard 第 1 行右：工作流进度（CHG-DESIGN-07 7C）
 *
 * 真源：reference.md §5.1.2 WorkflowCard mock 蓝图
 *   - head: sparkle icon + 标题「工作流进度」+ sub「点击直达，进度可视化」
 *   - body: flex column gap 10，每段 progress（label 12 + 数值 12 (n / total) + 6px bar）
 *   - 4 段 color：采集入库 accent / 待审核 warn / 暂存待发布 info / 已上架 ok
 *   - 底部：grid 1fr 1fr gap 8，sm btn 审核 + sm btn 批量发布
 */
import React from 'react'
import { Sparkles } from 'lucide-react'
import type { DashboardWorkflowSegment } from '@/lib/dashboard-data'

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
  color: 'var(--accent-default)',
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

const BODY_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '14px',
  flex: 1,
}

const SEG_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const SEG_HEAD_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '8px',
}

const SEG_LABEL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--fg-default)',
  margin: 0,
}

const SEG_VALUE_STYLE: React.CSSProperties = {
  fontSize: '12px',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--fg-muted)',
  margin: 0,
}

const SEG_BAR_TRACK_STYLE: React.CSSProperties = {
  height: '6px',
  width: '100%',
  background: 'var(--bg-surface)',
  borderRadius: '999px',
  overflow: 'hidden',
}

const FOOT_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
  padding: '12px 14px',
  borderTop: '1px solid var(--border-subtle)',
}

const FOOT_BTN_BASE_STYLE: React.CSSProperties = {
  height: '28px',
  padding: '0 12px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  font: 'inherit',
  fontSize: '12px',
  cursor: 'pointer',
}

const FOOT_BTN_PRIMARY_STYLE: React.CSSProperties = {
  ...FOOT_BTN_BASE_STYLE,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  border: '1px solid var(--accent-default)',
  fontWeight: 500,
}

export interface WorkflowCardProps {
  readonly segments: readonly [
    DashboardWorkflowSegment,
    DashboardWorkflowSegment,
    DashboardWorkflowSegment,
    DashboardWorkflowSegment,
  ]
  readonly onReview?: () => void
  readonly onBatchPublish?: () => void
}

export function WorkflowCard({ segments, onReview, onBatchPublish }: WorkflowCardProps) {
  return (
    <section style={CARD_STYLE} data-card="workflow" aria-label="工作流进度">
      <header style={HEAD_STYLE} data-card-head>
        <span aria-hidden="true" style={HEAD_ICON_STYLE}>
          <Sparkles size={18} />
        </span>
        <div>
          <h3 style={HEAD_TITLE_STYLE}>工作流进度</h3>
          <p style={HEAD_SUB_STYLE}>点击直达，进度可视化</p>
        </div>
      </header>
      <div style={BODY_STYLE} data-card-body>
        {segments.map((seg) => {
          const pct = seg.total > 0 ? Math.min(100, Math.max(0, (seg.current / seg.total) * 100)) : 0
          const sourceAttr: Record<string, string> = { 'data-source': seg.dataSource }
          return (
            <div key={seg.key} style={SEG_STYLE} data-workflow-segment={seg.key} {...sourceAttr}>
              <div style={SEG_HEAD_STYLE}>
                <p style={SEG_LABEL_STYLE}>{seg.label}</p>
                <p style={SEG_VALUE_STYLE} data-workflow-progress-value>
                  {seg.current} / {seg.total}
                </p>
              </div>
              <div
                style={SEG_BAR_TRACK_STYLE}
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${seg.label}: ${seg.current} / ${seg.total}`}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: seg.color,
                    transition: 'width 200ms ease-out',
                  }}
                  data-workflow-bar-fill
                />
              </div>
            </div>
          )
        })}
      </div>
      <footer style={FOOT_STYLE} data-card-foot>
        <button type="button" style={FOOT_BTN_BASE_STYLE} onClick={onReview} data-workflow-action="review">
          审核
        </button>
        <button type="button" style={FOOT_BTN_PRIMARY_STYLE} onClick={onBatchPublish} data-workflow-action="batch-publish">
          批量发布
        </button>
      </footer>
    </section>
  )
}
