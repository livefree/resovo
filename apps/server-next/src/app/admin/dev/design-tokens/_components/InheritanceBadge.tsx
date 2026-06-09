'use client'

/**
 * InheritanceBadge — token 继承来源徽标。
 * 迁移自 apps/server（CHG-CUTOVER-QA-DEV-MIGRATE）：Tailwind 类转内联样式（server-next 无 Tailwind）。
 */

interface InheritanceBadgeProps {
  source: 'base' | 'brand-override' | 'dirty'
}

const BASE_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-sm-tight)',
  paddingInline: 6,
  paddingBlock: 2,
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-family-mono)',
}

const SOURCE_STYLES: Record<InheritanceBadgeProps['source'], { label: string; style: React.CSSProperties }> = {
  base: {
    label: '继承自 base',
    style: { color: 'var(--fg-muted)', backgroundColor: 'var(--bg-surface-sunken)', border: '1px solid var(--border-subtle)' },
  },
  'brand-override': {
    label: 'brand 覆写',
    style: { color: 'var(--accent-fg)', backgroundColor: 'var(--accent-muted)', border: '1px solid var(--accent-default)' },
  },
  dirty: {
    label: '未保存',
    style: { color: 'var(--fg-default)', backgroundColor: 'var(--state-warning-bg)', border: '1px solid var(--state-warning-border)' },
  },
}

export function InheritanceBadge({ source }: InheritanceBadgeProps) {
  const { label, style } = SOURCE_STYLES[source]
  return <span style={{ ...BASE_STYLE, ...style }}>{label}</span>
}
