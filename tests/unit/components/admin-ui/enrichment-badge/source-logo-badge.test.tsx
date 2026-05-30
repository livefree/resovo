/**
 * source-logo-badge.test.tsx — SourceLogoBadge 原语单测（META-14-A / ADR-172 AMENDMENT 2）
 *
 * 覆盖：4 源 × 三态（matched/candidate/absent）视觉 + a11y title/alt + href 链接 + 灰显零硬编码色。
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { SourceLogoBadge } from '../../../../../packages/admin-ui/src/components/enrichment-badge/source-logo-badge'
import { SOURCE_LOGO_DATA_URI } from '../../../../../packages/admin-ui/src/components/enrichment-badge/enrichment-logos'

afterEach(() => cleanup())

function badge(c: HTMLElement) {
  return c.querySelector('[data-source-logo]') as HTMLElement
}

describe('SourceLogoBadge — data attribute + img 渲染', () => {
  it('4 源各渲染对应 data-URI logo', () => {
    for (const source of ['douban', 'bangumi', 'tmdb', 'imdb'] as const) {
      const { container } = render(<SourceLogoBadge source={source} state="matched" />)
      const img = badge(container).querySelector('img') as HTMLImageElement
      expect(img.getAttribute('src')).toBe(SOURCE_LOGO_DATA_URI[source])
      expect(badge(container).getAttribute('data-source')).toBe(source)
      cleanup()
    }
  })

  it('data-state / data-size / testId', () => {
    const { container } = render(<SourceLogoBadge source="douban" state="matched" size="md" testId="slb-1" />)
    const el = badge(container)
    expect(el.getAttribute('data-state')).toBe('matched')
    expect(el.getAttribute('data-size')).toBe('md')
    expect(el.getAttribute('data-testid')).toBe('slb-1')
  })
})

describe('SourceLogoBadge — 三态视觉', () => {
  it('matched → 无灰显 filter / 无 candidate 小点', () => {
    const { container } = render(<SourceLogoBadge source="douban" state="matched" />)
    const img = badge(container).querySelector('img') as HTMLImageElement
    expect(img.style.filter).toBe('')
    expect(badge(container).querySelector('[data-candidate-dot]')).toBeNull()
  })

  it('candidate → 琥珀小点（var(--state-warning-fg)）', () => {
    const { container } = render(<SourceLogoBadge source="bangumi" state="candidate" />)
    const dot = badge(container).querySelector('[data-candidate-dot]') as HTMLElement
    expect(dot).toBeTruthy()
    expect(dot.style.background).toContain('var(--state-warning-fg)')
  })

  it('absent → grayscale 滤镜灰显（opacity 走 --logo-absent-opacity token；jsdom 不表示 opacity:var()，浏览器生效）', () => {
    const { container } = render(<SourceLogoBadge source="tmdb" state="absent" />)
    const img = badge(container).querySelector('img') as HTMLImageElement
    expect(img.style.filter).toContain('grayscale(1)')
  })
})

describe('SourceLogoBadge — a11y title/alt（修复 hover tooltip 缺口）', () => {
  it('省略 title → 据 source+state 派生「豆瓣：已匹配」', () => {
    const { container } = render(<SourceLogoBadge source="douban" state="matched" />)
    const el = badge(container)
    expect(el.getAttribute('title')).toBe('豆瓣：已匹配')
    expect((el.querySelector('img') as HTMLImageElement).getAttribute('alt')).toBe('豆瓣：已匹配')
  })

  it('absent 派生「未匹配」/ candidate 派生「候选」', () => {
    const { container: c1 } = render(<SourceLogoBadge source="imdb" state="absent" />)
    expect(badge(c1).getAttribute('title')).toBe('IMDb：未匹配')
    const { container: c2 } = render(<SourceLogoBadge source="douban" state="candidate" />)
    expect(badge(c2).getAttribute('title')).toBe('豆瓣：候选')
  })

  it('显式 title 覆盖派生', () => {
    const { container } = render(<SourceLogoBadge source="tmdb" state="matched" title="自定义" />)
    expect(badge(container).getAttribute('title')).toBe('自定义')
  })
})

describe('SourceLogoBadge — href 链接', () => {
  it('matched + href → <a target=_blank rel=noopener noreferrer>', () => {
    const { container } = render(
      <SourceLogoBadge source="douban" state="matched" href="https://movie.douban.com/subject/1/" />,
    )
    const a = badge(container) as HTMLAnchorElement
    expect(a.tagName).toBe('A')
    expect(a.getAttribute('href')).toBe('https://movie.douban.com/subject/1/')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('absent + href → 不渲染 <a>（裸 span）', () => {
    const { container } = render(<SourceLogoBadge source="douban" state="absent" href="https://x" />)
    expect(badge(container).tagName).toBe('SPAN')
  })

  it('matched 无 href → 裸 span', () => {
    const { container } = render(<SourceLogoBadge source="douban" state="matched" />)
    expect(badge(container).tagName).toBe('SPAN')
  })
})

describe('SourceLogoBadge — 零硬编码颜色', () => {
  it('渲染输出无 hex/rgb/oklch 字面量（grayscale 滤镜白名单）', () => {
    const { container } = render(<SourceLogoBadge source="tmdb" state="absent" />)
    const html = container.innerHTML
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(html).not.toMatch(/rgb\(/)
    expect(html).not.toMatch(/oklch\(/)
  })
})
