'use client'

import { cn } from '@/lib/utils'
import type { LifecycleTag, TrendingTag, SpecTag } from '@/types/tag'

/**
 * CornerTags — 视频卡四角标签叠层（HANDOFF-07）
 *
 * 设计契约：
 *   - 左上叠：lifecycle + trending（上下堆叠，trending 下）
 *   - 右上：rating ★ value（glass 背景 + accent 文字）
 *   - 右下：specs × 2（glass 背景 + white 文字，最多 2 个）
 *   - 绝对定位，消费方容器需 position:relative
 *   - 消费 tokens：tag-lifecycle-{subtype} / tag-trending-{subtype} / tag-spec / tag-rating / accent-default
 *   - 所有字段可选；全空时 return null
 *   - 与 M5 TagLayer 共存（用户拍板 B）：CornerTags 走**子类型**独立色（更丰富），
 *     TagLayer 走聚合色（保守）。未来统一由独立 CHORE 处理。
 *
 * 参考设计稿：docs/handoff_20260422/designs/home-b-2.html:744-776
 */

// ── label maps ──────────────────────────────────────────────────────────────

const LIFECYCLE_LABELS: Record<LifecycleTag, string> = {
  new:         '新片',
  coming_soon: '即将上线',
  ongoing:     '连载中',
  completed:   '已完结',
  delisting:   '下架',
}

const TRENDING_LABELS: Record<TrendingTag, string> = {
  hot:          '🔥 热门',
  weekly_top:   '本周 Top',
  exclusive:    '独家',
  editors_pick: '编辑推荐',
}

const SPEC_LABELS: Record<SpecTag, string> = {
  '4k':       '4K',
  hdr:        'HDR',
  dolby:      '杜比',
  subtitled:  '中字',
  multilang:  '多语',
}

// ── token key 映射（trending/lifecycle subtype → CSS variable fragment）────

const LIFECYCLE_VAR: Record<LifecycleTag, string> = {
  new:         'new',
  coming_soon: 'coming-soon',
  ongoing:     'ongoing',
  completed:   'completed',
  delisting:   'delisting',
}

const TRENDING_VAR: Record<TrendingTag, string> = {
  hot:          'hot',
  weekly_top:   'weekly-top',
  exclusive:    'exclusive',
  editors_pick: 'editor-pick',
}

// ── sub-components ──────────────────────────────────────────────────────────

const tagBase = 'text-[10px] leading-none font-bold px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap'

function LifecycleTagEl({ value }: { value: LifecycleTag }) {
  const v = LIFECYCLE_VAR[value]
  return (
    <span
      data-testid={`corner-lifecycle-${value}`}
      className={tagBase}
      style={{
        background: `var(--tag-lifecycle-${v}-bg)`,
        color:      `var(--tag-lifecycle-${v}-fg)`,
      }}
    >
      {LIFECYCLE_LABELS[value]}
    </span>
  )
}

function TrendingTagEl({ value }: { value: TrendingTag }) {
  const v = TRENDING_VAR[value]
  return (
    <span
      data-testid={`corner-trending-${value}`}
      className={tagBase}
      style={{
        background: `var(--tag-trending-${v}-bg)`,
        color:      `var(--tag-trending-${v}-fg)`,
      }}
    >
      {TRENDING_LABELS[value]}
    </span>
  )
}

function SpecBadge({ spec }: { spec: SpecTag }) {
  return (
    <span
      data-testid={`corner-spec-${spec}`}
      className={tagBase}
      style={{
        background: 'var(--tag-spec-bg)',
        color:      'var(--tag-spec-fg)',
      }}
    >
      {SPEC_LABELS[spec]}
    </span>
  )
}

function RatingBadge({ value }: { value: number }) {
  return (
    <span
      data-testid="corner-rating"
      className={cn(tagBase, 'tabular-nums')}
      style={{
        background: 'var(--tag-rating-bg)',
        color:      'var(--accent-default)',
      }}
    >
      ★ {value.toFixed(1)}
    </span>
  )
}

// ── main component ──────────────────────────────────────────────────────────

export interface CornerTagsProps {
  readonly lifecycle?: LifecycleTag
  readonly trending?: TrendingTag
  readonly rating?: number | null
  readonly specs?: readonly SpecTag[]
  /** 是否渲染 rating（Top10 卡等场景可关闭，因为 rank 徽章会占用右上位置） */
  readonly includeRating?: boolean
}

export function CornerTags({
  lifecycle,
  trending,
  rating,
  specs,
  includeRating = true,
}: CornerTagsProps) {
  const hasTopLeft = Boolean(lifecycle || trending)
  const hasRating = includeRating && rating != null
  const topSpecs = specs?.slice(0, 2)
  const hasSpecs = Boolean(topSpecs && topSpecs.length > 0)

  if (!hasTopLeft && !hasRating && !hasSpecs) return null

  return (
    <>
      {hasTopLeft && (
        <div
          data-testid="corner-tags-topleft"
          className="absolute top-2 left-2 flex flex-col gap-1 z-[2] pointer-events-none"
        >
          {lifecycle && <LifecycleTagEl value={lifecycle} />}
          {trending && <TrendingTagEl value={trending} />}
        </div>
      )}

      {hasRating && (
        <div
          data-testid="corner-tags-topright"
          className="absolute top-2 right-2 z-[2] pointer-events-none"
        >
          <RatingBadge value={rating as number} />
        </div>
      )}

      {hasSpecs && (
        <div
          data-testid="corner-tags-bottomright"
          className="absolute bottom-2 right-2 flex gap-1 z-[2] pointer-events-none"
        >
          {topSpecs!.map((s) => (
            <SpecBadge key={s} spec={s} />
          ))}
        </div>
      )}
    </>
  )
}
