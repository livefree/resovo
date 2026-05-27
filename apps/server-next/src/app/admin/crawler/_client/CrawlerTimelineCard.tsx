'use client'

/**
 * CrawlerTimelineCard.tsx — 采集页时间轴卡（站点 × 时间窗 状态可视化）
 *
 * 真源：M-SN-7-redo-01-contract.md §1.2 + reference.md §5.6
 * 数据：GET /admin/crawler/timeline?range=1h&limit=8（REDO-01-B / ADR-122 §3.2）
 *
 * ADR-153 改动（CW2-B-EP）：
 *   - status 4 态：ok / warn / danger / neutral
 *   - multi-lane 渲染：同站多 bar 绝对定位，BAR_H=6px / LANE_GAP=2px
 *   - TRACK_STYLE.height 14→24
 *   - range 自治：Card 内 useState + useEffect，不再依赖父层轮询
 *   - Props：timeline 降级为可选 fallbackData；新增 defaultRange?；移除 loading
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { AdminButton, AdminCard, AdminSelect } from '@resovo/admin-ui'
import type { CrawlerTimelineResponse, CrawlerTimelineRow } from '@/lib/crawler/api'
import { getCrawlerTimeline, type CrawlerTimelineRange } from '@/lib/crawler/api'

const HEAD_ACTIONS_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
}

/**
 * 把 ISO 时间字符串格式化为本地 HH:MM（ADR-153 D-153-5 确认正确架构）
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
  // CHG-SN-9-CW1-CW2-HOTFIX-A Step 4：actions 容器宽紧张时防止中文字符 break 成两行
  whiteSpace: 'nowrap',
  flexShrink: 0,
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
  // ADR-155 D-155-3 / EP-3b-1：相对定位容器 / now-line overlay 绝对定位锚点
  position: 'relative',
}

// ADR-155 D-155-3 / EP-3b-1：now-line overlay 覆盖右侧 1fr track column（跳过 180px label + 12px gap）
const NOW_LINE_OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 'calc(180px + 12px)',
  right: 0,
  pointerEvents: 'none',
}

const TICK_ROW_STYLE: CSSProperties = {
  position: 'relative',
  height: '14px',
  color: 'var(--fg-muted)',
  borderBottom: '1px dashed var(--border-subtle)',
}

/** ADR-153 D-153-1：rowHeight 14→24 */
const TRACK_STYLE: CSSProperties = {
  position: 'relative',
  height: '24px',
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

/** ADR-153 D-153-2：status 4 态颜色（neutral = --fg-muted） */
const STATUS_COLOR: Record<CrawlerTimelineRow['status'], string> = {
  ok: 'var(--state-success-fg)',
  warn: 'var(--state-warning-fg)',
  danger: 'var(--state-danger-fg, var(--fg-danger))',
  neutral: 'var(--fg-muted)',
}

/** ADR-153 D-153-1：bar 高度 + lane 间距命名常量 */
const BAR_H = 6
const LANE_GAP = 2

// ADR-155 D-155-3 / EP-3b-1：range 选项扩展 4 → 7（加 12h/24h/7d 长历史回看）
const RANGE_OPTIONS = [
  { value: '30m', label: '30 分钟' },
  { value: '1h',  label: '1 小时' },
  { value: '2h',  label: '2 小时' },
  { value: '6h',  label: '6 小时' },
  { value: '12h', label: '12 小时' },
  { value: '24h', label: '24 小时' },
  { value: '7d',  label: '7 天' },
] as const

// ADR-155 D-155-3 / EP-3b-1：now-line 位置（与 EP-3a 后端 HISTORY_RATIO=0.7 对齐）
const NOW_LINE_LEFT_PCT = 70

const NOW_LINE_STYLE: CSSProperties = {
  position: 'absolute',
  left: `${NOW_LINE_LEFT_PCT}%`,
  top: 0,
  bottom: 0,
  width: '1px',
  background: 'var(--accent-default)',
  pointerEvents: 'none',  // 不阻塞 hover / drag
  zIndex: 2,  // 高于 bar 但不挡 tooltip
}

const NOW_LABEL_STYLE: CSSProperties = {
  position: 'absolute',
  left: `${NOW_LINE_LEFT_PCT}%`,
  transform: 'translateX(-50%)',
  top: 0,
  fontSize: '10px',
  color: 'var(--accent-default)',
  background: 'var(--bg-surface)',
  padding: '0 4px',
  fontWeight: 600,
  pointerEvents: 'none',
  zIndex: 3,
}

// ADR-155 D-155-4：站点 limit 解锁（"全部" = 后端 safeLimit 50 上限）
const LIMIT_OPTIONS = [
  { value: '8',  label: '8 站' },
  { value: '20', label: '20 站' },
  { value: '50', label: '全部' },
] as const

const DEFAULT_LIMIT = 8

export interface CrawlerTimelineCardProps {
  /** ADR-153 D-153-3：降级为可选 fallbackData（SWR 语义；Card 内部自治拉取） */
  readonly fallbackData?: CrawlerTimelineResponse | null
  /** @deprecated 兼容旧调用方，等同 fallbackData */
  readonly timeline?: CrawlerTimelineResponse | null
  readonly frozen: boolean
  readonly paused: boolean
  readonly onPauseToggle: () => void
  /** 默认时间范围，省略则用 '1h' */
  readonly defaultRange?: CrawlerTimelineRange
}

export function CrawlerTimelineCard({
  fallbackData,
  timeline,
  frozen,
  paused,
  onPauseToggle,
  defaultRange,
}: CrawlerTimelineCardProps) {
  // ── range 自治 state（ADR-153 D-153-3）─────────────────────────
  const [range, setRange] = useState<CrawlerTimelineRange>(defaultRange ?? '1h')
  // ADR-155 D-155-4：limit 自治 state（站点上限 8/20/全部=50）
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT)
  const [timelineData, setTimelineData] = useState<CrawlerTimelineResponse | null>(
    fallbackData ?? timeline ?? null,
  )
  const [timelineLoading, setTimelineLoading] = useState(false)

  // ── range / limit 变化时重新拉取 ─────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setTimelineLoading(true)
    getCrawlerTimeline({ range, limit })
      .then((data) => { if (!cancelled) setTimelineData(data) })
      .catch(() => { /* silent：时间轴是软实时数据，失败不打扰用户 */ })
      .finally(() => { if (!cancelled) setTimelineLoading(false) })
    return () => { cancelled = true }
  }, [range, limit])

  // ── 自动刷新（5s；frozen / paused 时跳过）────────────────────────
  useEffect(() => {
    if (paused || frozen) return
    const tick = window.setInterval(() => {
      getCrawlerTimeline({ range, limit })
        .then((data) => setTimelineData(data))
        .catch(() => { /* silent */ })
    }, 5_000)
    return () => window.clearInterval(tick)
  }, [range, limit, paused, frozen])

  const handleRangeChange = useCallback((next: string | null) => {
    // ADR-155 D-155-3 / EP-3b-1：range 7 选项白名单
    const validRanges: readonly CrawlerTimelineRange[] = ['30m', '1h', '2h', '6h', '12h', '24h', '7d']
    if (next !== null && (validRanges as readonly string[]).includes(next)) {
      setRange(next as CrawlerTimelineRange)
    }
  }, [])

  // ADR-155 D-155-4：limit select 切换
  const handleLimitChange = useCallback((next: string | null) => {
    const n = Number(next)
    if (Number.isFinite(n) && (n === 8 || n === 20 || n === 50)) {
      setLimit(n)
    }
  }, [])

  const ticks = timelineData?.ticks ?? []
  const rows = timelineData?.rows ?? []

  // ── group rows by siteKey（保持 SQL 排序，不重排）────────────────
  const siteOrder: string[] = []
  const rowsBySite = new Map<string, CrawlerTimelineRow[]>()
  for (const row of rows) {
    if (!rowsBySite.has(row.siteKey)) {
      siteOrder.push(row.siteKey)
      rowsBySite.set(row.siteKey, [])
    }
    rowsBySite.get(row.siteKey)!.push(row)
  }

  return (
    <AdminCard
      surface="plain"
      padding="md"
      data-testid="crawler-timeline-card"
      header={{
        title: '采集时间轴',
        subtitle: timelineData
          ? `${siteOrder.length} 站点 · ${formatLocalHm(timelineData.rangeStart)}–${formatLocalHm(timelineData.rangeEnd)}`
          : '加载中…',
        actions: (
          <span style={HEAD_ACTIONS_STYLE}>
            <AdminSelect
              options={RANGE_OPTIONS as unknown as { value: string; label: string }[]}
              value={range}
              onChange={handleRangeChange}
              size="sm"
              aria-label="选择时间范围"
              data-testid="crawler-timeline-range-select"
            />
            {/* ADR-155 D-155-4：站点 limit 解锁 select（8/20/全部=50） */}
            <AdminSelect
              options={LIMIT_OPTIONS as unknown as { value: string; label: string }[]}
              value={String(limit)}
              onChange={handleLimitChange}
              size="sm"
              aria-label="站数上限"
              data-testid="crawler-timeline-limit-select"
            />
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
      {timelineLoading && !timelineData ? (
        <div style={EMPTY_STYLE} data-testid="crawler-timeline-loading">
          加载时间轴中…
        </div>
      ) : siteOrder.length === 0 ? (
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

          {siteOrder.map((siteKey) => {
            const siteBars = rowsBySite.get(siteKey)!
            const primaryRow = siteBars[0]
            return (
              <SiteTimelineRow
                key={siteKey}
                primaryRow={primaryRow}
                bars={siteBars}
              />
            )
          })}
          {/* ADR-155 D-155-3 / EP-3b-1：now-line overlay 标识 NOW 位置在 70% 处（三段窗历史:未来=70:30） */}
          <div style={NOW_LINE_OVERLAY_STYLE} data-testid="crawler-timeline-now-overlay">
            <div style={NOW_LINE_STYLE} data-testid="crawler-timeline-now-line" data-now-line />
            <span style={NOW_LABEL_STYLE} data-testid="crawler-timeline-now-label">现在</span>
          </div>
        </div>
      )}
    </AdminCard>
  )
}

/**
 * SiteTimelineRow — 单站点行（1 个 label + 1 个 TRACK 容器，内含多 bar 绝对定位）
 * ADR-153 D-153-1 §6：各 bar top = laneIdx * (BAR_H + LANE_GAP)px
 */
function SiteTimelineRow({
  primaryRow,
  bars,
}: {
  readonly primaryRow: CrawlerTimelineRow
  readonly bars: readonly CrawlerTimelineRow[]
}) {
  return (
    <>
      <div style={SITE_LABEL_STYLE} data-site-key={primaryRow.siteKey}>
        <span>{primaryRow.siteName}</span>
        <span style={SITE_META_STYLE}>
          {primaryRow.videoCount} 视频 · 健康度 {primaryRow.health}
        </span>
      </div>
      <div style={TRACK_STYLE} data-track data-site-key={primaryRow.siteKey}>
        {bars.map((bar, laneIdx) => {
          const left = Math.max(0, Math.min(1, bar.startPct)) * 100
          const width = Math.max(0, Math.min(1, bar.widthPct)) * 100
          const color = STATUS_COLOR[bar.status]
          const top = laneIdx * (BAR_H + LANE_GAP)
          // ADR-155 D-155-3 / EP-3b-1：pending (status='warn') bar 用虚线 + 半透明区分
          //   - 已发生 (ok/danger/neutral)：实色填充
          //   - 未来 / pending (warn)：虚线边框 + 透明背景 + 半透明 + accent border
          const isPending = bar.status === 'warn'

          return (
            <div
              key={`${bar.siteKey}-${laneIdx}`}
              style={{
                position: 'absolute',
                left: `${left}%`,
                width: `${Math.max(width, 1)}%`,
                top,
                height: BAR_H,
                background: isPending ? 'transparent' : color,
                border: isPending ? `1px dashed ${color}` : 'none',
                opacity: isPending ? 0.7 : 1,
                borderRadius: '2px',
                boxSizing: 'border-box',
              }}
              data-bar-status={bar.status}
              data-bar-pending={isPending ? '' : undefined}
              data-bar-lane={laneIdx}
              aria-label={`${bar.siteName} 时长 ${bar.durationSeconds}s 状态 ${bar.status}`}
            />
          )
        })}
      </div>
    </>
  )
}
