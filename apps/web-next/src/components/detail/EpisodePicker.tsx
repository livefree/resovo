'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import type { Video } from '@resovo/types'

interface EpisodePickerProps {
  video: Video
  onEpisodeChange?: (episode: number) => void
}

export function EpisodePicker({ video, onEpisodeChange }: EpisodePickerProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [activeEp, setActiveEp] = useState(() => {
    const ep = Number(searchParams.get('ep'))
    return ep >= 1 && ep <= video.episodeCount ? ep : 1
  })

  function handleSelect(ep: number) {
    setActiveEp(ep)
    router.replace(`?ep=${ep}`, { scroll: false })
    onEpisodeChange?.(ep)
  }

  if (video.episodeCount <= 1) return null

  return (
    <section
      className="max-w-screen-xl mx-auto px-4 py-4 border-t"
      style={{ borderColor: 'var(--border-default)' }}
      data-testid="episode-picker"
    >
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--fg-default)' }}>
        选集（共 {video.episodeCount} 集）
      </h2>

      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
        {Array.from({ length: video.episodeCount }, (_, i) => i + 1).map((ep) => (
          <button
            key={ep}
            type="button"
            onClick={() => handleSelect(ep)}
            data-testid={`episode-btn-${ep}`}
            className={cn(
              'flex items-center justify-center h-9 rounded text-sm font-medium',
              'transition-colors border',
              activeEp === ep
                ? 'border-transparent'
                : 'hover:border-transparent',
            )}
            style={
              activeEp === ep
                ? { background: 'var(--accent-default)', color: 'var(--accent-fg)', borderColor: 'transparent' }
                : { background: 'var(--bg-surface-sunken)', color: 'var(--fg-default)', borderColor: 'var(--border-default)' }
            }
            aria-pressed={activeEp === ep}
          >
            {ep}
          </button>
        ))}
      </div>
    </section>
  )
}

function EpisodePickerSkeleton() {
  return (
    <div
      className="max-w-screen-xl mx-auto px-4 py-4 border-t"
      style={{ borderColor: 'var(--border-default)' }}
    >
      <Skeleton shape="text" width={128} height={16} className="mb-3" />
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} shape="rect" height={36} delay={300} />
        ))}
      </div>
    </div>
  )
}

EpisodePicker.Skeleton = EpisodePickerSkeleton
