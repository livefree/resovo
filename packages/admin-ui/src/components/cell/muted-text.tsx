'use client'

/**
 * muted-text.tsx — MutedText 实装（CHG-SN-6-RETRO-3-C / arch-reviewer Opus PASS）
 */

import type { CSSProperties } from 'react'
import type { MutedTextProps } from './muted-text.types'

export function MutedText({
  value,
  fallback = '—',
  clamp = 1,
  dataAttr,
  testId = 'muted-text',
  className,
}: MutedTextProps) {
  const lines = Math.max(1, clamp)
  const clampStyle: CSSProperties =
    lines === 1
      ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
      : {
          display: '-webkit-box',
          WebkitLineClamp: lines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }
  const text = value && value.length > 0 ? value : fallback
  return (
    <span
      data-testid={testId}
      className={className}
      style={{
        fontSize: 'var(--font-size-xs)',
        color: 'var(--fg-muted)',
        ...clampStyle,
      }}
      {...(dataAttr ?? {})}
    >
      {text}
    </span>
  )
}
