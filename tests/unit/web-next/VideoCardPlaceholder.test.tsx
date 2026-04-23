import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoCardPlaceholder } from '@/components/primitives/video-card-placeholder'

describe('VideoCardPlaceholder · aspect 渲染', () => {
  it('默认 aspect=portrait → aspectRatio 2/3', () => {
    const { container } = render(<VideoCardPlaceholder />)
    const el = container.querySelector<HTMLElement>('[data-testid="video-card-placeholder"]')
    expect(el).not.toBeNull()
    expect(el!.dataset.aspect).toBe('portrait')
    expect(el!.style.aspectRatio).toBe('2 / 3')
  })

  it('aspect=big → aspectRatio 4/5（FeaturedRow 大卡用）', () => {
    const { container } = render(<VideoCardPlaceholder aspect="big" />)
    const el = container.querySelector<HTMLElement>('[data-testid="video-card-placeholder"]')
    expect(el!.dataset.aspect).toBe('big')
    expect(el!.style.aspectRatio).toBe('4 / 5')
  })
})

describe('VideoCardPlaceholder · 视觉契约', () => {
  it('消费 bg-surface-sunken token（低调背景，非硬编码色）', () => {
    const { container } = render(<VideoCardPlaceholder />)
    const el = container.querySelector<HTMLElement>('[data-testid="video-card-placeholder"]')
    expect(el!.style.background).toContain('--bg-surface-sunken')
  })

  it('含极弱 "···" 指示符', () => {
    render(<VideoCardPlaceholder />)
    expect(screen.getByText('···')).toBeTruthy()
  })

  it('aria-hidden 避免干扰屏幕阅读器', () => {
    const { container } = render(<VideoCardPlaceholder />)
    const el = container.querySelector<HTMLElement>('[data-testid="video-card-placeholder"]')
    expect(el!.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('VideoCardPlaceholder · 扩展性', () => {
  it('className 追加外部类（不覆盖基础类）', () => {
    const { container } = render(<VideoCardPlaceholder className="custom-wrapper" />)
    const el = container.querySelector<HTMLElement>('[data-testid="video-card-placeholder"]')
    expect(el!.className).toContain('custom-wrapper')
    expect(el!.className).toContain('rounded-lg') // 基础类保留
    expect(el!.className).toContain('w-full')
  })

  it('自定义 data-testid 覆盖默认', () => {
    render(<VideoCardPlaceholder data-testid="featured-big-placeholder" />)
    expect(screen.getByTestId('featured-big-placeholder')).toBeTruthy()
  })
})
