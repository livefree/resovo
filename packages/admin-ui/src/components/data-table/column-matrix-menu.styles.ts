/**
 * column-matrix-menu.styles.ts — ColumnMatrixMenu 内联样式常量（DTR-A 拆自 column-matrix-menu.tsx）
 *
 * 核心 inline；细节走 dt-styles-matrix.ts `[data-column-matrix-menu]` 选择器。
 * 纯常量平移、零行为变化。
 */
import type { CSSProperties } from 'react'

export const PANEL_STYLE: CSSProperties = {
  position: 'fixed',
  zIndex: 'var(--z-admin-dropdown)' as CSSProperties['zIndex'],
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
  minWidth: '520px',
  maxWidth: '90vw',
  maxHeight: '60vh',
  display: 'flex',
  flexDirection: 'column',
  outline: 'none',
}

export const HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  borderBottom: '1px solid var(--border-default)',
  fontSize: 'var(--font-size-sm-tight)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  flexShrink: 0,
}

export const CLOSE_BTN_STYLE: CSSProperties = {
  background: 'transparent',
  border: 0,
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: '16px',
  lineHeight: 1,
  padding: '2px 6px',
}

export const GRID_WRAP_STYLE: CSSProperties = {
  overflowY: 'auto',
  overflowX: 'auto',
  flex: '1 1 auto',
  minHeight: 0,
}

export const FOOT_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 14px',
  borderTop: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  flexShrink: 0,
  flexWrap: 'wrap',
}

export const FOOT_BTN_STYLE: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--fg-muted)',
  padding: '4px 10px',
  fontFamily: 'inherit',
  fontSize: '12px',
  cursor: 'pointer',
}
