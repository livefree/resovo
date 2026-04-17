interface TableBadgeCellProps {
  label: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}

const TONE_PREFIX: Record<NonNullable<TableBadgeCellProps['tone']>, string> = {
  neutral: '',
  success: '✓',
  warning: '!',
  danger: '×',
  info: 'i',
}

export function TableBadgeCell({
  label,
  tone = 'neutral',
  className,
}: TableBadgeCellProps) {
  const prefix = TONE_PREFIX[tone]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg3)] px-2 py-0.5 text-xs text-[var(--muted)] ${className ?? ''}`.trim()}
      data-testid="table-badge-cell"
    >
      {prefix ? <span aria-hidden>{prefix}</span> : null}
      <span>{label}</span>
    </span>
  )
}
