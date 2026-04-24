'use client'

/**
 * EpisodePicker — HANDOFF-17 对齐 docs/frontend_design_spec_20260423.md §14
 *
 * Token 消费（spec §14）：
 *   Episode grid    → repeat(10, 1fr)
 *   Episode 高度    → var(--detail-ep-h)          42px
 *   Episode gap     → var(--detail-ep-gap)         8px
 *   标题-范围间距   → var(--detail-ep-range-gap)   16px
 *   范围项间距      → var(--detail-ep-range-item)  4px
 */

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import type { Video } from '@resovo/types'

/** 每个范围显示集数 */
const RANGE_SIZE = 10

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

  /** 当前激活的范围起始集（0-indexed range, 1-indexed episodes） */
  const [rangeStart, setRangeStart] = useState(() => {
    const ep = Number(searchParams.get('ep'))
    const active = ep >= 1 && ep <= video.episodeCount ? ep : 1
    return Math.floor((active - 1) / RANGE_SIZE) * RANGE_SIZE + 1
  })

  const needsRanges = video.episodeCount > RANGE_SIZE

  /** 生成范围标签列表，e.g. [{start:1,end:10}, {start:11,end:20}] */
  const ranges = needsRanges
    ? Array.from(
        { length: Math.ceil(video.episodeCount / RANGE_SIZE) },
        (_, i) => ({
          start: i * RANGE_SIZE + 1,
          end: Math.min((i + 1) * RANGE_SIZE, video.episodeCount),
        })
      )
    : []

  /** 当前范围内的集数列表 */
  const visibleEps = needsRanges
    ? Array.from(
        { length: Math.min(RANGE_SIZE, video.episodeCount - rangeStart + 1) },
        (_, i) => rangeStart + i
      )
    : Array.from({ length: video.episodeCount }, (_, i) => i + 1)

  function handleSelect(ep: number) {
    setActiveEp(ep)
    router.replace(`?ep=${ep}`, { scroll: false })
    onEpisodeChange?.(ep)
  }

  function handleRangeChange(start: number) {
    setRangeStart(start)
  }

  if (video.episodeCount <= 1) return null

  return (
    <section
      data-testid="episode-picker"
      className="border-t"
      style={{ borderColor: 'var(--border-default)' }}
    >
      <div className="max-w-feature mx-auto px-6 py-6">
        {/* 标题 + 范围切换 */}
        <div
          className="flex items-center flex-wrap"
          style={{ marginBottom: 'var(--detail-ep-range-gap)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--fg-default)', marginRight: 'var(--detail-ep-range-gap)' }}>
            选集（共 {video.episodeCount} 集）
          </h2>
          {needsRanges && (
            <div className="flex items-center flex-wrap" style={{ gap: 'var(--detail-ep-range-item)' }}>
              {ranges.map((r) => {
                const isActive = rangeStart === r.start
                return (
                  <button
                    key={r.start}
                    type="button"
                    onClick={() => handleRangeChange(r.start)}
                    data-testid={`episode-range-${r.start}`}
                    className="rounded text-xs transition-colors border"
                    style={{
                      padding: 'var(--space-1) var(--space-2)',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--accent-default)' : 'var(--fg-muted)',
                      background: isActive ? 'var(--accent-muted)' : 'transparent',
                      borderColor: isActive ? 'var(--accent-default)' : 'var(--border-default)',
                      cursor: 'pointer',
                    }}
                  >
                    {r.start}–{r.end}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Episode 网格：mobile=5列，≥768=10列 */}
        <div className="detail-ep-grid">
          {visibleEps.map((ep) => (
            <button
              key={ep}
              type="button"
              onClick={() => handleSelect(ep)}
              data-testid={`episode-btn-${ep}`}
              className={cn(
                'flex items-center justify-center rounded text-sm font-medium',
                'transition-colors border',
              )}
              style={{
                height: 'var(--detail-ep-h)',
                ...(activeEp === ep
                  ? { background: 'var(--accent-default)', color: 'var(--accent-fg)', borderColor: 'transparent' }
                  : { background: 'var(--bg-surface-sunken)', color: 'var(--fg-default)', borderColor: 'var(--border-default)' }
                ),
              }}
              aria-pressed={activeEp === ep}
            >
              {ep}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function EpisodePickerSkeleton() {
  return (
    <div className="border-t" style={{ borderColor: 'var(--border-default)' }}>
      <div className="max-w-feature mx-auto px-6 py-6">
        <Skeleton shape="text" width={128} height={16} className="mb-4" />
        <div className="detail-ep-grid">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} shape="rect" style={{ height: 'var(--detail-ep-h)' }} delay={300} />
          ))}
        </div>
      </div>
    </div>
  )
}

EpisodePicker.Skeleton = EpisodePickerSkeleton
