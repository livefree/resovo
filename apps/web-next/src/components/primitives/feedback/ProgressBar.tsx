import { cn } from '@/lib/utils'

export interface ProgressBarProps {
  /** 0–100, or undefined for indeterminate */
  value?: number
  className?: string
  'aria-label'?: string
}

export function ProgressBar({ value, className, 'aria-label': label }: ProgressBarProps) {
  const indeterminate = value === undefined

  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Loading'}
      className={cn('relative h-0.5 overflow-hidden', className)}
      style={{ background: 'var(--skeleton-bg-base)' }}
    >
      <div
        className={cn('absolute inset-y-0 left-0', indeterminate && 'w-1/3')}
        style={{
          width: indeterminate ? undefined : `${value}%`,
          background: 'var(--accent-default)',
          transition: indeterminate ? undefined : 'width 300ms ease',
          animation: indeterminate
            ? 'progressbar-indeterminate 1.4s ease-in-out infinite'
            : undefined,
        }}
      />
    </div>
  )
}
