/**
 * Thumb 单测（CHG-DESIGN-12 12B）
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { Thumb } from '../../../../../packages/admin-ui/src/components/cell/thumb'
import { adminCover } from '../../../../../packages/design-tokens/src/admin-layout/cover'

afterEach(() => cleanup())

describe('Thumb — 6 size variant（CHG-UX2-02 接入 admin-layout/cover token + 加 poster-xl）', () => {
  it('poster-sm 默认 → var(--cover-poster-sm-{w|h}) (32×48)', () => {
    const { container } = render(<Thumb src="x.png" />)
    const root = container.querySelector('[data-thumb]') as HTMLElement
    expect(root.getAttribute('data-size')).toBe('poster-sm')
    expect(root.style.width).toBe('var(--cover-poster-sm-w)')
    expect(root.style.height).toBe('var(--cover-poster-sm-h)')
  })

  it('poster-md → var(--cover-poster-md-{w|h}) (CHG-UX2-01 校准 38×56 → 48×72)', () => {
    const { container } = render(<Thumb src="x.png" size="poster-md" />)
    const root = container.querySelector('[data-thumb]') as HTMLElement
    expect(root.style.width).toBe('var(--cover-poster-md-w)')
    expect(root.style.height).toBe('var(--cover-poster-md-h)')
  })

  it('poster-lg → var(--cover-poster-lg-{w|h}) (80×120; v1.6 G6 审核台中央海报)', () => {
    const { container } = render(<Thumb src="x.png" size="poster-lg" />)
    const root = container.querySelector('[data-thumb]') as HTMLElement
    expect(root.getAttribute('data-size')).toBe('poster-lg')
    expect(root.style.width).toBe('var(--cover-poster-lg-w)')
    expect(root.style.height).toBe('var(--cover-poster-lg-h)')
  })

  it('poster-xl → var(--cover-poster-xl-{w|h}) (120×180; CHG-UX2-01 新增详情页 hero)', () => {
    const { container } = render(<Thumb src="x.png" size="poster-xl" />)
    const root = container.querySelector('[data-thumb]') as HTMLElement
    expect(root.getAttribute('data-size')).toBe('poster-xl')
    expect(root.style.width).toBe('var(--cover-poster-xl-w)')
    expect(root.style.height).toBe('var(--cover-poster-xl-h)')
    // poster-xl borderRadius 改 md（其余 sm）
    expect(root.style.borderRadius).toBe('var(--radius-md)')
  })

  it('banner-sm → var(--cover-banner-sm-{w|h}) (64×36)', () => {
    const { container } = render(<Thumb src="x.png" size="banner-sm" />)
    const root = container.querySelector('[data-thumb]') as HTMLElement
    expect(root.style.width).toBe('var(--cover-banner-sm-w)')
    expect(root.style.height).toBe('var(--cover-banner-sm-h)')
  })

  it('square-sm → var(--cover-square-sm-{w|h}) (28×28)', () => {
    const { container } = render(<Thumb src="x.png" size="square-sm" />)
    const root = container.querySelector('[data-thumb]') as HTMLElement
    expect(root.style.width).toBe('var(--cover-square-sm-w)')
    expect(root.style.height).toBe('var(--cover-square-sm-h)')
  })
})

describe('Thumb — src 渲染分支', () => {
  it('src 非空 → 渲染 <img> + data-state="has-src"', () => {
    const { container } = render(<Thumb src="https://example.com/x.png" />)
    const root = container.querySelector('[data-thumb]') as HTMLElement
    expect(root.getAttribute('data-state')).toBe('has-src')
    const img = root.querySelector('img') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('https://example.com/x.png')
  })

  it('src 空字符串 → placeholder + data-state="placeholder"', () => {
    const { container } = render(<Thumb src="" />)
    const root = container.querySelector('[data-thumb]') as HTMLElement
    expect(root.getAttribute('data-state')).toBe('placeholder')
    expect(root.querySelector('img')).toBeNull()
  })

  it('src null → placeholder', () => {
    const { container } = render(<Thumb src={null} />)
    expect(container.querySelector('[data-thumb]')?.getAttribute('data-state')).toBe('placeholder')
  })

  it('src undefined → placeholder', () => {
    const { container } = render(<Thumb />)
    expect(container.querySelector('[data-thumb]')?.getAttribute('data-state')).toBe('placeholder')
  })

  it('src 空 + fallback ReactNode → 渲染 fallback', () => {
    const { container } = render(<Thumb src={null} fallback={<span data-test-fallback>无图</span>} />)
    expect(container.querySelector('[data-test-fallback]')).toBeTruthy()
  })

  it('src 非空 + fallback → fallback 不渲染（src 优先）', () => {
    const { container } = render(<Thumb src="x.png" fallback={<span data-test-fallback />} />)
    expect(container.querySelector('[data-test-fallback]')).toBeNull()
  })
})

describe('Thumb — decorative + a11y', () => {
  it('decorative=true 默认 → img alt="" + aria-hidden=true', () => {
    const { container } = render(<Thumb src="x.png" alt="忽略" />)
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('aria-hidden')).toBe('true')
  })

  it('decorative=false + alt 存在 → img alt={alt} + 无 aria-hidden', () => {
    const { container } = render(<Thumb src="x.png" alt="电影封面" decorative={false} />)
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('alt')).toBe('电影封面')
    expect(img.getAttribute('aria-hidden')).toBeNull()
  })

  it('decorative=false + alt 缺失 → console.warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<Thumb src="x.png" decorative={false} />)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/decorative=false but alt is empty/)
    warn.mockRestore()
  })

  it('decorative=false + placeholder → role=img + aria-label fallback', () => {
    const { container } = render(<Thumb decorative={false} alt="封面" />)
    const root = container.querySelector('[data-thumb]') as HTMLElement
    expect(root.getAttribute('role')).toBe('img')
    expect(root.getAttribute('aria-label')).toBe('封面')
  })
})

describe('Thumb — loading 策略 + 测试钩子', () => {
  it('loading 默认 lazy', () => {
    const { container } = render(<Thumb src="x.png" />)
    expect(container.querySelector('img')?.getAttribute('loading')).toBe('lazy')
  })

  it('loading 自定义 eager', () => {
    const { container } = render(<Thumb src="x.png" loading="eager" />)
    expect(container.querySelector('img')?.getAttribute('loading')).toBe('eager')
  })

  it('testId → data-testid', () => {
    const { container } = render(<Thumb src="x.png" testId="thumb-1" />)
    expect(container.querySelector('[data-testid="thumb-1"]')).toBeTruthy()
  })
})

/**
 * CHG-UX2-03f：img 必须带 HTML width/height attribute（intrinsic size），
 * 否则浏览器 fallback 到图源 naturalWidth/Height，flex algorithm 据此算 main size，
 * 导致 img 在 flex item 位置 width 退化。SIZE_PX 真源是 design-tokens cover.ts，
 * thumb 内部 number 表必须与之对齐 — 本组测试是同步守卫。
 */
