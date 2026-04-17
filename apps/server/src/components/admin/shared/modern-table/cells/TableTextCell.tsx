interface TableTextCellProps {
  value: string | null | undefined
  fallback?: string
  title?: string
  className?: string
}

export function TableTextCell({
  value,
  fallback = '—',
  title,
  className,
}: TableTextCellProps) {
  const text = value && value.trim().length > 0 ? value : fallback

  return (
    <span
      className={`block max-w-full truncate whitespace-nowrap ${className ?? ''}`.trim()}
      title={title ?? (text === fallback ? undefined : value ?? undefined)}
      data-testid="table-text-cell"
    >
      {text}
    </span>
  )
}
