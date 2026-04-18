'use client'

import { useEffect, useState } from 'react'

interface TableSwitchCellProps {
  value: boolean
  disabled?: boolean
  onToggle: (nextValue: boolean) => Promise<void> | void
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return '切换失败'
}

export function TableSwitchCell({
  value,
  disabled = false,
  onToggle,
}: TableSwitchCellProps) {
  const [localValue, setLocalValue] = useState(value)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) {
      setLocalValue(value)
    }
  }, [value, loading])

  async function handleToggle() {
    if (loading || disabled) return

    const previous = localValue
    const nextValue = !previous
    setLocalValue(nextValue)
    setLoading(true)
    setError(null)

    try {
      await onToggle(nextValue)
    } catch (toggleError) {
      setLocalValue(previous)
      setError(getErrorMessage(toggleError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2" data-testid="table-switch-cell">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors disabled:opacity-50 ${
          localValue
            ? 'border-[var(--accent)] bg-[var(--accent)]/20'
            : 'border-[var(--border)] bg-[var(--bg3)]'
        }`}
        aria-label={localValue ? '关闭' : '开启'}
        data-testid="table-switch-toggle"
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-[var(--text)] transition ${
            localValue ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      {loading ? <span className="text-xs text-[var(--muted)]">处理中…</span> : null}
      {error ? <span className="text-xs text-[var(--muted)]">{error}</span> : null}
    </span>
  )
}
