'use client'

/**
 * code-text.tsx — CodeText 实装（CHG-SN-6-RETRO-3-C / arch-reviewer Opus PASS）
 */

import type { CodeTextProps } from './code-text.types'

export function CodeText({
  value,
  fallback = '—',
  muted = false,
  dataAttr,
  testId = 'code-text',
  className,
}: CodeTextProps) {
  return (
    <code
      data-testid={testId}
      className={className}
      style={{
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontSize: 'var(--font-size-xs)',
        color: muted ? 'var(--fg-muted)' : 'var(--fg-default)',
      }}
      {...(dataAttr ?? {})}
    >
      {value ?? fallback}
    </code>
  )
}
