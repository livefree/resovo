'use client'

/**
 * SourceMatrixRow.tsx — 播放线路信号 Pill（CHG-VSR-6 后仅余 `SignalPill`）
 *
 * CHG-VSR-6（2026-06-02 / 设计 §3.6）：删除 `MatrixExpand`——行展开区已改用共享
 * `LinesPanel` + `useSourceLinesController`（见 `SourceLinesExpand.tsx`），消除 render
 * 阶段发请求 / `.slice(0,8)` 截断 / 无 onClick 死按钮。随之成为死代码的
 * `SourceMatrixRow` 主组件（CHG-VSR-5-A 表格化后已无消费方）/ `EpisodeCellBlock` /
 * 矩阵网格常量一并删除。
 *
 * 仅保留 `SignalPill`（`SourceColumns` 的探测/试播列消费 worst 聚合 pill）。
 * 文件名保留不重命名（超出本卡范围）。
 */

import type { DualSignalState } from '@resovo/types'

// ── 聚合 pill ─────────────────────────────────────────────────────

const PILL_VARIANT: Record<DualSignalState, string> = {
  ok:      'ok',
  partial: 'warn',
  dead:    'danger',
  pending: 'default',
}

const PILL_LABEL: Record<DualSignalState, string> = {
  ok:      '全部可达',
  partial: '部分',
  dead:    '全失效',
  pending: '未测',
}

export function SignalPill({ status }: { status: DualSignalState }) {
  const variant = PILL_VARIANT[status]
  const label = PILL_LABEL[status]
  const color = status === 'ok' ? 'var(--state-success-fg)'
    : status === 'partial' ? 'var(--state-warning-fg)'
    : status === 'dead' ? 'var(--state-error-fg)'
    : 'var(--fg-muted)'
  const bg = status === 'ok' ? 'var(--state-success-bg)'
    : status === 'partial' ? 'var(--state-warning-bg)'
    : status === 'dead' ? 'var(--state-error-bg)'
    : 'var(--bg-surface-elevated)'
  const border = status === 'ok' ? 'var(--state-success-border)'
    : status === 'partial' ? 'var(--state-warning-border)'
    : status === 'dead' ? 'var(--state-error-border)'
    : 'var(--border-subtle)'

  return (
    <span
      data-variant={variant}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 500,
        color,
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: color, flexShrink: 0,
      }} />
      {label}
    </span>
  )
}
