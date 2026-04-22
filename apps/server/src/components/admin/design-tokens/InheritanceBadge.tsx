'use client'

interface InheritanceBadgeProps {
  source: 'base' | 'brand-override' | 'dirty'
}

const BADGE_STYLES: Record<InheritanceBadgeProps['source'], { label: string; style: React.CSSProperties }> = {
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
  const { label, style } = BADGE_STYLES[source]
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-mono"
      style={style}
    >
      {label}
    </span>
  )
}
