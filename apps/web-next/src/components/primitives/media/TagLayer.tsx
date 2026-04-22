import { cn } from '@/lib/utils'
import type { TagLayerProps, LifecycleTag, TrendingTag, SpecTag } from '@/types/tag'

// ── label maps ──────────────────────────────────────────────────────────────

const LIFECYCLE_LABELS: Record<LifecycleTag, string> = {
  new:         '新片',
  coming_soon: '即将上线',
  ongoing:     '连载中',
  completed:   '已完结',
  delisting:   '下架预警',
}

const TRENDING_LABELS: Record<TrendingTag, string> = {
  hot:          '热门',
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

// ── sub-components ──────────────────────────────────────────────────────────

const tagBase = 'text-[10px] leading-none font-semibold px-1.5 py-0.5 pointer-events-none'

function TextTag({
  label,
  variant,
}: {
  label: string
  variant: 'lifecycle' | 'trending'
}) {
  return (
    <span
      className={cn(tagBase, 'rounded')}
      style={{
        background:   `var(--tag-${variant}-bg)`,
        color:        `var(--tag-${variant}-fg)`,
        border:       `1px solid var(--tag-${variant}-border)`,
        borderRadius: 'var(--tag-border-radius)',
      }}
    >
      {label}
    </span>
  )
}

function SpecBadge({ spec }: { spec: SpecTag }) {
  return (
    <span
      className={cn(tagBase, 'rounded')}
      style={{
        background:   'var(--tag-spec-bg)',
        color:        'var(--tag-spec-fg)',
        border:       '1px solid var(--tag-spec-border)',
        borderRadius: 'var(--tag-border-radius)',
      }}
    >
      {SPEC_LABELS[spec]}
    </span>
  )
}

function RatingBadge({ value }: { value: number }) {
  return (
    <span
      className={cn(tagBase, 'rounded tabular-nums')}
      style={{
        background:   'var(--tag-rating-bg)',
        color:        'var(--accent-default)',
        border:       '1px solid var(--tag-rating-border)',
        borderRadius: 'var(--tag-border-radius)',
      }}
    >
      ★ {value.toFixed(1)}
    </span>
  )
}

// ── main component ──────────────────────────────────────────────────────────

export function TagLayer({ lifecycle, trending, specs, rating }: TagLayerProps) {
  // Left-top: lifecycle + trending (≤ 2, stacked vertically)
  const topLeftTags: React.ReactNode[] = []
  if (lifecycle) {
    topLeftTags.push(
      <TextTag key="lifecycle" label={LIFECYCLE_LABELS[lifecycle]} variant="lifecycle" />,
    )
  }
  if (trending) {
    topLeftTags.push(
      <TextTag key="trending" label={TRENDING_LABELS[trending]} variant="trending" />,
    )
  }

  // Right-bottom: specs (≤ 2, horizontal)
  const visibleSpecs = specs?.slice(0, 2) ?? []

  return (
    <>
      {/* Left-top quadrant */}
      {topLeftTags.length > 0 && (
        <div
          className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none"
          aria-hidden="true"
          data-testid="tag-layer-top-left"
        >
          {topLeftTags}
        </div>
      )}

      {/* Right-top quadrant: rating */}
      {rating && (
        <div className="absolute top-2 right-2 z-10 pointer-events-none" aria-hidden="true">
          <RatingBadge value={rating.value} />
        </div>
      )}

      {/* Right-bottom quadrant: spec icons */}
      {visibleSpecs.length > 0 && (
        <div
          className="absolute bottom-2 right-2 flex gap-1 z-10 pointer-events-none"
          aria-hidden="true"
        >
          {visibleSpecs.map((spec) => (
            <SpecBadge key={spec} spec={spec} />
          ))}
        </div>
      )}
    </>
  )
}
