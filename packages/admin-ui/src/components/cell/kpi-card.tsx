'use client'

/**
 * kpi-card.tsx — KpiCard 共享组件实装（CHG-DESIGN-07 7B）
 *
 * 真源：kpi-card.types.ts（7A Opus PASS 契约）+ reference.md §4.3 / §5.1.2
 *
 * 实装契约（7A 契约一致性硬约束）：
 *   - 3 row 布局：header (icon? + label) → value → footer (delta + spark)
 *   - variant: default / is-warn / is-danger / is-ok → 容器 border + value 染色（不动卡背景）
 *   - delta.direction: up / down / flat → delta 文本染色（state-success-fg / state-error-fg / fg-muted）
 *   - 维度独立：variant 与 delta.direction 可任意组合
 *   - spark 渲染于 footer 右下，opacity 0.4（容器层应用，消费方传 spark 不需自加 opacity）
 *   - spark 渲染结果为 null / undefined → footer 不渲染 spark 占位空白（footer 仍由 delta 撑高，
 *     4 张 KPI 横向对齐不受影响）
 *   - dataSource: 'mock' | 'live' → 渲染对应 `data-source` attribute；undefined → 不渲染
 *   - onClick 提供时容器渲染为 button + hover 态；省略时渲染为 div
 *   - 固定 data attributes（与 admin-ui state primitives 风格对齐）：
 *     · 根：data-kpi-card + data-variant={variant} (+ data-source={mock|live})
 *     · value 节点：data-card-value（7C/7D regression gate 断言锚点）
 *
 * 7B SHOULD：value 为非 string ReactNode 且 ariaLabel 未传时 dev 环境 console.warn 提示。
 */
import React, { useMemo } from 'react'
import type { KpiCardProps, KpiCardVariant, KpiDeltaDirection } from './kpi-card.types'

// ── styles ─────────────────────────────────────────────────────

const CONTAINER_BASE_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '14px 16px',
  background: 'var(--bg-surface-raised)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  boxSizing: 'border-box',
  font: 'inherit',
  color: 'var(--fg-default)',
  textAlign: 'left',
  width: '100%',
}

const CONTAINER_BUTTON_STYLE: React.CSSProperties = {
  ...CONTAINER_BASE_STYLE,
  cursor: 'pointer',
}

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
}

const ICON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '16px',
  height: '16px',
  flexShrink: 0,
  color: 'var(--fg-muted)',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  // reference.md §4.3 / kpi-card.types.ts 第 13 行约定 "letter spacing 1px"
  letterSpacing: '1px',
  textTransform: 'uppercase',
  color: 'var(--fg-muted)',
  margin: 0,
  lineHeight: 1.2,
}

const VALUE_BASE_STYLE: React.CSSProperties = {
  fontSize: '26px',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.1,
  margin: 0,
  color: 'var(--fg-default)',
}

const FOOTER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '8px',
  minHeight: '18px',
}

const DELTA_BASE_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  margin: 0,
  lineHeight: 1.2,
}

const SPARK_SLOT_STYLE: React.CSSProperties = {
  width: '60px',
  height: '18px',
  flexShrink: 0,
  opacity: 0.4,
  overflow: 'hidden',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
}

// ── variant → token 映射 ───────────────────────────────────────

function variantBorderStyle(variant: KpiCardVariant): string {
  switch (variant) {
    case 'is-warn': return '1px solid var(--state-warning-border)'
    case 'is-danger': return '1px solid var(--state-error-border)'
    case 'is-ok': return '1px solid var(--state-success-border)'
    default: return '1px solid var(--border-default)'
  }
}

function variantValueColor(variant: KpiCardVariant): string {
  switch (variant) {
    case 'is-warn': return 'var(--state-warning-fg)'
    case 'is-danger': return 'var(--state-error-fg)'
    case 'is-ok': return 'var(--state-success-fg)'
    default: return 'var(--fg-default)'
  }
}

function deltaDirectionColor(direction: KpiDeltaDirection | undefined): string {
  switch (direction) {
    case 'up': return 'var(--state-success-fg)'
    case 'down': return 'var(--state-error-fg)'
    case 'flat':
    default: return 'var(--fg-muted)'
  }
}

// ── component ──────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  delta,
  variant = 'default',
  spark,
  icon,
  onClick,
  dataSource,
  ariaLabel,
  testId,
}: KpiCardProps): React.ReactElement {
  // 7B SHOULD（kpi-card.types.ts P1-3）：value 是非 string ReactNode 且未传 ariaLabel 时 dev warn
  if (
    process.env.NODE_ENV !== 'production' &&
    !ariaLabel &&
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      `[KpiCard] value is non-primitive ReactNode and ariaLabel is missing. ` +
      `Pass ariaLabel explicitly when value is not a string/number ` +
      `(label="${label}").`,
    )
  }

  const containerStyle = useMemo<React.CSSProperties>(() => {
    const base = onClick ? CONTAINER_BUTTON_STYLE : CONTAINER_BASE_STYLE
    return { ...base, border: variantBorderStyle(variant) }
  }, [onClick, variant])

  const valueStyle = useMemo<React.CSSProperties>(
    () => ({ ...VALUE_BASE_STYLE, color: variantValueColor(variant) }),
    [variant],
  )

  const deltaStyle = useMemo<React.CSSProperties>(
    () => ({ ...DELTA_BASE_STYLE, color: deltaDirectionColor(delta?.direction) }),
    [delta?.direction],
  )

  // 派生 aria-label：未传时由 label + value 拼（仅 string/number value 路径，避免 SSR ReactNode 派生）
  const derivedAriaLabel = ariaLabel ?? (
    typeof value === 'string' || typeof value === 'number'
      ? `${label}: ${value}`
      : label
  )

  // 共享 inner 渲染体（button / div 路径复用）
  const inner = (
    <>
      <div style={HEADER_STYLE} data-kpi-card-header>
        {icon && (
          <span style={ICON_STYLE} aria-hidden="true" data-kpi-card-icon>
            {icon}
          </span>
        )}
        <p style={LABEL_STYLE} data-kpi-card-label>{label}</p>
      </div>
      <p style={valueStyle} data-card-value>{value}</p>
      <div style={FOOTER_STYLE} data-kpi-card-footer>
        {delta && (
          <span
            style={deltaStyle}
            data-kpi-card-delta
            data-direction={delta.direction ?? 'flat'}
          >
            {delta.text}
          </span>
        )}
        {spark && (
          <span style={SPARK_SLOT_STYLE} data-kpi-card-spark aria-hidden="true">
            {spark}
          </span>
        )}
      </div>
    </>
  )

  // dataSource attribute（仅显式传值时渲染）
  const dataSourceAttr = dataSource ? { 'data-source': dataSource } : {}

  if (onClick) {
    return (
      <button
        type="button"
        data-kpi-card
        data-variant={variant}
        data-testid={testId}
        aria-label={derivedAriaLabel}
        onClick={onClick}
        style={containerStyle}
        {...dataSourceAttr}
      >
        {inner}
      </button>
    )
  }

  return (
    <div
      data-kpi-card
      data-variant={variant}
      data-testid={testId}
      role="group"
      aria-label={derivedAriaLabel}
      style={containerStyle}
      {...dataSourceAttr}
    >
      {inner}
    </div>
  )
}
