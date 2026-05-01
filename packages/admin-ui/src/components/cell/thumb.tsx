'use client'

/**
 * thumb.tsx — Thumb 共享组件实装（CHG-DESIGN-12 12B）
 *
 * 真源：thumb.types.ts（12A Opus PASS 契约）
 *
 * 实装契约（12A 一致性硬约束）：
 *   - 4 size variant：poster-sm 32×48 / poster-md 38×56 / banner-sm 64×36 / square-sm 28×28
 *   - src 非空 → <img object-fit:cover>；空 → placeholder span
 *   - decorative=true（默认） → alt='' + aria-hidden=true
 *   - decorative=false + alt 缺失 → dev warn
 *   - fallback ReactNode（src 空时优先于默认 placeholder）
 *   - loading 默认 'lazy'
 *
 * 固定 data attribute：data-thumb + data-size + data-state（has-src | placeholder）
 */
import React from 'react'
import type { ThumbProps, ThumbSize } from './thumb.types'

interface SizeSpec {
  readonly width: number
  readonly height: number
  readonly radius: string
}

function sizeSpec(size: ThumbSize): SizeSpec {
  switch (size) {
    case 'poster-md': return { width: 38, height: 56, radius: 'var(--radius-sm)' }
    case 'banner-sm': return { width: 64, height: 36, radius: 'var(--radius-sm)' }
    case 'square-sm': return { width: 28, height: 28, radius: 'var(--radius-md)' }
    case 'poster-sm':
    default:
      return { width: 32, height: 48, radius: 'var(--radius-sm)' }
  }
}

export function Thumb({
  src,
  size = 'poster-sm',
  alt,
  decorative = true,
  fallback,
  loading = 'lazy',
  testId,
}: ThumbProps): React.ReactElement {
  // 12A SHOULD：decorative=false + alt 缺失 → dev warn
  if (process.env.NODE_ENV !== 'production' && !decorative && !alt) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Thumb] decorative=false but alt is empty/missing. ` +
      `Pass alt explicitly for informational images (a11y).`,
    )
  }

  const spec = sizeSpec(size)
  const rootStyle: React.CSSProperties = {
    width: `${spec.width}px`,
    height: `${spec.height}px`,
    borderRadius: spec.radius,
    background: 'var(--bg-surface-elevated)',
    overflow: 'hidden',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const hasSrc = typeof src === 'string' && src.length > 0

  if (hasSrc) {
    return (
      <span
        data-thumb
        data-size={size}
        data-state="has-src"
        data-testid={testId}
        style={rootStyle}
      >
        <img
          src={src}
          alt={decorative ? '' : (alt ?? '')}
          aria-hidden={decorative ? true : undefined}
          loading={loading}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </span>
    )
  }

  // src 空 → fallback ReactNode 或默认 placeholder
  return (
    <span
      data-thumb
      data-size={size}
      data-state="placeholder"
      data-testid={testId}
      aria-label={decorative ? undefined : (alt ?? '无封面')}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      style={rootStyle}
    >
      {fallback ?? null}
    </span>
  )
}
