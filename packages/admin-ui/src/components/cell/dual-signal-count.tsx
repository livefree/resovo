'use client'

/**
 * dual-signal-count.tsx — DualSignalCount 共享组件实装（CHG-360-A / ADR-159）
 *
 * 真源：dual-signal-count.types.ts（arch-reviewer Opus PASS 契约）
 *
 * 实装契约：
 *   - 与 DualSignal 视觉对齐（rowStyle 复用 / 同 token / 同 min-width）
 *   - 状态来源 DualSignalAggregate.state（4 值复用 SourceCheckStatus）
 *   - 文本显示 X/Y zero-pad 2 位（如 "02/03" / 与用户原话示例一致）
 *   - total=0 → "—" + 灰色 pending
 *   - a11y aria-label 显式语义："链接探测：3 条中 2 条可用"（不能只读 "2/3"）
 */
import React from 'react'
import type { DualSignalAggregate } from '@resovo/types'
import type { DualSignalCountProps } from './dual-signal-count.types'

interface StateMap {
  readonly dotColor: string
  readonly tone: 'ok' | 'partial' | 'all_dead' | 'pending'
}

function stateMap(state: DualSignalAggregate['state']): StateMap {
  switch (state) {
    case 'ok':       return { dotColor: 'var(--state-success-fg)', tone: 'ok' }
    case 'partial':  return { dotColor: 'var(--state-warning-fg)', tone: 'partial' }
    case 'all_dead': return { dotColor: 'var(--state-error-fg)', tone: 'all_dead' }
    case 'pending':
    default:
      return { dotColor: 'var(--fg-muted)', tone: 'pending' }
  }
}

/** Y4 格式：zero-pad 到与 total 同位数（最少 2 位）— "02/03" / "12/15" */
function formatXY(agg: DualSignalAggregate): string {
  if (agg.total === 0) return '—'
  const padLen = Math.max(2, String(agg.total).length)
  const x = String(agg.ok).padStart(padLen, '0')
  const y = String(agg.total).padStart(padLen, '0')
  return `${x}/${y}`
}

/** a11y aria-label：显式中文语义，不能只读数字 / 主动 axis 区分线路 vs 集 */
function ariaLabelFor(axis: 'probe' | 'render', agg: DualSignalAggregate): string {
  const axisName = axis === 'probe' ? '链接探测' : '实际播放'
  if (agg.total === 0) return `${axisName}：暂无数据`
  if (agg.state === 'ok') return `${axisName}：${agg.total} 项均可用`
  if (agg.state === 'all_dead') return `${axisName}：${agg.total} 项均失效`
  if (agg.state === 'partial') return `${axisName}：${agg.total} 项中 ${agg.ok} 项可用`
  return `${axisName}：${agg.total} 项待测`
}

const ROOT_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  gap: '3px',
  alignItems: 'flex-start',
}

function rowStyle(minPillWidth: number): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '1px 7px',
    fontSize: 'var(--font-size-xxs)',
    fontWeight: 500,
    borderRadius: 'var(--radius-full)',
    whiteSpace: 'nowrap',
    lineHeight: 1.4,
    minWidth: `${minPillWidth}px`,
    boxSizing: 'border-box',
  }
}

const DOT_STYLE: React.CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  flexShrink: 0,
  display: 'inline-block',
}

const TAG_STYLE: React.CSSProperties = { fontWeight: 600 }
const COUNT_STYLE: React.CSSProperties = { color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }

export function DualSignalCount({
  probe,
  render,
  minPillWidth = 62,
  testId,
}: DualSignalCountProps): React.ReactElement {
  const probeMap = stateMap(probe.state)
  const renderMap = stateMap(render.state)
  const probeText = formatXY(probe)
  const renderText = formatXY(render)

  return (
    <span
      data-dual-signal-count
      data-testid={testId}
      role="group"
      aria-label="探测/播放聚合信号"
      style={ROOT_STYLE}
    >
      <span
        data-dual-signal-count-row="probe"
        data-state={probe.state}
        data-tone={probeMap.tone}
        role="status"
        aria-label={ariaLabelFor('probe', probe)}
        title={ariaLabelFor('probe', probe)}
        style={{
          ...rowStyle(minPillWidth),
          background: 'var(--dual-signal-probe-soft)',
        }}
      >
        <span aria-hidden="true" style={{ ...DOT_STYLE, background: probeMap.dotColor }} />
        <span style={{ ...TAG_STYLE, color: 'var(--dual-signal-probe)' }}>探</span>
        <span style={COUNT_STYLE}>{probeText}</span>
      </span>
      <span
        data-dual-signal-count-row="render"
        data-state={render.state}
        data-tone={renderMap.tone}
        role="status"
        aria-label={ariaLabelFor('render', render)}
        title={ariaLabelFor('render', render)}
        style={{
          ...rowStyle(minPillWidth),
          background: 'var(--dual-signal-render-soft)',
        }}
      >
        <span aria-hidden="true" style={{ ...DOT_STYLE, background: renderMap.dotColor }} />
        <span style={{ ...TAG_STYLE, color: 'var(--dual-signal-render)' }}>播</span>
        <span style={COUNT_STYLE}>{renderText}</span>
      </span>
    </span>
  )
}
