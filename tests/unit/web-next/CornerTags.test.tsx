import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CornerTags } from '@/components/primitives/corner-tags'
import type { LifecycleTag, TrendingTag, SpecTag } from '@/types/tag'

function wrap(node: React.ReactNode) {
  return render(<div style={{ position: 'relative' }}>{node}</div>)
}

// ── lifecycle 独立 ───────────────────────────────────────────────────────
describe('CornerTags · lifecycle', () => {
  const LIFECYCLE_CASES: Array<[LifecycleTag, string]> = [
    ['new', '新片'],
    ['coming_soon', '即将上线'],
    ['ongoing', '连载中'],
    ['completed', '已完结'],
    ['delisting', '下架'],
  ]

  for (const [value, label] of LIFECYCLE_CASES) {
    it(`${value} 显示 "${label}" 并引用 tag-lifecycle-${value.replace('_', '-')} tokens`, () => {
      const { container } = wrap(<CornerTags lifecycle={value} />)
      expect(screen.getByText(label)).toBeTruthy()
      const el = container.querySelector<HTMLElement>(`[data-testid="corner-lifecycle-${value}"]`)
      expect(el).not.toBeNull()
      const varFragment = value.replace('_', '-')
      expect(el!.style.background).toContain(`--tag-lifecycle-${varFragment}-bg`)
    })
  }
})

// ── trending 独立 ────────────────────────────────────────────────────────
describe('CornerTags · trending', () => {
  const TRENDING_CASES: Array<[TrendingTag, string]> = [
    ['hot', '🔥 热门'],
    ['weekly_top', '本周 Top'],
    ['exclusive', '独家'],
    ['editors_pick', '编辑推荐'],
  ]

  for (const [value, label] of TRENDING_CASES) {
    it(`${value} 显示 "${label}"`, () => {
      wrap(<CornerTags trending={value} />)
      expect(screen.getByText(label)).toBeTruthy()
    })
  }
})

// ── rating ───────────────────────────────────────────────────────────────
describe('CornerTags · rating', () => {
  it('rating 8.4 显示 "★ 8.4"', () => {
    wrap(<CornerTags rating={8.4} />)
    expect(screen.getByTestId('corner-rating').textContent).toBe('★ 8.4')
  })

  it('rating 9 → "★ 9.0"（toFixed(1) 保证稳定格式）', () => {
    wrap(<CornerTags rating={9} />)
    expect(screen.getByTestId('corner-rating').textContent).toBe('★ 9.0')
  })

  it('rating=null 不渲染 rating 区块', () => {
    wrap(<CornerTags rating={null} />)
    expect(screen.queryByTestId('corner-rating')).toBeNull()
  })

  it('includeRating=false 即使有 rating 也不渲染', () => {
    wrap(<CornerTags rating={8.0} includeRating={false} />)
    expect(screen.queryByTestId('corner-rating')).toBeNull()
  })
})

// ── specs ────────────────────────────────────────────────────────────────
describe('CornerTags · specs', () => {
  it('单 spec 渲染一个 badge', () => {
    wrap(<CornerTags specs={['4k']} />)
    expect(screen.getByTestId('corner-spec-4k').textContent).toBe('4K')
  })

  it('多 spec 保留顺序，最多 2 个（slice 0,2）', () => {
    const specs: SpecTag[] = ['4k', 'hdr', 'dolby', 'subtitled']
    wrap(<CornerTags specs={specs} />)
    expect(screen.getByTestId('corner-spec-4k')).toBeTruthy()
    expect(screen.getByTestId('corner-spec-hdr')).toBeTruthy()
    // 第 3、4 个不渲染
    expect(screen.queryByTestId('corner-spec-dolby')).toBeNull()
    expect(screen.queryByTestId('corner-spec-subtitled')).toBeNull()
  })

  it('specs 空数组 → 右下区块 null', () => {
    const { container } = wrap(<CornerTags specs={[]} />)
    expect(container.querySelector('[data-testid="corner-tags-bottomright"]')).toBeNull()
  })
})

// ── 组合 ─────────────────────────────────────────────────────────────────
describe('CornerTags · 组合 / 空态 / 布局', () => {
  it('全字段组合：左上叠 lifecycle+trending、右上 rating、右下 specs', () => {
    wrap(
      <CornerTags
        lifecycle="ongoing"
        trending="hot"
        rating={8.5}
        specs={['4k', 'hdr']}
      />,
    )
    // 三区块都就位
    expect(screen.getByTestId('corner-tags-topleft')).toBeTruthy()
    expect(screen.getByTestId('corner-tags-topright')).toBeTruthy()
    expect(screen.getByTestId('corner-tags-bottomright')).toBeTruthy()
    // 左上叠两个子 tag
    expect(screen.getByText('连载中')).toBeTruthy()
    expect(screen.getByText('🔥 热门')).toBeTruthy()
    expect(screen.getByText('★ 8.5')).toBeTruthy()
    expect(screen.getByText('4K')).toBeTruthy()
    expect(screen.getByText('HDR')).toBeTruthy()
  })

  it('全空（无 props）→ 整个 return null，父容器内无 corner-* 元素', () => {
    const { container } = wrap(<CornerTags />)
    expect(container.querySelectorAll('[data-testid^="corner-"]').length).toBe(0)
  })

  it('仅 lifecycle → 只有左上区块', () => {
    wrap(<CornerTags lifecycle="new" />)
    expect(screen.getByTestId('corner-tags-topleft')).toBeTruthy()
    expect(screen.queryByTestId('corner-tags-topright')).toBeNull()
    expect(screen.queryByTestId('corner-tags-bottomright')).toBeNull()
  })

  it('仅 rating → 只有右上区块', () => {
    wrap(<CornerTags rating={7.2} />)
    expect(screen.queryByTestId('corner-tags-topleft')).toBeNull()
    expect(screen.getByTestId('corner-tags-topright')).toBeTruthy()
    expect(screen.queryByTestId('corner-tags-bottomright')).toBeNull()
  })

  it('仅 trending（无 lifecycle）→ 左上区块仍渲染（trending 单独存在）', () => {
    wrap(<CornerTags trending="exclusive" />)
    expect(screen.getByTestId('corner-tags-topleft')).toBeTruthy()
    expect(screen.getByText('独家')).toBeTruthy()
  })
})
