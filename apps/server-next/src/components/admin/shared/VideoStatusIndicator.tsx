import type { CSSProperties } from 'react'
import type { ReviewStatus, VisibilityStatus } from '@resovo/types'

export interface VideoStatusIndicatorProps {
  readonly reviewStatus?: ReviewStatus
  readonly visibilityStatus?: VisibilityStatus
  readonly isPublished: boolean
  readonly compact?: boolean
}

type Tone = 'success' | 'warning' | 'error' | 'neutral'

const TONE_BG: Record<Tone, string> = {
  success: 'var(--state-success-bg)',
  warning: 'var(--state-warning-bg)',
  error:   'var(--state-error-bg)',
  neutral: 'var(--bg-surface-elevated)',
}

const TONE_FG: Record<Tone, string> = {
  success: 'var(--state-success-fg)',
  warning: 'var(--state-warning-fg)',
  error:   'var(--state-error-fg)',
  neutral: 'var(--fg-muted)',
}

const BADGE_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px var(--space-2)',
  borderRadius: 'var(--radius-full)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 500,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
}

const DOT_BASE: CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  flexShrink: 0,
}

const WRAP_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  flexWrap: 'wrap',
}

interface BadgeProps {
  readonly tone: Tone
  readonly label: string
  readonly compact: boolean
  readonly 'data-testid': string
  readonly 'data-value': string
}

function Badge({ tone, label, compact, 'data-testid': testId, 'data-value': dataValue }: BadgeProps) {
  if (compact) {
    return (
      <span
        aria-label={label}
        data-testid={testId}
        data-value={dataValue}
        style={{ ...DOT_BASE, background: TONE_BG[tone] }}
      />
    )
  }
  return (
    <span
      data-testid={testId}
      data-value={dataValue}
      style={{ ...BADGE_BASE, background: TONE_BG[tone], color: TONE_FG[tone] }}
    >
      {label}
    </span>
  )
}

const REVIEW_TONE: Record<ReviewStatus, Tone> = {
  approved:      'success',
  rejected:      'error',
  pending_review: 'warning',
}

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  approved:      '已通过',
  rejected:      '已拒绝',
  pending_review: '待审核',
}

const VISIBILITY_TONE: Record<VisibilityStatus, Tone> = {
  public:   'success',
  internal: 'neutral',
  hidden:   'error',
}

const VISIBILITY_LABEL: Record<VisibilityStatus, string> = {
  public:   '公开',
  internal: '内部',
  hidden:   '隐藏',
}

export function VideoStatusIndicator({
  reviewStatus,
  visibilityStatus,
  isPublished,
  compact = false,
}: VideoStatusIndicatorProps) {
  return (
    <span
      data-review-status={reviewStatus}
      data-visibility={visibilityStatus}
      data-published={String(isPublished)}
      style={WRAP_STYLE}
    >
      {reviewStatus !== undefined && (
        <Badge
          tone={REVIEW_TONE[reviewStatus]}
          label={REVIEW_LABEL[reviewStatus]}
          compact={compact}
          data-testid="badge-review-status"
          data-value={reviewStatus}
        />
      )}
      {visibilityStatus !== undefined && (
        <Badge
          tone={VISIBILITY_TONE[visibilityStatus]}
          label={VISIBILITY_LABEL[visibilityStatus]}
          compact={compact}
          data-testid="badge-visibility"
          data-value={visibilityStatus}
        />
      )}
      <Badge
        tone={isPublished ? 'success' : 'neutral'}
        label={isPublished ? '已上架' : '未上架'}
        compact={compact}
        data-testid="badge-published"
        data-value={String(isPublished)}
      />
    </span>
  )
}
