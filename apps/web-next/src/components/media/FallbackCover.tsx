import { cn } from '@/lib/utils'
import type { FallbackCoverProps } from './types'

const ASPECT_RATIOS: Record<NonNullable<FallbackCoverProps['variant']>, string> = {
  poster: '2 / 3',
  still: '16 / 9',
  avatar: '1 / 1',
  generic: '2 / 3',
}

const ARIA_LABELS: Record<NonNullable<FallbackCoverProps['variant']>, string> = {
  poster: 'Poster image unavailable',
  still: 'Image unavailable',
  avatar: 'Avatar image unavailable',
  generic: 'Image unavailable',
}

function FilmIcon({ scale }: { scale: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: `${scale * 100}%`, height: 'auto' }}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="17" y1="7" x2="22" y2="7" />
      <line x1="17" y1="17" x2="22" y2="17" />
      <line x1="2" y1="17" x2="7" y2="17" />
    </svg>
  )
}

function AvatarIcon({ scale }: { scale: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: `${scale * 100}%`, height: 'auto' }}
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export function FallbackCover({
  aspectRatio,
  width,
  height,
  className,
  ariaLabel,
  iconScale = 0.32,
  variant = 'generic',
  'data-testid': testId,
}: FallbackCoverProps) {
  const resolvedAspectRatio = aspectRatio ?? ASPECT_RATIOS[variant]
  const label = ariaLabel ?? ARIA_LABELS[variant]

  return (
    <div
      role="img"
      aria-label={label}
      data-testid={testId}
      className={cn('grid place-items-center overflow-hidden', className)}
      style={{
        aspectRatio: resolvedAspectRatio,
        width,
        height,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md, 8px)',
        color: 'var(--fg-muted)',
      }}
    >
      {variant === 'avatar' ? (
        <AvatarIcon scale={iconScale} />
      ) : (
        <FilmIcon scale={iconScale} />
      )}
    </div>
  )
}
