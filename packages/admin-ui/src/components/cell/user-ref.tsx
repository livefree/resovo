'use client'

/**
 * user-ref.tsx — UserRef 实装（CHG-SN-6-RETRO-3-C / arch-reviewer Opus PASS）
 *
 * 视觉规格（design-tokens 引用）：
 *   - font-size: var(--font-size-sm) / xs 时 var(--font-size-xs)
 *   - color: var(--fg-default)（username 命中）/ var(--fg-muted)（deletedFallback）
 */

import type { UserRefProps } from './user-ref.types'

export function UserRef({
  id,
  username,
  deletedFallback = '—',
  size = 'sm',
  testId = 'user-ref',
  className,
}: UserRefProps) {
  const fontSize = size === 'xs' ? 'var(--font-size-xs)' : 'var(--font-size-sm)'
  return (
    <span
      data-user-id={id}
      data-testid={testId}
      className={className}
      style={{ fontSize, color: 'var(--fg-default)' }}
    >
      {username ?? <span style={{ color: 'var(--fg-muted)' }}>{deletedFallback}</span>}
    </span>
  )
}
