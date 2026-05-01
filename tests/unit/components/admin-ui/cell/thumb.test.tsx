/**
 * Thumb 单测（CHG-DESIGN-12 12B）
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { Thumb } from '../../../../../packages/admin-ui/src/components/cell/thumb'

afterEach(() => cleanup())

describe('Thumb — 4 size variant', () => {
  it('poster-sm 默认 → 32×48', () => {
    const { container } = render(<Thumb src="x.png" />)
    const root = container.querySelector('[data-thumb]') as HTMLElement
    expect(root.getAttribute('data-size')).toBe('poster-sm')
    expect(root.style.width).toBe('32px')
    expect(root.style.height).toBe('48px')
  })

  it('poster-md → 38×56', () => {
    const { container } = render(<Thumb src="x.png" size="poster-md" />)
    const root = container.querySelector('[data-thumb]') as HTMLElement
    expect(root.style.width).toBe('38px')
    expect(root.style.height).toBe('56px')
  })

  it('banner-sm → 64×36', () => {
    const { container } = render(<Thumb src="x.png" size="banner-sm" />)
    const root = container.querySelector('[data-thumb]') as HTMLElement
    expect(root.style.width).toBe('64px')
    expect(root.style.height).toBe('36px')
  })

  it('square-sm → 28×28', () => {
    const { container } = render(<Thumb src="x.png" size="square-sm" />)
    const root = container.querySelector('[data-thumb]') as HTMLElement
    expect(root.style.width).toBe('28px')
    expect(root.style.height).toBe('28px')
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
