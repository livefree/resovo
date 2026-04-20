/**
 * tests/unit/components/media/FallbackCover.test.tsx
 * IMG-03.5: FallbackCover 单元测试
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
}))

import { FallbackCover } from '../../../../apps/web-next/src/components/media/FallbackCover'

describe('FallbackCover — aria-label', () => {
  it('variant=poster → 默认 aria-label', () => {
    render(<FallbackCover variant="poster" />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Poster image unavailable')
  })

  it('自定义 ariaLabel 覆盖默认值', () => {
    render(<FallbackCover ariaLabel="自定义标签" />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('自定义标签')
  })
})

describe('FallbackCover — aspect ratio', () => {
  it('aspect="16:9" → style 包含 16 / 9', () => {
    const { container } = render(<FallbackCover aspect="16:9" />)
    const div = container.firstChild as HTMLElement
    expect(div.style.aspectRatio).toBe('16 / 9')
  })

  it('legacy aspectRatio prop → 原样输出', () => {
    const { container } = render(<FallbackCover aspectRatio="4 / 3" />)
    const div = container.firstChild as HTMLElement
    expect(div.style.aspectRatio).toBe('4 / 3')
  })

  it('aspect 优先级高于 aspectRatio', () => {
    const { container } = render(<FallbackCover aspect="1:1" aspectRatio="16 / 9" />)
    const div = container.firstChild as HTMLElement
    expect(div.style.aspectRatio).toBe('1 / 1')
  })
})

describe('FallbackCover — seed 渐变', () => {
  it('不传 seed → 使用 --fallback-gradient-0', () => {
    const { container } = render(<FallbackCover />)
    const div = container.firstChild as HTMLElement
    expect(div.style.background).toContain('--fallback-gradient-0')
  })

  it('相同 seed → 相同渐变变量', () => {
    const { container: a } = render(<FallbackCover seed="movie-abc" />)
    const { container: b } = render(<FallbackCover seed="movie-abc" />)
    const bgA = (a.firstChild as HTMLElement).style.background
    const bgB = (b.firstChild as HTMLElement).style.background
    expect(bgA).toBe(bgB)
  })

  it('不同 seed 可能产生不同渐变', () => {
    const seeds = ['seed-a', 'seed-b', 'seed-c', 'seed-d', 'seed-e', 'seed-f']
    const indices = seeds.map(seed => {
      const { container } = render(<FallbackCover seed={seed} />)
      const bg = (container.firstChild as HTMLElement).style.background
      return bg
    })
    const unique = new Set(indices)
    expect(unique.size).toBeGreaterThan(1)
  })
})

describe('FallbackCover — title overlay', () => {
  it('传 title → 显示标题文本', () => {
    render(<FallbackCover title="测试标题" />)
    expect(screen.getByText('测试标题')).toBeDefined()
  })

  it('传 originalTitle（无 title）→ 显示 originalTitle', () => {
    render(<FallbackCover originalTitle="原始标题" />)
    expect(screen.getByText('原始标题')).toBeDefined()
  })

  it('title 优先级高于 originalTitle', () => {
    render(<FallbackCover title="主标题" originalTitle="原始标题" />)
    expect(screen.getByText('主标题')).toBeDefined()
    expect(screen.queryByText('原始标题')).toBeNull()
  })

  it('传 type=movie → 显示类型标签"电影"', () => {
    render(<FallbackCover title="某电影" type="movie" />)
    expect(screen.getByText('电影')).toBeDefined()
  })

  it('无 title/originalTitle → 不显示底部遮罩', () => {
    const { container } = render(<FallbackCover variant="poster" />)
    expect(container.querySelector('.absolute.bottom-0')).toBeNull()
  })
})

describe('FallbackCover — data-testid', () => {
  it('透传 data-testid', () => {
    render(<FallbackCover data-testid="my-fallback" />)
    expect(screen.getByTestId('my-fallback')).toBeDefined()
  })
})
