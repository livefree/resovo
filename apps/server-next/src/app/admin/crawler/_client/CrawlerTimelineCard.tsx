'use client'

/**
 * CrawlerTimelineCard.tsx — 采集页时间轴卡（站点 × 时间窗 状态可视化）
 *
 * 真源：M-SN-7-redo-01-contract.md §1.2 + reference.md §5.6
 * 数据：GET /admin/crawler/timeline?range=1h&limit=8（REDO-01-B / ADR-122 §3.2）
 *
 * 形态：AdminCard 容器 + card head（标题 + range select 占位 + 暂停按钮 + frozen pill）
 *      body = 时间轴 grid（左 site name 1fr / 右 时间窗 4fr 带 tick 标尺 + 状态 bar）
 *
 * 本卡（REDO-01-C）仅渲染框架 + 行 bar 基础形态；
 * 精细化样式（dot pulse / 状态色细调 / hover tooltip）留给 REDO-01-J 视觉对齐。
 */

import { type CSSProperties } from 'react'
import { AdminButton, AdminCard } from '@resovo/admin-ui'
import type { CrawlerTimelineResponse, CrawlerTimelineRow } from '@/lib/crawler/api'

const HEAD_ACTIONS_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
}

/**
 * 把 ISO 时间字符串格式化为本地 HH:MM（CHG-SN-7-MISC-CRAWLER-TIMELINE-BUG / 用户反馈本地时间）
 * 失败时回退 fallback（避免空字符串）。
 */
function formatLocalHm(iso: string | null | undefined, fallback = '—'): string {
  if (!iso) return fallback
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const PILL_BASE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  borderRadius: 'var(--radius-pill, 12px)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 500,
}

const PILL_OK_STYLE: CSSProperties = {
  ...PILL_BASE_STYLE,
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
}

const PILL_WARN_STYLE: CSSProperties = {
  ...PILL_BASE_STYLE,
  background: 'var(--state-warning-bg)',
  color: 'var(--state-warning-fg)',
}

const TIMELINE_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '180px 1fr',
  rowGap: '6px',
  columnGap: '12px',
  fontSize: 'var(--font-size-xs)',
}

const TICK_ROW_STYLE: CSSProperties = {
  position: 'relative',
  height: '14px',
  color: 'var(--fg-muted)',
  borderBottom: '1px dashed var(--border-subtle)',
}

const TRACK_STYLE: CSSProperties = {
  position: 'relative',
  height: '14px',
  background: 'var(--bg-subtle, var(--bg-surface))',
  borderRadius: '3px',
  overflow: 'hidden',
}

const SITE_LABEL_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
}

const SITE_META_STYLE: CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: '10px',
}

const EMPTY_STYLE: CSSProperties = {
  padding: '24px',
  textAlign: 'center',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const STATUS_COLOR: Record<CrawlerTimelineRow['status'], string> = {
  ok: 'var(--state-success-fg)',
  warn: 'var(--state-warning-fg)',
  danger: 'var(--state-danger-fg, var(--fg-danger))',
}

export interface CrawlerTimelineCardProps {
  readonly timeline: CrawlerTimelineResponse | null
  readonly loading: boolean
  readonly frozen: boolean
  readonly paused: boolean
  readonly onPauseToggle: () => void
}

export function CrawlerTimelineCard({
  timeline,
  loading,
  frozen,
  paused,
  onPauseToggle,
}: CrawlerTimelineCardProps) {
  const ticks = timeline?.ticks ?? []
  const rows = timeline?.rows ?? []

  return (
    <AdminCard
      surface="plain"
      padding="md"
      data-testid="crawler-timeline-card"
      header={{
        title: '采集时间轴',
        subtitle: timeline
          ? `${rows.length} 站点 · ${formatLocalHm(timeline.rangeStart)}–${formatLocalHm(timeline.rangeEnd)}`
          : '加载中…',
        actions: (
          <span style={HEAD_ACTIONS_STYLE}>
            <span
              style={frozen ? PILL_WARN_STYLE : PILL_OK_STYLE}
              data-testid="crawler-timeline-status-pill"
              data-frozen={frozen ? '' : undefined}
            >
              {frozen ? '全局冻结' : '实时'}
            </span>
            <AdminButton
              variant="default"
              size="sm"
              onClick={onPauseToggle}
              data-testid="crawler-timeline-pause-toggle"
            >
              {paused ? '恢复刷新' : '暂停刷新'}
            </AdminButton>
          </span>
        ),
      }}
    >
      {loading && !timeline ? (
        <div style={EMPTY_STYLE} data-testid="crawler-timeline-loading">
          加载时间轴中…
        </div>
      ) : rows.length === 0 ? (
        <div style={EMPTY_STYLE} data-testid="crawler-timeline-empty">
          当前时间窗内无采集活动
        </div>
      ) : (
        <div style={TIMELINE_GRID_STYLE} data-testid="crawler-timeline-grid">
          {/* tick 标尺行 */}
          <div />
          <div style={TICK_ROW_STYLE} data-tick-row>
            {ticks.map((t, idx) => (
              <span
                key={`${t}-${idx}`}
                style={{
                  position: 'absolute',
                  left: `${(idx / Math.max(1, ticks.length - 1)) * 100}%`,
                  transform: 'translateX(-50%)',
                  fontSize: '10px',
                }}
              >
                {formatLocalHm(t, t)}
              </span>
            ))}
          </div>

          {rows.map((row) => (
            <TimelineRow key={row.siteKey} row={row} />
          ))}
        </div>
      )}
    </AdminCard>
  )
}

function TimelineRow({ row }: { readonly row: CrawlerTimelineRow }) {
  const left = Math.max(0, Math.min(1, row.startPct)) * 100
  const width = Math.max(0, Math.min(1, row.widthPct)) * 100
  const color = STATUS_COLOR[row.status]

  return (
    <>
      <div style={SITE_LABEL_STYLE} data-site-key={row.siteKey}>
        <span>{row.siteName}</span>
        <span style={SITE_META_STYLE}>
          {row.videoCount} 视频 · 健康度 {row.health}
        </span>
      </div>
      <div style={TRACK_STYLE} data-track>
        <div
          style={{
            position: 'absolute',
            left: `${left}%`,
            width: `${Math.max(width, 1)}%`,
            top: 2,
            bottom: 2,
            background: color,
            borderRadius: '2px',
          }}
          data-bar-status={row.status}
          aria-label={`${row.siteName} 时长 ${row.durationSeconds}s 状态 ${row.status}`}
        />
      </div>
    </>
  )
}
