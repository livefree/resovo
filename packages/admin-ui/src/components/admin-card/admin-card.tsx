'use client'

/**
 * admin-card.tsx — 后台卡片通用原语
 * 真源：reference §4.3 Card（CHG-SN-5-PRE-03-E / SEQ-20260506-02 / M-SN-5.5）
 *
 * 用途：取代各页面 Dashboard / KPI / 配置区 inline card 自拼，统一 surface 层级 +
 * padding 槽位 + header/body/footer 三段结构。
 *
 * 不变约束：
 *   - 零业务视图消费
 *   - 不引入 BrandProvider / ThemeProvider
 *   - 零图标库依赖（header.icon / actions 由消费方注入 ReactNode）
 *   - Edge Runtime 兼容
 *
 * 视觉契约（reference §4.3）：
 *   - bg2（var(--bg-surface-elevated)）/ border / radius 8px / overflow hidden
 *   - Header padding 12px 14px，title 13px/600，sub 11px/muted
 *   - Body padding 14px（可通过 padding prop 调整 / 'none' 撤销）
 *   - Footer padding 10px 14px，顶部 border-subtle 分隔（可选）
 *
 * surface 层级（multi-level admin 页面常用）：
 *   - 'elevated'（默认）：bg-surface-elevated（面层卡片，从 page bg 浮起）
 *   - 'plain'：bg-surface（与 page bg 同级；用于 nested card 避免颜色叠加过深）
 *   - 'subtle'：bg-subtle（最浅；用于 quote-style call-out 卡）
 */

import React from 'react'

export type AdminCardSurface = 'elevated' | 'plain' | 'subtle'
export type AdminCardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface AdminCardProps {
  /** surface 层级；默认 'elevated' */
  readonly surface?: AdminCardSurface
  /** body padding（不影响 header / footer 自有 padding）；默认 'md' = 14px */
  readonly padding?: AdminCardPadding
  /** header 三 slot：title / subtitle / actions（任一可缺省） */
  readonly header?: {
    readonly title?: React.ReactNode
    readonly subtitle?: React.ReactNode
    readonly actions?: React.ReactNode
  }
  /**
   * header.title 为 string 时的语义级别（默认 3）。
   * AdminCard 通常嵌套在 PageHeader（h1）之下，3 级避免跳级；
   * 一页存在仅 PageHeader + AdminCard 平级时可显式传 2。
   */
  readonly headingLevel?: 2 | 3 | 4 | 5 | 6
  /** footer 节点；存在时自动加顶部 border-subtle 分隔 */
  readonly footer?: React.ReactNode
  /** body 内容 */
  readonly children?: React.ReactNode
  /** 状态修饰（warn / danger / ok）：影响 border + 状态色，不改 body 背景 */
  readonly status?: 'warn' | 'danger' | 'ok'
  /** a11y 标签 */
  readonly 'aria-label'?: string
  /** 容器 role；常用 'region' 表达 dashboard 卡片地标 */
  readonly role?: string
  /** 容器额外 className（用于消费方传入定位 / grid 布局类） */
  readonly className?: string
  /** 容器额外样式（merge 到 root 末位，可覆盖 surface 默认）；常用于 margin / flex / grid 定位 */
  readonly style?: React.CSSProperties
  /** 容器测试 id */
  readonly 'data-testid'?: string
}

const SURFACE_BG: Record<AdminCardSurface, string> = {
  elevated: 'var(--bg-surface-elevated)',
  plain: 'var(--bg-surface)',
  subtle: 'var(--bg-subtle, var(--bg-surface))',
}

const PADDING_VALUE: Record<AdminCardPadding, string> = {
  none: '0',
  sm: '8px',
  md: '14px',
  lg: '20px',
}

const STATUS_BORDER: Record<NonNullable<AdminCardProps['status']>, string> = {
  warn: 'var(--border-warn, var(--fg-warn))',
  danger: 'var(--border-danger, var(--fg-danger))',
  ok: 'var(--border-ok, var(--fg-ok))',
}

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '12px 14px',
  borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0,
}

const HEADER_MAIN: React.CSSProperties = {
  minWidth: 0,
  flex: '1 1 auto',
}

const HEADER_TITLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--font-size-base, 13px)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  lineHeight: 1.3,
}

const HEADER_SUBTITLE: React.CSSProperties = {
  margin: '2px 0 0',
  fontSize: 'var(--font-size-xs, 11px)',  // reference §4.3 sub 11px/muted；fallback 防 token 缺失
  color: 'var(--fg-muted)',
  lineHeight: 1.4,
}

const HEADER_ACTIONS: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexShrink: 0,
}

const FOOTER_STYLE: React.CSSProperties = {
  padding: '10px 14px',
  borderTop: '1px solid var(--border-subtle)',
  flexShrink: 0,
}

export function AdminCard({
  surface = 'elevated',
  padding = 'md',
  header,
  headingLevel = 3,
  footer,
  status,
  children,
  className,
  style: styleOverride,
  'aria-label': ariaLabel,
  role,
  'data-testid': testId,
}: AdminCardProps): React.ReactElement {
  const TitleTag = (`h${headingLevel}` as unknown) as keyof React.JSX.IntrinsicElements
  const rootStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    background: SURFACE_BG[surface],
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: status ? STATUS_BORDER[status] : 'var(--border-default)',
    borderRadius: 'var(--radius-md, 8px)',
    overflow: 'hidden',
    ...styleOverride,
  }

  const bodyStyle: React.CSSProperties = {
    padding: PADDING_VALUE[padding],
    minHeight: 0,
  }

  const hasHeaderContent = header && (header.title || header.subtitle || header.actions)

  return (
    <div
      data-admin-card
      data-surface={surface}
      data-padding={padding}
      data-status={status}
      role={role}
      aria-label={ariaLabel}
      className={className}
      data-testid={testId}
      style={rootStyle}
    >
      {hasHeaderContent && (
        <div data-admin-card-header style={HEADER_STYLE}>
          <div data-admin-card-header-main style={HEADER_MAIN}>
            {header?.title !== undefined && header?.title !== null && (
              typeof header.title === 'string'
                ? <TitleTag style={HEADER_TITLE} data-admin-card-title>{header.title}</TitleTag>
                : <div style={HEADER_TITLE} data-admin-card-title>{header.title}</div>
            )}
            {header?.subtitle !== undefined && header?.subtitle !== null && (
              typeof header.subtitle === 'string'
                ? <p style={HEADER_SUBTITLE} data-admin-card-subtitle>{header.subtitle}</p>
                : <div style={HEADER_SUBTITLE} data-admin-card-subtitle>{header.subtitle}</div>
            )}
          </div>
          {header?.actions !== undefined && header?.actions !== null && (
            <div data-admin-card-actions style={HEADER_ACTIONS}>{header.actions}</div>
          )}
        </div>
      )}
      <div data-admin-card-body style={bodyStyle}>
        {children}
      </div>
      {footer !== undefined && footer !== null && (
        <div data-admin-card-footer style={FOOTER_STYLE}>{footer}</div>
      )}
    </div>
  )
}
