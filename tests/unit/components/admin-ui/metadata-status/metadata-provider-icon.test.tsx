/**
 * metadata-provider-icon.test.tsx — MetadataProviderIcon 五态原语单测（META-33-A / ADR-201）
 *
 * 覆盖：4 源 logo 复用 / 五态视觉档位（灰显 + 黄/红角标 token）/ href 链接门控 / a11y title 派生 /
 *       零硬编码色（角标用 --state-*-fg token）。
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { MetadataProviderIcon } from '../../../../../packages/admin-ui/src/components/metadata-status/metadata-provider-icon'
import { SOURCE_LOGO_DATA_URI } from '../../../../../packages/admin-ui/src/components/enrichment-badge/enrichment-logos'

afterEach(() => cleanup())

function icon(c: HTMLElement) {
  return c.querySelector('[data-metadata-provider-icon]') as HTMLElement
}

describe('MetadataProviderIcon — logo 资产复用 + data attribute', () => {
  it('4 源各渲染对应 data-URI logo（复用 enrichment-logos，不重绘）', () => {
    for (const provider of ['douban', 'bangumi', 'tmdb', 'imdb'] as const) {
      const { container } = render(<MetadataProviderIcon provider={provider} state="applied" />)
      const img = icon(container).querySelector('img') as HTMLImageElement
      expect(img.getAttribute('src')).toBe(SOURCE_LOGO_DATA_URI[provider])
      expect(icon(container).getAttribute('data-provider')).toBe(provider)
      cleanup()
    }
  })

  it('data-state / data-size / testId', () => {
    const { container } = render(
      <MetadataProviderIcon provider="douban" state="candidate" size="md" testId="mpi-1" />,
    )
    const el = icon(container)
    expect(el.getAttribute('data-state')).toBe('candidate')
    expect(el.getAttribute('data-size')).toBe('md')
    expect(el.getAttribute('data-testid')).toBe('mpi-1')
  })
})

describe('MetadataProviderIcon — 五态视觉档位', () => {
  it('applied → 无灰显 / 无角标', () => {
    const { container } = render(<MetadataProviderIcon provider="douban" state="applied" />)
    const img = icon(container).querySelector('img') as HTMLImageElement
    expect(img.style.filter).toBe('')
    expect(icon(container).querySelector('[data-state-dot]')).toBeNull()
  })

  it('candidate → 黄点 var(--state-warning-fg)', () => {
    const { container } = render(<MetadataProviderIcon provider="douban" state="candidate" />)
    const dot = icon(container).querySelector('[data-state-dot]') as HTMLElement
    expect(dot.getAttribute('data-state-dot')).toBe('warning')
    expect(dot.style.background).toContain('--state-warning-fg')
  })

  it('problem → 红点 var(--state-error-fg)（R2：error 非 danger）', () => {
    const { container } = render(<MetadataProviderIcon provider="douban" state="problem" />)
    const dot = icon(container).querySelector('[data-state-dot]') as HTMLElement
    expect(dot.getAttribute('data-state-dot')).toBe('error')
    expect(dot.style.background).toContain('--state-error-fg')
    expect(dot.style.background).not.toContain('danger')
  })

  it('missing → 灰显 grayscale + 无角标（opacity 走 --logo-absent-opacity token；jsdom 不表示 opacity:var()，浏览器生效）', () => {
    const { container } = render(<MetadataProviderIcon provider="tmdb" state="missing" />)
    const img = icon(container).querySelector('img') as HTMLImageElement
    expect(img.style.filter).toContain('grayscale(1)')
    expect(icon(container).querySelector('[data-state-dot]')).toBeNull()
  })

  it('not_applicable → 灰显 + 无角标 + title 含「不适用」', () => {
    const { container } = render(<MetadataProviderIcon provider="bangumi" state="not_applicable" />)
    const img = icon(container).querySelector('img') as HTMLImageElement
    expect(img.style.filter).toContain('grayscale')
    expect(icon(container).querySelector('[data-state-dot]')).toBeNull()
    expect(icon(container).getAttribute('title')).toBe('Bangumi：不适用')
  })
})

describe('MetadataProviderIcon — href 链接门控', () => {
  it('applied + href → 包 <a target=_blank rel=noopener noreferrer>', () => {
    const { container } = render(
      <MetadataProviderIcon provider="douban" state="applied" href="https://x/1" />,
    )
    const el = icon(container)
    expect(el.tagName).toBe('A')
    expect(el.getAttribute('href')).toBe('https://x/1')
    expect(el.getAttribute('target')).toBe('_blank')
    expect(el.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('missing + href → 裸 span 不链接', () => {
    const { container } = render(
      <MetadataProviderIcon provider="tmdb" state="missing" href="https://x/1" />,
    )
    expect(icon(container).tagName).toBe('SPAN')
  })

  it('not_applicable + href → 裸 span 不链接', () => {
    const { container } = render(
      <MetadataProviderIcon provider="bangumi" state="not_applicable" href="https://x/1" />,
    )
    expect(icon(container).tagName).toBe('SPAN')
  })
})

describe('MetadataProviderIcon — a11y title', () => {
  it('省略 title → 据 provider+state 派生（豆瓣：已应用）', () => {
    const { container } = render(<MetadataProviderIcon provider="douban" state="applied" />)
    const img = icon(container).querySelector('img') as HTMLImageElement
    expect(icon(container).getAttribute('title')).toBe('豆瓣：已应用')
    expect(img.getAttribute('alt')).toBe('豆瓣：已应用')
  })

  it('显式 title 覆盖派生', () => {
    const { container } = render(
      <MetadataProviderIcon provider="tmdb" state="candidate" title="自定义文案" />,
    )
    expect(icon(container).getAttribute('title')).toBe('自定义文案')
  })
})
