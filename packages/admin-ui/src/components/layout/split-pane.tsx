'use client'

/**
 * split-pane.tsx — 多栏布局原语
 * 真源：reference §4.6（CHG-SN-4-01 / M-SN-4 P0）
 * arch-reviewer CONDITIONAL → PASS（R1-R6 均已处理）
 *
 * 约束：
 *   - 零硬编码颜色（var(--bg-surface-elevated) / var(--border-subtle) / var(--radius-md)）
 *   - height 由消费方传入（推荐 `calc(100vh - var(--topbar-h) - 40px)`）
 *   - 三栏各自独立滚动；scrollbar 6px 由 admin-shell-styles 全局覆盖（R4）
 *   - resizable/onResize API 预留，本期不实装（R3）
 */
import React from 'react'

/** 单栏配置。width 数字自动加 px，字符串原样（支持 `1fr` / CSS 变量）。 */
export interface SplitPanePaneConfig {
  /** grid 轨道宽度（number → `${n}px`；string 原样，如 `'1fr'`） */
  readonly width: number | string
  /** CSS min-width，防止 fr 栏被压缩到 0 */
  readonly minWidth?: number
  /** 栏头节点；不传则不渲染 head 容器 */
  readonly header?: React.ReactNode
  /** 栏体内容 */
  readonly children: React.ReactNode
  /** true 时栏体无 padding；默认 false（12px 内边距） */
  readonly noPadding?: boolean
  /** 隐藏该栏；响应式由消费方判断后传入 */
  readonly hidden?: boolean
  /** 栏 a11y 标签 */
  readonly 'aria-label'?: string
  /** 栏语义 role（R5：限定枚举） */
  readonly role?: 'region' | 'complementary' | 'main'
  /** 栏测试 id */
  readonly 'data-testid'?: string
}

export interface SplitPaneProps {
  /**
   * 栏配置数组，2–4 栏（R2：越界 console.warn）。
   * 典型三栏：`[{ width: 280 }, { width: '1fr' }, { width: 300, hidden: narrow }]`
   */
  readonly panes: ReadonlyArray<SplitPanePaneConfig>
  /** 整体高度（推荐 `'calc(100vh - var(--topbar-h) - 40px)'`，R1：不内部硬编码） */
  readonly height: number | string
  /** 栏间距，默认 12px（reference §4.6） */
  readonly gap?: number
  /**
   * 启用拖拽改变栏宽（本期不实装，API 预留）。
   * @default false
   */
  readonly resizable?: boolean
  /** 拖拽宽度变化回调（仅 resizable=true 生效，本期预留） */
  readonly onResize?: (widths: ReadonlyArray<number>) => void
  /** 容器 role（R5：限定枚举） */
  readonly role?: 'region' | 'group'
  /** 容器 a11y 标签 */
  readonly 'aria-label'?: string
  /** 容器测试 id */
  readonly 'data-testid'?: string
}

function toCSSLength(v: number | string): string {
  return typeof v === 'number' ? `${v}px` : v
}

const PANE_BASE: React.CSSProperties = {
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minWidth: 0,
}

const PANE_HEAD: React.CSSProperties = {
  padding: '10px 12px',
  flexShrink: 0,
  borderBottom: '1px solid var(--border-subtle)',
}

const PANE_BODY: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
}

const PANE_BODY_PADDED: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
  padding: '12px',
}

export function SplitPane({
  panes,
  height,
  gap = 12,
  resizable = false,
  onResize: _onResize,
  role,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: SplitPaneProps): React.ReactElement {
  if (process.env.NODE_ENV !== 'production' && (panes.length < 2 || panes.length > 4)) {
    console.warn(`[SplitPane] panes.length should be 2–4, got ${panes.length}`)
  }
  if (process.env.NODE_ENV !== 'production' && resizable) {
    console.warn('[SplitPane] resizable is not yet implemented; prop is reserved for future use')
  }

  const visiblePanes = panes.filter(p => !p.hidden)
  const gridTemplateColumns = visiblePanes.map(p => toCSSLength(p.width)).join(' ')

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      data-testid={testId}
      data-split
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap: `${gap}px`,
        height: toCSSLength(height),
        minHeight: 0,
      }}
    >
      {visiblePanes.map((pane, i) => {
        const paneStyle: React.CSSProperties = pane.minWidth
          ? { ...PANE_BASE, minWidth: pane.minWidth }
          : PANE_BASE
        return (
          <div
            key={i}
            role={pane.role}
            aria-label={pane['aria-label']}
            data-testid={pane['data-testid']}
            data-split-pane
            style={paneStyle}
          >
            {pane.header !== undefined && (
              <div data-split-pane-head style={PANE_HEAD}>{pane.header}</div>
            )}
            <div
              data-split-pane-body
              style={pane.noPadding ? PANE_BODY : PANE_BODY_PADDED}
            >
              {pane.children}
            </div>
          </div>
        )
      })}
    </div>
  )
}
