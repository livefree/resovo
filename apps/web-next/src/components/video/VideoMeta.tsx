'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MetaChip } from '@/components/search/MetaChip'
import type { Video } from '@resovo/types'

const VIDEO_TYPE_LABEL: Record<string, string> = {
  movie:       '电影',
  series:      '剧集',
  anime:       '动漫',
  variety:     '综艺',
  documentary: '纪录片',
  short:       '短剧',
  sports:      '体育',
  music:       '音乐',
  news:        '新闻',
  kids:        '少儿',
  other:       '其他',
}

interface MetaRowProps {
  label: string
  names: string[]
  type: 'director' | 'actor' | 'writer'
}

function MetaRow({ label, names, type }: MetaRowProps) {
  if (names.length === 0) return null
  return (
    <div className="flex gap-2 items-start" data-testid={`meta-row-${type}`}>
      <span
        className="text-xs shrink-0 pt-0.5 w-10"
        style={{ color: 'var(--fg-muted)' }}
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

interface VideoMetaProps {
  video: Video
  isLoggedIn?: boolean
  className?: string
}

export function VideoMeta({ video, isLoggedIn = false, className }: VideoMetaProps) {
  const [isFavorited, setIsFavorited] = useState(false)
  const [isTracking, setIsTracking] = useState(false)

  function handleFavorite() {
    if (!isLoggedIn) return
    setIsFavorited((v) => !v)
  }

  function handleTrack() {
    if (!isLoggedIn) return
    setIsTracking((v) => !v)
  }

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      void navigator.share({ title: video.title, url: window.location.href })
    } else if (typeof navigator !== 'undefined') {
      void navigator.clipboard.writeText(window.location.href)
    }
  }

  const typeLabel = VIDEO_TYPE_LABEL[video.type] ?? video.type

  return (
    <section
      className={cn('space-y-3', className)}
      data-testid="video-meta"
    >
      <div>
        <h1
          className="text-lg font-bold leading-tight"
          style={{ color: 'var(--fg-default)' }}
          data-testid="video-meta-title"
        >
          {video.title}
        </h1>
        {video.titleEn && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            {video.titleEn}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="video-meta-tags">
          <span
            data-testid="meta-chip-type"
            className="inline-flex items-center px-2 py-0.5 rounded text-xs"
            style={{ color: 'var(--fg-muted)', border: '1px solid var(--border-default)' }}
          >
            {typeLabel}
          </span>
          {video.year && (
            <MetaChip label={String(video.year)} type="year" />
          )}
          {video.country && (
            <MetaChip label={video.country} type="country" />
          )}
          {video.genres.map((g) => (
            <MetaChip key={g} label={g} type="genre" />
          ))}
          {video.rating && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
              style={{ background: 'var(--accent-default)', color: 'black' }}
              data-testid="video-meta-rating"
            >
              ★ {video.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" data-testid="video-meta-actions">
        <button
          onClick={handleFavorite}
          disabled={!isLoggedIn}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          style={
            isFavorited
              ? { background: 'var(--accent-default)', color: 'black' }
              : { background: 'var(--bg-surface-sunken)', color: 'var(--fg-default)', border: '1px solid var(--border-default)' }
          }
          aria-pressed={isFavorited}
          data-testid="video-meta-favorite-btn"
        >
          {isFavorited ? '♥ 已收藏' : '♡ 收藏'}
        </button>

        {video.episodeCount > 1 && (
          <button
            onClick={handleTrack}
            disabled={!isLoggedIn}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            style={
              isTracking
                ? { background: 'var(--accent-default)', color: 'black' }
                : { background: 'var(--bg-surface-sunken)', color: 'var(--fg-default)', border: '1px solid var(--border-default)' }
            }
            aria-pressed={isTracking}
            data-testid="video-meta-track-btn"
          >
            {isTracking ? '✓ 追剧中' : '+ 追剧'}
          </button>
        )}

        <button
          onClick={handleShare}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{ background: 'var(--bg-surface-sunken)', color: 'var(--fg-default)', border: '1px solid var(--border-default)' }}
          data-testid="video-meta-share-btn"
        >
          ↗ 分享
        </button>

        <button
          disabled={!isLoggedIn}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: 'var(--fg-muted)', border: '1px solid var(--border-default)' }}
          data-testid="video-meta-report-btn"
        >
          ⚑ 举报
        </button>
      </div>

      {(video.director.length > 0 || video.cast.length > 0 || video.writers.length > 0) && (
        <div className="space-y-1.5 pt-1 border-t" style={{ borderColor: 'var(--border-default)' }}>
          <MetaRow label="导演" names={video.director} type="director" />
          <MetaRow label="演员" names={video.cast} type="actor" />
          <MetaRow label="编剧" names={video.writers} type="writer" />
        </div>
      )}

      {video.description && (
        <p
          className="text-xs leading-relaxed line-clamp-3 pt-1 border-t"
          style={{ color: 'var(--fg-muted)', borderColor: 'var(--border-default)' }}
          data-testid="video-meta-description"
        >
          {video.description}
        </p>
      )}
    </section>
  )
}
