'use client'

import { useState } from 'react'

interface TableUrlCellProps {
  url: string | null | undefined
  fallback?: string
  maxLength?: number
  onCopied?: (value: string) => void
}

function buildDisplayText(url: string, maxLength: number): string {
  let display = url

  try {
    const parsed = new URL(url)
    display = `${parsed.hostname}${parsed.pathname}${parsed.search}`
  } catch {
    display = url
  }

  if (display.length <= maxLength) return display
  return `${display.slice(0, maxLength)}…`
}

export function TableUrlCell({
  url,
  fallback = '—',
  maxLength = 48,
  onCopied,
}: TableUrlCellProps) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  if (!url) {
    return (
      <span className="text-[var(--muted)]" data-testid="table-url-cell-empty">
        {fallback}
      </span>
    )
  }

  const resolvedUrl = url

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(resolvedUrl)
      setCopied(true)
      setCopyError(null)
      onCopied?.(resolvedUrl)
    } catch (error) {
      setCopied(false)
      if (error instanceof Error && error.message.trim().length > 0) {
        setCopyError(error.message)
      } else {
        setCopyError('复制失败')
      }
    }
  }

  return (
    <span className="group relative inline-flex max-w-full items-center gap-2" data-testid="table-url-cell">
      <button
        type="button"
        className="inline-flex max-w-full items-center text-left"
        title={resolvedUrl}
        onClick={handleCopy}
        data-testid="table-url-copy-btn"
      >
        <span className="max-w-[320px] truncate whitespace-nowrap font-mono text-xs text-[var(--muted)]">
          {buildDisplayText(resolvedUrl, maxLength)}
        </span>
      </button>

      <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden max-w-[560px] rounded border border-[var(--border)] bg-[var(--bg2)] px-2 py-1 text-xs text-[var(--text)] group-hover:block">
        {resolvedUrl}
      </span>

      {copied ? <span className="text-xs text-[var(--muted)]">已复制</span> : null}
      {copyError ? <span className="text-xs text-[var(--muted)]">{copyError}</span> : null}
    </span>
  )
}
