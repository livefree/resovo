/**
 * VideoMeta.tsx — 播放页视频信息区
 * PLAYER-08: 导演/演员/编剧 MetaChip + 操作按钮
 * Client Component（MetaChip 需要 useRouter）
 */

'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MetaChip } from '@/components/search/MetaChip'
import type { Video } from '@/types'

// ── 类型映射 ──────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────

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

// ── Props ─────────────────────────────────────────────────────────

interface VideoMetaProps {
  video: Video
  isLoggedIn?: boolean
  className?: string
}

// ── Component ─────────────────────────────────────────────────────

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
      {/* 标题 + 基础信息行 */}
      <div>
        <h1
          className="text-lg font-bold leading-tight"
          style={{ color: 'var(--foreground)' }}
          data-testid="video-meta-title"
        >
          {video.title}
        </h1>
        {video.titleEn && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {video.titleEn}
          </p>
        )}

        {/* 标签行：类型 + 年份 + 地区 + 评分 */}
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="video-meta-tags">
          <span
            data-testid="meta-chip-type"
            className="inline-flex items-center px-2 py-0.5 rounded text-xs"
            style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
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
              style={{ background: 'var(--gold, #e8b84b)', color: 'black' }}
              data-testid="video-meta-rating"
            >
              ★ {video.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* 操作按钮行 */}
      <div className="flex flex-wrap gap-2" data-testid="video-meta-actions">
        {/* 收藏 */}
        <button
          onClick={handleFavorite}
          disabled={!isLoggedIn}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          style={
            isFavorited
              ? { background: 'var(--gold, #e8b84b)', color: 'black' }
              : { background: 'var(--secondary)', color: 'var(--foreground)', border: '1px solid var(--border)' }
          }
          aria-pressed={isFavorited}
          data-testid="video-meta-favorite-btn"
        >
          {isFavorited ? '♥ 已收藏' : '♡ 收藏'}
        </button>

        {/* 追剧（仅多集视频） */}
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
                ? { background: 'var(--gold, #e8b84b)', color: 'black' }
                : { background: 'var(--secondary)', color: 'var(--foreground)', border: '1px solid var(--border)' }
            }
            aria-pressed={isTracking}
            data-testid="video-meta-track-btn"
          >
            {isTracking ? '✓ 追剧中' : '+ 追剧'}
          </button>
        )}

        {/* 分享 */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{ background: 'var(--secondary)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          data-testid="video-meta-share-btn"
        >
          ↗ 分享
        </button>

        {/* 举报（未登录 disabled） */}
        <button
          disabled={!isLoggedIn}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
          data-testid="video-meta-report-btn"
        >
          ⚑ 举报
        </button>
      </div>

      {/* 人员信息行 */}
      {(video.director.length > 0 || video.cast.length > 0 || video.writers.length > 0) && (
        <div className="space-y-1.5 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
          <MetaRow label="导演" names={video.director} type="director" />
          <MetaRow label="演员" names={video.cast} type="actor" />
          <MetaRow label="编剧" names={video.writers} type="writer" />
        </div>
      )}

      {/* 简介 */}
      {video.description && (
        <p
          className="text-xs leading-relaxed line-clamp-3 pt-1 border-t"
          style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}
          data-testid="video-meta-description"
        >
          {video.description}
        </p>
      )}
    </section>
  )
}
