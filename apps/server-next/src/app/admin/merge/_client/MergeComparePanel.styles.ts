/**
 * MergeComparePanel.styles.ts — 对比矩阵样式常量（CHG-VIR-17-PARTIAL 自主文件拆出，500 行硬限）
 *
 * 消费方：MergeComparePanel（主矩阵）+ CompareLinesRow（线路 · 播放行）。
 * CSS 变量零硬编码颜色（column-matrix-menu.styles.ts 同范式）。
 */

import type { CSSProperties } from 'react'

export const WRAP_STYLE: CSSProperties = {
  overflowX: 'auto',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
}

/** 字段名列固定宽（colgroup） */
export const FIELD_COL_WIDTH = 110
/** 视频列等宽下限（N 大时撑出横向滚动） */
export const VIDEO_COL_MIN_WIDTH = 200

/** 字段名首列 sticky（§10.4） */
export const FIELD_CELL_STYLE: CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  background: 'var(--bg-surface)',
  padding: '6px 10px',
  textAlign: 'left',
  color: 'var(--fg-muted)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  borderRight: '1px solid var(--border-subtle)',
  borderBottom: '1px solid var(--border-subtle)',
}

export const VIDEO_CELL_STYLE: CSSProperties = {
  padding: '6px 12px',
  verticalAlign: 'top',
  borderBottom: '1px solid var(--border-subtle)',
  // UX-B ⑤ 等宽（tableLayout fixed）下长内容换行不撑列
  overflowWrap: 'break-word',
}

// UX-B ④：target 整列绿色**边框**（原绿色背景退役；背景通道让位相同值行标示）
export const TARGET_SIDE_BORDER: CSSProperties = {
  borderLeft: '2px solid var(--state-success-border)',
  borderRight: '2px solid var(--state-success-border)',
}

export const HEAD_CELL_STYLE: CSSProperties = {
  ...VIDEO_CELL_STYLE,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

export const HEAD_CELL_TARGET_STYLE: CSSProperties = {
  ...HEAD_CELL_STYLE,
  ...TARGET_SIDE_BORDER,
  borderTop: '2px solid var(--state-success-border)',
}

export const RECOMMENDED_BADGE_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  marginLeft: 6,
  borderRadius: 4,
  fontSize: '11px',
  fontWeight: 600,
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  border: '1px solid var(--state-success-border)',
}

export const WARN_TEXT: CSSProperties = { color: 'var(--state-warning-fg)', fontWeight: 600 }
export const DANGER_TEXT: CSSProperties = { color: 'var(--state-danger-fg)', fontWeight: 600 }
export const MUTED: CSSProperties = { color: 'var(--fg-muted)' }
export const COVER_STYLE: CSSProperties = {
  width: 48,
  aspectRatio: '2 / 3',
  objectFit: 'cover',
  borderRadius: 4,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-subtle)',
}

/** ▶En 集按钮（线路行） */
export const EP_BUTTON_STYLE: CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-subtle)',
  borderRadius: 3,
  padding: '0 4px',
  cursor: 'pointer',
  color: 'var(--fg-default)',
  fontSize: '11px',
}

export const EP_BUTTON_ACTIVE_STYLE: CSSProperties = {
  ...EP_BUTTON_STYLE,
  border: '1px solid var(--state-success-border)',
  background: 'var(--state-success-bg)',
  color: 'var(--state-success-fg)',
  fontWeight: 600,
}