describe('Thumb — img HTML width/height attribute（CHG-UX2-03f intrinsic size 修复）', () => {
  const cases: Array<{ size: Parameters<typeof Thumb>[0]['size']; w: number; h: number }> = [
    { size: 'poster-sm', w: 32, h: 48 },
    { size: 'poster-md', w: 48, h: 72 },
    { size: 'poster-lg', w: 80, h: 120 },
    { size: 'poster-xl', w: 120, h: 180 },
    { size: 'banner-sm', w: 64, h: 36 },
    { size: 'square-sm', w: 28, h: 28 },
  ]

  for (const c of cases) {
    it(`${c.size} → img width=${c.w} height=${c.h}`, () => {
      const { container } = render(<Thumb src="x.png" size={c.size} />)
      const img = container.querySelector('img')!
      expect(img.getAttribute('width')).toBe(String(c.w))
      expect(img.getAttribute('height')).toBe(String(c.h))
    })

    it(`${c.size} number 与 design-tokens cover.ts ${c.size === 'poster-sm' ? 'cover-poster-sm' : `cover-${c.size}`}-{w,h} 一致`, () => {
      const sizeKey = c.size
      const wToken = adminCover[`cover-${sizeKey}-w` as keyof typeof adminCover]
      const hToken = adminCover[`cover-${sizeKey}-h` as keyof typeof adminCover]
      expect(parseInt(wToken, 10)).toBe(c.w)
      expect(parseInt(hToken, 10)).toBe(c.h)
    })
  }

  /**
   * CHG-UX2-06 Y4 加固：对称性断言 — design-tokens cover.ts 新增 size 槽位时
   * thumb.tsx SIZE_PX 必须同步加 entry，否则本断言 fail（防"真源补 token 但
   * thumb 漏跟进"漂移场景）。配合上面"逐 size value 等价"测试 = 双向守卫。
   */
  it('design-tokens adminCover 槽位数 / 命名 与 thumb.tsx SIZE_PX 对称（防漏增）', () => {
    const tokenSizes = new Set(
      Object.keys(adminCover)
        .filter((k) => k.endsWith('-w'))
        .map((k) => k.replace(/^cover-/, '').replace(/-w$/, ''))
    )
    const thumbSizes = new Set(cases.map((c) => c.size))
    // 双向集合相等
    expect([...tokenSizes].sort()).toEqual([...thumbSizes].sort())
  })
})
