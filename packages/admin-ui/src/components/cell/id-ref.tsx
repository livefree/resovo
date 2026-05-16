'use client'

/**
 * id-ref.tsx — IdRef 实装（CHG-SN-6-RETRO-3-C / arch-reviewer Opus PASS）
 */

import type { IdRefProps } from './id-ref.types'

export function IdRef({
  kind,
  id,
  idShortChars = 8,
  batchFallback = '—',
  ellipsis = '…',
  testId = 'id-ref',
  className,
}: IdRefProps) {
  const shortId = id && idShortChars > 0 && id.length > idShortChars
    ? `${id.slice(0, idShortChars)}${ellipsis}`
    : id
  return (
    <span
      data-testid={testId}
      className={className}
      style={{ display: 'inline-flex', gap: '6px', alignItems: 'baseline' }}
    >
      <code
        style={{
          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--fg-muted)',
        }}
      >
        {kind}
      </code>
      <span
        style={{
          fontSize: 'var(--font-size-xs)',
          color: id ? 'var(--fg-default)' : 'var(--fg-muted)',
        }}
      >
        {id ? shortId : batchFallback}
      </span>
    </span>
  )
}
