'use client'

/**
 * dual-signal.tsx — DualSignal 共享组件实装（CHG-DESIGN-12 12B）
 *
 * 真源：dual-signal.types.ts（12A Opus PASS 契约）
 *
 * 实装契约（12A 一致性硬约束）：
 *   - 复用 Pill 渲染（每行一个 Pill 实例）；不重新实现 pill 视觉
 *   - DualSignalState (ok/partial/dead/unknown) → Pill variant + 状态标签 文案
 *   - probe pill: variant='probe' + dot 颜色按状态映射（ok/warn/danger/muted）
 *   - render pill: variant='render' + 同上
 *   - 垂直堆叠 column flex / gap 3px
 *   - 每个 pill min-width 62px（设计稿对齐）
 *
 * 固定 data attribute：data-dual-signal + 内部 [data-dual-signal-row="probe|render"]
 */
import React from 'react'
import type { DualSignalProps, DualSignalState } from './dual-signal.types'

interface StateMap {
  readonly label: string
  readonly dotColor: string
}

function stateMap(state: DualSignalState): StateMap {
  switch (state) {
    case 'ok':       return { label: '可用',  dotColor: 'var(--state-success-fg)' }
    case 'partial':  return { label: '部分',  dotColor: 'var(--state-warning-fg)' }
    case 'dead':     return { label: '失效',  dotColor: 'var(--state-error-fg)' }
    case 'unknown':
    default:
      return { label: '未测', dotColor: 'var(--fg-muted)' }
  }
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
    fontSize: '11px',
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

const TAG_STYLE: React.CSSProperties = {
  fontWeight: 600,
}

const STATUS_LABEL_STYLE: React.CSSProperties = {
  color: 'var(--fg-muted)',
}

export function DualSignal({
  probe,
  render,
  minPillWidth = 62,
  testId,
}: DualSignalProps): React.ReactElement {
  const probeMap = stateMap(probe)
  const renderMap = stateMap(render)

  return (
    <span
      data-dual-signal
      data-testid={testId}
      role="group"
      aria-label="探测/播放双信号"
      style={ROOT_STYLE}
    >
      <span
        data-dual-signal-row="probe"
        data-state={probe}
        role="status"
        aria-label={`链接探测：${probeMap.label}`}
        title={`链接探测：${probeMap.label}`}
        style={{
          ...rowStyle(minPillWidth),
          background: 'var(--dual-signal-probe-soft)',
        }}
      >
        <span aria-hidden="true" style={{ ...DOT_STYLE, background: probeMap.dotColor }} />
        <span style={{ ...TAG_STYLE, color: 'var(--dual-signal-probe)' }}>探</span>
        <span style={STATUS_LABEL_STYLE}>{probeMap.label}</span>
      </span>
      <span
        data-dual-signal-row="render"
        data-state={render}
        role="status"
        aria-label={`实际播放：${renderMap.label}`}
        title={`实际播放：${renderMap.label}`}
        style={{
          ...rowStyle(minPillWidth),
          background: 'var(--dual-signal-render-soft)',
        }}
      >
        <span aria-hidden="true" style={{ ...DOT_STYLE, background: renderMap.dotColor }} />
        <span style={{ ...TAG_STYLE, color: 'var(--dual-signal-render)' }}>播</span>
        <span style={STATUS_LABEL_STYLE}>{renderMap.label}</span>
      </span>
    </span>
  )
}
