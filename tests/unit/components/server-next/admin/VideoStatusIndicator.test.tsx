/**
 * VideoStatusIndicator + VideoTypeChip 单元测试（CHG-SN-3-02）
 *
 * 覆盖：
 * - reviewStatus 3 variant / visibilityStatus 3 variant / isPublished 2 variant
 * - reviewStatus 未传 → 不渲染 review badge
 * - visibilityStatus 未传 → 不渲染 visibility badge
 * - compact 模式：dot + aria-label
 * - data-testid / data-value 属性
 * - VideoTypeChip 11 种类型标签
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import {
  VideoStatusIndicator,
} from '../../../../../apps/server-next/src/components/admin/shared/VideoStatusIndicator'
import {
  VideoTypeChip,
} from '../../../../../apps/server-next/src/components/admin/shared/VideoTypeChip'
import type { ReviewStatus, VisibilityStatus, VideoType } from '@resovo/types'

afterEach(() => {
  cleanup()
})

// ── VideoStatusIndicator — badge 渲染 ────────────────────────────

describe('VideoStatusIndicator — review badge', () => {
  const cases: Array<[ReviewStatus, string]> = [
    ['approved',       '已通过'],
    ['rejected',       '已拒绝'],
    ['pending_review', '待审核'],
  ]

  it.each(cases)('reviewStatus=%s → label=%s', (status, label) => {
    render(
      <VideoStatusIndicator
        reviewStatus={status}
        isPublished={true}
      />,
    )
    const badge = screen.getByTestId('badge-review-status')
    expect(badge.textContent).toBe(label)
    expect(badge.getAttribute('data-value')).toBe(status)
  })

  it('reviewStatus 未传 → 不渲染 badge-review-status', () => {
    const { container } = render(<VideoStatusIndicator isPublished={false} />)
    expect(container.querySelector('[data-testid="badge-review-status"]')).toBeNull()
  })
})

describe('VideoStatusIndicator — visibility badge', () => {
  const cases: Array<[VisibilityStatus, string]> = [
    ['public',   '公开'],
    ['internal', '内部'],
    ['hidden',   '隐藏'],
  ]

  it.each(cases)('visibilityStatus=%s → label=%s', (status, label) => {
    render(
      <VideoStatusIndicator
        visibilityStatus={status}
        isPublished={false}
      />,
    )
    const badge = screen.getByTestId('badge-visibility')
    expect(badge.textContent).toBe(label)
    expect(badge.getAttribute('data-value')).toBe(status)
  })

  it('visibilityStatus 未传 → 不渲染 badge-visibility', () => {
    const { container } = render(<VideoStatusIndicator isPublished={true} />)
    expect(container.querySelector('[data-testid="badge-visibility"]')).toBeNull()
  })
})

describe('VideoStatusIndicator — published badge', () => {
  it('isPublished=true → "已上架"', () => {
    render(<VideoStatusIndicator isPublished={true} />)
    expect(screen.getByTestId('badge-published').textContent).toBe('已上架')
  })

  it('isPublished=false → "未上架"', () => {
    render(<VideoStatusIndicator isPublished={false} />)
    expect(screen.getByTestId('badge-published').textContent).toBe('未上架')
  })
})

describe('VideoStatusIndicator — data-* root attributes', () => {
  it('根节点含 data-review-status / data-visibility / data-published', () => {
    const { container } = render(
      <VideoStatusIndicator
        reviewStatus="approved"
        visibilityStatus="public"
        isPublished={true}
      />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('data-review-status')).toBe('approved')
    expect(root.getAttribute('data-visibility')).toBe('public')
    expect(root.getAttribute('data-published')).toBe('true')
  })
})

describe('VideoStatusIndicator — compact 模式', () => {
  it('compact=true → badge 无文字，有 aria-label + dot style', () => {
    render(
      <VideoStatusIndicator
        reviewStatus="pending_review"
        visibilityStatus="hidden"
        isPublished={false}
        compact
      />,
    )
    const reviewDot = screen.getByTestId('badge-review-status')
    expect(reviewDot.textContent).toBe('')
    expect(reviewDot.getAttribute('aria-label')).toBe('待审核')

    const visibilityDot = screen.getByTestId('badge-visibility')
    expect(visibilityDot.textContent).toBe('')
    expect(visibilityDot.getAttribute('aria-label')).toBe('隐藏')

    const publishedDot = screen.getByTestId('badge-published')
    expect(publishedDot.textContent).toBe('')
    expect(publishedDot.getAttribute('aria-label')).toBe('未上架')
  })
})

describe('VideoStatusIndicator — tone → CSS 变量', () => {
  it('approved → state-success-bg / state-success-fg', () => {
    const { container } = render(
      <VideoStatusIndicator reviewStatus="approved" isPublished={true} />,
    )
    const badge = container.querySelector('[data-testid="badge-review-status"]') as HTMLElement
    expect(badge.style.background).toContain('--state-success-bg')
    expect(badge.style.color).toContain('--state-success-fg')
  })

  it('rejected → state-error-bg / state-error-fg', () => {
    const { container } = render(
      <VideoStatusIndicator reviewStatus="rejected" isPublished={false} />,
    )
    const badge = container.querySelector('[data-testid="badge-review-status"]') as HTMLElement
    expect(badge.style.background).toContain('--state-error-bg')
    expect(badge.style.color).toContain('--state-error-fg')
  })

  it('pending_review → state-warning-bg / state-warning-fg', () => {
    const { container } = render(
      <VideoStatusIndicator reviewStatus="pending_review" isPublished={false} />,
    )
    const badge = container.querySelector('[data-testid="badge-review-status"]') as HTMLElement
    expect(badge.style.background).toContain('--state-warning-bg')
    expect(badge.style.color).toContain('--state-warning-fg')
  })
})

// ── VideoTypeChip ─────────────────────────────────────────────────

describe('VideoTypeChip — 中文标签映射', () => {
  const cases: Array<[VideoType, string]> = [
    ['movie',       '电影'],
    ['series',      '剧集'],
    ['anime',       '动漫'],
    ['variety',     '综艺'],
    ['documentary', '纪录片'],
    ['short',       '短片'],
    ['sports',      '体育'],
    ['music',       '音乐'],
    ['news',        '新闻'],
    ['kids',        '少儿'],
    ['other',       '其他'],
  ]

  it.each(cases)('type=%s → label=%s', (type, label) => {
    render(<VideoTypeChip type={type} />)
    const chip = screen.getByTestId('video-type-chip')
    expect(chip.textContent).toBe(label)
    expect(chip.getAttribute('data-type')).toBe(type)
  })

  it('使用 state-info-bg / state-info-fg 颜色变量', () => {
    const { container } = render(<VideoTypeChip type="movie" />)
    const chip = container.querySelector('[data-testid="video-type-chip"]') as HTMLElement
    expect(chip.style.background).toContain('--state-info-bg')
    expect(chip.style.color).toContain('--state-info-fg')
  })
})
