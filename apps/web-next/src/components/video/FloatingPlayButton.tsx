'use client'

import { cn } from '@/lib/utils'

interface FloatingPlayButtonProps {
  className?: string
}

export function FloatingPlayButton({ className }: FloatingPlayButtonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 flex items-center justify-center',
        className,
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center w-11 h-11 rounded-full',
          'opacity-0 translate-y-1',
          'transition-[opacity,transform]',
          // leave: 90ms (base state), enter: 120ms (group-hover/poster override)
          'duration-[90ms] group-hover/poster:duration-[120ms]',
          'group-hover/poster:opacity-100 group-hover/poster:translate-y-0',
        )}
        style={{
          background: 'color-mix(in oklch, oklch(100% 0 0) 20%, transparent)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="white"
          className="ml-0.5"
          aria-hidden="true"
        >
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </span>
    </span>
  )
}
