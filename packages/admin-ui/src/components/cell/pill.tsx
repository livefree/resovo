'use client'

/**
 * pill.tsx — Pill 共享组件实装（CHG-DESIGN-12 12B）
 *
 * 真源：pill.types.ts（12A Opus PASS 契约 + Codex stop-time fix 2 处 token 引用对齐）
 *
 * 实装契约（12A 契约一致性硬约束）：
 *   - 必含 6px dot（设计稿硬约束，禁止隐藏）
 *   - 8 variant：neutral / ok / warn / danger / info / accent / probe / render
 *   - inline-flex / 1px 7px / 11px/500 / radius full
 *   - dot 颜色 = variant 主色
 *   - 颜色仅消费 design-tokens（CSS 变量）
 *   - role=status（隐式状态指示器）
 *
 * 固定 data attribute：
 *   - 根：data-pill + data-variant={variant}（与 admin-ui 既有命名风格对齐）
 *
 * 7B SHOULD（与 KpiCard 一致）：children 是非 string ReactNode 且 ariaLabel 未传时 dev warn。
 */
import React from 'react'
import type { PillProps, PillVariant } from './pill.types'

const ROOT_BASE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '1px 7px',
  fontSize: '11px',
  fontWeight: 500,
  borderRadius: 'var(--radius-full)',
  whiteSpace: 'nowrap',
  lineHeight: 1.4,
}

const DOT_BASE_STYLE: React.CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  flexShrink: 0,
  display: 'inline-block',
}

interface VariantTokens {
  readonly bg: string
  readonly fg: string
}

function variantTokens(variant: PillVariant): VariantTokens {
  switch (variant) {
    case 'ok': return { bg: 'var(--state-success-bg)', fg: 'var(--state-success-fg)' }
    case 'warn': return { bg: 'var(--state-warning-bg)', fg: 'var(--state-warning-fg)' }
    case 'danger': return { bg: 'var(--state-error-bg)', fg: 'var(--state-error-fg)' }
    case 'info': return { bg: 'var(--state-info-bg)', fg: 'var(--state-info-fg)' }
    case 'accent': return { bg: 'var(--admin-accent-soft)', fg: 'var(--admin-accent-on-soft)' }
    case 'probe': return { bg: 'var(--dual-signal-probe-soft)', fg: 'var(--dual-signal-probe)' }
    case 'render': return { bg: 'var(--dual-signal-render-soft)', fg: 'var(--dual-signal-render)' }
    case 'neutral':
    default:
      return { bg: 'var(--bg-surface-raised)', fg: 'var(--fg-muted)' }
  }
}

export function Pill({
  children,
  variant = 'neutral',
  ariaLabel,
  testId,
}: PillProps): React.ReactElement {
  // 12A SHOULD：children 是非 string ReactNode 且 ariaLabel 未传 → dev warn
  if (
    process.env.NODE_ENV !== 'production' &&
    !ariaLabel &&
    typeof children !== 'string' &&
    typeof children !== 'number'
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Pill] children is non-primitive ReactNode and ariaLabel is missing. ` +
      `Pass ariaLabel explicitly when children is not a string/number.`,
    )
  }

  const tokens = variantTokens(variant)
  const rootStyle: React.CSSProperties = {
    ...ROOT_BASE_STYLE,
    background: tokens.bg,
    color: tokens.fg,
  }
  const dotStyle: React.CSSProperties = {
    ...DOT_BASE_STYLE,
    background: tokens.fg,
  }

  // ariaLabel 派生：未传 + children 是 string/number → 使用 children；否则 undefined（不强制 aria-label）
  const derivedAriaLabel = ariaLabel ?? (
    typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : undefined
  )

  return (
    <span
      data-pill
      data-variant={variant}
      data-testid={testId}
      role="status"
      aria-label={derivedAriaLabel}
      style={rootStyle}
    >
      <span aria-hidden="true" data-pill-dot style={dotStyle} />
      <span data-pill-content>{children}</span>
    </span>
  )
}
