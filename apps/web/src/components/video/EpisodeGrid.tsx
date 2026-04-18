/**
 * EpisodeGrid.tsx — 选集网格（剧集/动漫类型显示，点击跳转播放页）
 * Server Component
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Video } from '@/types'

interface EpisodeGridProps {
  video: Video
}

export function EpisodeGrid({ video }: EpisodeGridProps) {
  // 只有剧集/动漫/综艺且集数 > 1 才显示
  if (video.episodeCount <= 1) return null

  const watchBase = video.slug
    ? `/watch/${video.slug}-${video.shortId}`
    : `/watch/${video.shortId}`

  return (
    <section
      className="max-w-screen-xl mx-auto px-4 py-4 border-t"
      style={{ borderColor: 'var(--border)' }}
      data-testid="episode-grid"
    >
      <h2
        className="text-sm font-semibold mb-3"
        style={{ color: 'var(--foreground)' }}
      >
        选集（共 {video.episodeCount} 集）
      </h2>

      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
        {Array.from({ length: video.episodeCount }, (_, i) => i + 1).map((ep) => (
          <Link
            key={ep}
            href={`${watchBase}?ep=${ep}`}
            className={cn(
              'flex items-center justify-center h-9 rounded text-sm font-medium',
              'transition-colors hover:bg-[var(--gold)] hover:text-black',
              'border'
            )}
            style={{
              background: 'var(--secondary)',
              color: 'var(--foreground)',
              borderColor: 'var(--border)',
            }}
            data-testid={`episode-${ep}`}
          >
            {ep}
          </Link>
        ))}
      </div>
    </section>
  )
}
