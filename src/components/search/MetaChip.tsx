/**
 * MetaChip.tsx — 元数据标签（导演/演员/编剧/年份等）
 */

interface MetaChipProps {
  label: string
  type?: 'director' | 'actor' | 'writer' | 'year' | string
  className?: string
}

export function MetaChip({ label, className }: MetaChipProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        border: '1px solid var(--border)',
        color: 'var(--muted-foreground)',
        background: 'var(--secondary)',
      }}
    >
      {label}
    </span>
  )
}
