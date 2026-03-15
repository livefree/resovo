/**
 * VideoDetailMeta.tsx — 视频详情页元数据区（导演/演员/编剧 MetaChip）
 * Server Component
 */

import { MetaChip } from '@/components/search/MetaChip'
import type { Video } from '@/types'

interface VideoDetailMetaProps {
  video: Video
}

interface MetaRowProps {
  label: string
  names: string[]
  type: 'director' | 'actor' | 'writer'
}

function MetaRow({ label, names, type }: MetaRowProps) {
  if (names.length === 0) return null
  return (
    <div className="flex gap-2 items-start">
      <span
        className="text-xs shrink-0 pt-0.5 w-12"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {names.map((name) => (
          <MetaChip key={name} label={name} type={type} />
        ))}
      </div>
    </div>
  )
}

export function VideoDetailMeta({ video }: VideoDetailMetaProps) {
  const hasAnyMeta =
    video.director.length > 0 || video.cast.length > 0 || video.writers.length > 0

  if (!hasAnyMeta) return null

  return (
    <section
      className="max-w-screen-xl mx-auto px-4 py-4 space-y-2 border-t"
      style={{ borderColor: 'var(--border)' }}
      data-testid="video-detail-meta"
    >
      <MetaRow label="导演" names={video.director} type="director" />
      <MetaRow label="演员" names={video.cast} type="actor" />
      <MetaRow label="编剧" names={video.writers} type="writer" />
    </section>
  )
}
