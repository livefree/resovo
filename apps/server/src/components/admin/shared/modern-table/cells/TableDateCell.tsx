interface TableDateCellProps {
  value: string | Date | null | undefined
  fallback?: string
  showRelative?: boolean
  now?: Date
  className?: string
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatAbsoluteDate(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelativeDate(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 60_000) return '刚刚'

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`

  const days = Math.floor(hours / 24)
  return `${days}天前`
}

export function TableDateCell({
  value,
  fallback = '—',
  showRelative = true,
  now = new Date(),
  className,
}: TableDateCellProps) {
  const date = parseDate(value)

  if (!date) {
    return (
      <span className={`text-[var(--muted)] ${className ?? ''}`.trim()} data-testid="table-date-cell">
        {fallback}
      </span>
    )
  }

  const absolute = formatAbsoluteDate(date)
  const visibleText = showRelative ? formatRelativeDate(date, now) : absolute

  return (
    <span
      className={`whitespace-nowrap text-[var(--muted)] ${className ?? ''}`.trim()}
      title={absolute}
      data-testid="table-date-cell"
    >
      {visibleText}
    </span>
  )
}
