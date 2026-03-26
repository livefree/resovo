import { useEffect, useRef } from 'react'

interface TableCheckboxCellProps {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  ariaLabel?: string
  onChange: (nextChecked: boolean) => void
}

export function TableCheckboxCell({
  checked,
  indeterminate = false,
  disabled = false,
  ariaLabel = '选择行',
  onChange,
}: TableCheckboxCellProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!inputRef.current) return
    inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      className="accent-[var(--accent)]"
      data-testid="table-checkbox-cell"
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
    />
  )
}
