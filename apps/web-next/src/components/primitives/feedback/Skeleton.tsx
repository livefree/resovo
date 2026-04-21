import { cn } from '@/lib/utils'

export interface SkeletonProps {
  shape?: 'rect' | 'circle' | 'text'
  width?: string | number
  height?: string | number
  /** Animation stagger delay tier (maps to CSS var) */
  delay?: 300 | 800
  className?: string
  style?: React.CSSProperties
}

const SHAPE_CLASS: Record<NonNullable<SkeletonProps['shape']>, string> = {
  rect:   'rounded',
  circle: 'rounded-full',
  text:   'rounded',
}

export function Skeleton({
  shape = 'rect',
  width,
  height,
  delay,
  className,
  style,
}: SkeletonProps) {
  const animationDelay = delay === 300
    ? 'var(--skeleton-delay-tier-1)'
    : delay === 800
      ? 'var(--skeleton-delay-tier-2)'
      : undefined

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn(SHAPE_CLASS[shape], className)}
      style={{
        width,
        height,
        background: 'linear-gradient(90deg, var(--skeleton-bg-base) 25%, var(--skeleton-bg-highlight) 50%, var(--skeleton-bg-base) 75%)',
        backgroundSize: '200% 100%',
        animation: `skeleton-shimmer var(--skeleton-shimmer-duration) linear infinite`,
        animationDelay,
        ...style,
      }}
    />
  )
}
