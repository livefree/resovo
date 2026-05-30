/**
 * EnrichmentBadge / EnrichmentBadgeCluster 单测（ADR-172 + AMENDMENT 2 重写 / META-14-C）
 *
 * AMENDMENT 2 后：EnrichmentBadge 仅 meta/pinyin；外部源由 SourceLogoBadge（logo）承载，
 * 簇 = logo 行（douban→bangumi(anime)→tmdb→imdb）+ pinyin⚠ + meta chip(header) + 富集时间(header)。
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import type { EnrichmentSummary } from '@resovo/types'
import {
  EnrichmentBadge,
  deriveEnrichmentBadge,
} from '../../../../../packages/admin-ui/src/components/enrichment-badge/enrichment-badge'
import { EnrichmentBadgeCluster } from '../../../../../packages/admin-ui/src/components/enrichment-badge/enrichment-badge-cluster'

afterEach(() => cleanup())

// ── 测试夹具（全命中 anime summary）─────────────────────────────────

function makeSummary(over: Partial<EnrichmentSummary> = {}): EnrichmentSummary {
  return {
    doubanStatus: 'matched',
    bangumiStatus: 'matched',
    sourceCheckStatus: 'ok',
    metaScore: 90,
    enrichedAt: '2026-05-30T00:00:00Z',
    titleEnIsPinyin: true,
    doubanConfidence: 0.9,
    bangumiSubjectId: 8,
    doubanId: '1292052',
    tmdbId: 27205,
    imdbId: 'tt1375666',
    ...over,
  }
}

const logos = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-source-logo]'))
const logo = (c: HTMLElement, source: string) => c.querySelector(`[data-source="${source}"]`) as HTMLElement | null
const metaChip = (c: HTMLElement) => c.querySelector('[data-enrichment-badge][data-kind="meta"]')
const pinyinChip = (c: HTMLElement) => c.querySelector('[data-enrichment-badge][data-kind="pinyin"]')
const pill = (el: Element) => el.querySelector('[data-pill]') as HTMLElement

// ── EnrichmentBadge meta 阈值 ─────────────────────────────────────

describe('EnrichmentBadge — meta 阈值变色', () => {
  const cases = [[0, 'danger'], [49, 'danger'], [50, 'warn'], [79, 'warn'], [80, 'ok'], [100, 'ok']] as const
  it.each(cases)('score=%i → %s', (score, variant) => {
    const d = deriveEnrichmentBadge({ kind: 'meta', score })
    expect(d!.variant).toBe(variant)
    expect(d!.label).toBe(String(score))
    expect(d!.ariaLabel).toBe(`元数据完整度：${score}`)
  })
  it('超界兜底：-5 → danger / 150 → ok', () => {
    expect(deriveEnrichmentBadge({ kind: 'meta', score: -5 })!.variant).toBe('danger')
    expect(deriveEnrichmentBadge({ kind: 'meta', score: 150 })!.variant).toBe('ok')
  })
})

// ── EnrichmentBadge pinyin ────────────────────────────────────────

describe('EnrichmentBadge — pinyin 门控', () => {
  it('isPinyin=true → warn「⚠ 拼音」', () => {
    const d = deriveEnrichmentBadge({ kind: 'pinyin', isPinyin: true })
    expect(d!.variant).toBe('warn')
    expect(d!.label).toContain('拼音')
    expect(d!.label).toContain('⚠')
    expect(d!.ariaLabel).toBe('英文标题疑似拼音')
  })
  it('isPinyin=false → null + 组件不渲染', () => {
    expect(deriveEnrichmentBadge({ kind: 'pinyin', isPinyin: false })).toBeNull()
    const { container } = render(<EnrichmentBadge kind="pinyin" isPinyin={false} />)
    expect(badge_(container)).toBeNull()
  })
})

function badge_(c: HTMLElement) {
  return c.querySelector('[data-enrichment-badge]')
}

describe('EnrichmentBadge — meta DOM + data-attr', () => {
  it('meta score=72 → data-kind=meta / data-status=72 / variant warn', () => {
    const { container } = render(<EnrichmentBadge kind="meta" score={72} testId="m1" />)
    const el = container.querySelector('[data-enrichment-badge]') as HTMLElement
    expect(el.getAttribute('data-kind')).toBe('meta')
    expect(el.getAttribute('data-status')).toBe('72')
    expect(el.getAttribute('data-testid')).toBe('m1')
    expect(pill(el).getAttribute('data-variant')).toBe('warn')
  })
})

// ── Cluster — logo 行渲染 + anime-only ─────────────────────────────

describe('EnrichmentBadgeCluster — logo 行 + anime-only', () => {
  it('anime header → douban/bangumi/tmdb/imdb 4 logo 全渲染', () => {
    const { container } = render(<EnrichmentBadgeCluster summary={makeSummary()} type="anime" density="header" />)
    for (const s of ['douban', 'bangumi', 'tmdb', 'imdb']) expect(logo(container, s)).toBeTruthy()
  })

  it('movie header → 无 bangumi logo（anime-only）；douban/tmdb/imdb 仍在', () => {
    const { container } = render(<EnrichmentBadgeCluster summary={makeSummary({ bangumiStatus: 'matched' })} type="movie" density="header" />)
    expect(logo(container, 'bangumi')).toBeNull()
    expect(logo(container, 'douban')).toBeTruthy()
    expect(logo(container, 'tmdb')).toBeTruthy()
    expect(logo(container, 'imdb')).toBeTruthy()
  })

  it('固定排序 douban → bangumi → tmdb → imdb', () => {
    const { container } = render(<EnrichmentBadgeCluster summary={makeSummary()} type="anime" density="header" />)
    expect(logos(container).map((l) => l.getAttribute('data-source'))).toEqual(['douban', 'bangumi', 'tmdb', 'imdb'])
  })
})

// ── Cluster — state 推导 ──────────────────────────────────────────

describe('EnrichmentBadgeCluster — state 推导', () => {
  it('douban matched / candidate / unmatched → matched / candidate / absent', () => {
    const mk = (s: EnrichmentSummary['doubanStatus']) =>
      logo(render(<EnrichmentBadgeCluster summary={makeSummary({ doubanStatus: s })} type="movie" density="header" />).container, 'douban')!.getAttribute('data-state')
    expect(mk('matched')).toBe('matched')
    expect(mk('candidate')).toBe('candidate')
    expect(mk('unmatched')).toBe('absent')
  })

  it('tmdbId=null → tmdb absent；imdbId=null → imdb absent', () => {
    const { container } = render(<EnrichmentBadgeCluster summary={makeSummary({ tmdbId: null, imdbId: null })} type="movie" density="header" />)
    expect(logo(container, 'tmdb')!.getAttribute('data-state')).toBe('absent')
    expect(logo(container, 'imdb')!.getAttribute('data-state')).toBe('absent')
  })
})

// ── Cluster — density 差异 ────────────────────────────────────────

describe('EnrichmentBadgeCluster — density 差异', () => {
  it('row → 仅命中 logo（absent 不渲染）+ 无 meta chip + 无富集时间', () => {
    // tmdb/imdb 命中，douban unmatched（absent）→ row 隐藏 douban
    const { container } = render(
      <EnrichmentBadgeCluster summary={makeSummary({ doubanStatus: 'unmatched', titleEnIsPinyin: false })} type="movie" density="row" />,
    )
    expect(logo(container, 'douban')).toBeNull()       // absent 不渲染
    expect(logo(container, 'tmdb')).toBeTruthy()       // matched 渲染
    expect(metaChip(container)).toBeNull()             // 无 meta chip
    expect(container.querySelector('[data-enrichment-cluster-time]')).toBeNull()
  })

  it('header → absent logo 灰显渲染 + meta chip + 富集时间', () => {
    const { container } = render(
      <EnrichmentBadgeCluster summary={makeSummary({ doubanStatus: 'unmatched', titleEnIsPinyin: false })} type="movie" density="header" enrichedAtLabel="富集 2026-05-30" />,
    )
    const douban = logo(container, 'douban')!
    expect(douban).toBeTruthy()                        // absent 仍渲染
    expect(douban.getAttribute('data-state')).toBe('absent')
    expect(metaChip(container)).toBeTruthy()
    expect(container.querySelector('[data-enrichment-cluster-time]')?.textContent).toBe('富集 2026-05-30')
  })

  it('header + enrichedAtLabel 省略 → 「未富集」', () => {
    const { container } = render(<EnrichmentBadgeCluster summary={makeSummary()} type="movie" density="header" />)
    expect(container.querySelector('[data-enrichment-cluster-time]')?.textContent).toBe('未富集')
  })

  it('簇根 data-type / data-density / testId', () => {
    const { container } = render(<EnrichmentBadgeCluster summary={makeSummary()} type="anime" density="row" testId="c1" />)
    const root = container.querySelector('[data-enrichment-badge-cluster]') as HTMLElement
    expect(root.getAttribute('data-type')).toBe('anime')
    expect(root.getAttribute('data-density')).toBe('row')
    expect(root.getAttribute('data-testid')).toBe('c1')
  })
})

// ── Cluster — pinyin 门控 ─────────────────────────────────────────

describe('EnrichmentBadgeCluster — pinyin 门控（两密度均渲染）', () => {
  it('titleEnIsPinyin=true → 有 pinyin chip（row + header）', () => {
    for (const density of ['row', 'header'] as const) {
      const { container } = render(<EnrichmentBadgeCluster summary={makeSummary({ titleEnIsPinyin: true })} type="movie" density={density} />)
      expect(pinyinChip(container)).toBeTruthy()
      cleanup()
    }
  })
  it('titleEnIsPinyin=false → 无 pinyin chip', () => {
    const { container } = render(<EnrichmentBadgeCluster summary={makeSummary({ titleEnIsPinyin: false })} type="movie" density="header" />)
    expect(pinyinChip(container)).toBeNull()
  })
})

// ── Cluster — href 跳链 ───────────────────────────────────────────

describe('EnrichmentBadgeCluster — href 外部页', () => {
  it('命中源 → logo 为 <a> 且 href 正确', () => {
    const { container } = render(<EnrichmentBadgeCluster summary={makeSummary()} type="anime" density="header" />)
    const douban = logo(container, 'douban') as HTMLAnchorElement
    expect(douban.tagName).toBe('A')
    expect(douban.getAttribute('href')).toBe('https://movie.douban.com/subject/1292052/')
    expect((logo(container, 'imdb') as HTMLAnchorElement).getAttribute('href')).toBe('https://www.imdb.com/title/tt1375666/')
  })
  it('absent 源 → 非 <a>', () => {
    const { container } = render(<EnrichmentBadgeCluster summary={makeSummary({ tmdbId: null })} type="movie" density="header" />)
    expect(logo(container, 'tmdb')!.tagName).toBe('SPAN')
  })
})

// ── 零硬编码颜色 ──────────────────────────────────────────────────

describe('EnrichmentBadgeCluster — 零硬编码颜色', () => {
  it('无 hex/rgb/oklch 字面量（grayscale 滤镜白名单）', () => {
    const { container } = render(<EnrichmentBadgeCluster summary={makeSummary({ doubanStatus: 'unmatched' })} type="anime" density="header" />)
    const html = container.innerHTML
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(html).not.toMatch(/rgb\(/)
    expect(html).not.toMatch(/oklch\(/)
  })
})
