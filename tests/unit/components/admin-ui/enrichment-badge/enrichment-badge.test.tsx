/**
 * EnrichmentBadge / EnrichmentBadgeCluster 单测（META-10 / ADR-172 / ADR-E）
 *
 * 对拍真源：ADR-172 映射表（kind × status → variant / 文案）+ arch-reviewer Opus 单测要点 1–11。
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

// ── 测试夹具 ─────────────────────────────────────────────────────

/** 全字段命中的 anime summary（簇排序/门控测试用） */
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
    ...over,
  }
}

function badge(container: HTMLElement) {
  return container.querySelector('[data-enrichment-badge]') as HTMLElement | null
}
function pillOf(el: HTMLElement) {
  return el.querySelector('[data-pill]') as HTMLElement
}

// ── 1. kind×status 映射全覆盖（对拍映射表）──────────────────────────

describe('EnrichmentBadge — douban/bangumi 4 态映射', () => {
  const cases = [
    ['matched', 'ok', '已匹配'],
    ['candidate', 'warn', '候选'],
    ['unmatched', 'danger', '未匹配'],
    ['pending', 'neutral', '待匹配'],
  ] as const

  it.each(cases)('douban %s → %s「%s」', (status, variant, label) => {
    const d = deriveEnrichmentBadge({ kind: 'douban', status })
    expect(d).not.toBeNull()
    expect(d!.variant).toBe(variant)
    expect(d!.label).toBe(label)
    expect(d!.ariaLabel).toBe(`豆瓣：${label}`)
  })

  it.each(cases)('bangumi %s → %s「%s」（镜像 douban，前缀 Bangumi）', (status, variant, label) => {
    const d = deriveEnrichmentBadge({ kind: 'bangumi', status })
    expect(d!.variant).toBe(variant)
    expect(d!.label).toBe(label)
    expect(d!.ariaLabel).toBe(`Bangumi：${label}`)
  })
})

describe('EnrichmentBadge — source 4 态映射', () => {
  const cases = [
    ['ok', 'ok', '源正常', '正常'],
    ['partial', 'warn', '部分失效', '部分失效'],
    ['all_dead', 'danger', '全部失效', '全部失效'],
    ['pending', 'neutral', '待检', '待检'],
  ] as const

  it.each(cases)('source %s → %s「%s」', (status, variant, label, aria) => {
    const d = deriveEnrichmentBadge({ kind: 'source', status })
    expect(d!.variant).toBe(variant)
    expect(d!.label).toBe(label)
    expect(d!.ariaLabel).toBe(`源活性：${aria}`)
  })
})

// ── 2/3. meta 阈值边界 + 超界兜底 ─────────────────────────────────

describe('EnrichmentBadge — meta 阈值变色', () => {
  const cases = [
    [0, 'danger'],
    [49, 'danger'],
    [50, 'warn'],
    [79, 'warn'],
    [80, 'ok'],
    [100, 'ok'],
  ] as const

  it.each(cases)('score=%i → %s', (score, variant) => {
    const d = deriveEnrichmentBadge({ kind: 'meta', score })
    expect(d!.variant).toBe(variant)
    expect(d!.label).toBe(String(score))
    expect(d!.ariaLabel).toBe(`元数据完整度：${score}`)
  })

  it('超界兜底不抛错：-5 → danger / 150 → ok', () => {
    expect(deriveEnrichmentBadge({ kind: 'meta', score: -5 })!.variant).toBe('danger')
    expect(deriveEnrichmentBadge({ kind: 'meta', score: 150 })!.variant).toBe('ok')
  })
})

// ── 4. pinyin 渲染门控 ───────────────────────────────────────────

describe('EnrichmentBadge — pinyin 门控', () => {
  it('isPinyin=true → warn「⚠ 拼音」', () => {
    const d = deriveEnrichmentBadge({ kind: 'pinyin', isPinyin: true })
    expect(d!.variant).toBe('warn')
    expect(d!.label).toContain('拼音')
    expect(d!.label).toContain('⚠')
    expect(d!.ariaLabel).toBe('英文标题疑似拼音')
  })

  it('isPinyin=false → 派生 null + 组件不渲染', () => {
    expect(deriveEnrichmentBadge({ kind: 'pinyin', isPinyin: false })).toBeNull()
    const { container } = render(<EnrichmentBadge kind="pinyin" isPinyin={false} />)
    expect(badge(container)).toBeNull()
  })
})

// ── 渲染冒烟 + data attribute ─────────────────────────────────────

describe('EnrichmentBadge — DOM 渲染 + data attribute', () => {
  it('douban matched → Pill data-variant=ok + data attr 完整', () => {
    const { container } = render(<EnrichmentBadge kind="douban" status="matched" testId="eb-1" />)
    const el = badge(container)!
    expect(el.getAttribute('data-kind')).toBe('douban')
    expect(el.getAttribute('data-status')).toBe('matched')
    expect(el.getAttribute('data-size')).toBe('sm')
    expect(el.getAttribute('data-testid')).toBe('eb-1')
    expect(pillOf(el).getAttribute('data-variant')).toBe('ok')
    expect(pillOf(el).textContent).toContain('已匹配')
  })

  it('meta score → data-status = score 字符串', () => {
    const { container } = render(<EnrichmentBadge kind="meta" score={72} />)
    expect(badge(container)!.getAttribute('data-status')).toBe('72')
  })

  it('showLabel=false → dot only（无 label 文本）但 aria-label 完整', () => {
    const { container } = render(
      <EnrichmentBadge kind="douban" status="unmatched" showLabel={false} />,
    )
    const pill = pillOf(badge(container)!)
    expect(pill.textContent).not.toContain('未匹配')
    expect(pill.getAttribute('aria-label')).toBe('豆瓣：未匹配')
    // dot 仍渲染
    expect(pill.querySelector('[data-pill-dot]')).toBeTruthy()
  })

  it('size=md → data-size=md', () => {
    const { container } = render(<EnrichmentBadge kind="source" status="ok" size="md" />)
    expect(badge(container)!.getAttribute('data-size')).toBe('md')
  })
})

// ── 5. 簇 anime-only 门控 ─────────────────────────────────────────

describe('EnrichmentBadgeCluster — anime-only bangumi 门控', () => {
  it('type=anime → 含 bangumi 徽标', () => {
    const { container } = render(
      <EnrichmentBadgeCluster summary={makeSummary()} type="anime" density="header" />,
    )
    expect(container.querySelector('[data-kind="bangumi"]')).toBeTruthy()
  })

  it('type=movie 且 bangumiStatus=matched → 仍不渲染 bangumi（门控不依赖 status 值）', () => {
    const { container } = render(
      <EnrichmentBadgeCluster
        summary={makeSummary({ bangumiStatus: 'matched' })}
        type="movie"
        density="header"
      />,
    )
    expect(container.querySelector('[data-kind="bangumi"]')).toBeNull()
    // douban / source / meta 仍在
    expect(container.querySelector('[data-kind="douban"]')).toBeTruthy()
    expect(container.querySelector('[data-kind="source"]')).toBeTruthy()
    expect(container.querySelector('[data-kind="meta"]')).toBeTruthy()
  })
})

// ── 6. 簇 pinyin 门控 ─────────────────────────────────────────────

describe('EnrichmentBadgeCluster — pinyin 门控', () => {
  it('titleEnIsPinyin=false → 无 pinyin 徽标', () => {
    const { container } = render(
      <EnrichmentBadgeCluster
        summary={makeSummary({ titleEnIsPinyin: false })}
        type="movie"
        density="header"
      />,
    )
    expect(container.querySelector('[data-kind="pinyin"]')).toBeNull()
  })

  it('titleEnIsPinyin=true → 有 pinyin 徽标', () => {
    const { container } = render(
      <EnrichmentBadgeCluster
        summary={makeSummary({ titleEnIsPinyin: true })}
        type="movie"
        density="header"
      />,
    )
    expect(container.querySelector('[data-kind="pinyin"]')).toBeTruthy()
  })
})

// ── 7. 簇排列顺序 ─────────────────────────────────────────────────

describe('EnrichmentBadgeCluster — 固定排列顺序', () => {
  it('anime 全命中 → douban → bangumi → source → meta → pinyin', () => {
    const { container } = render(
      <EnrichmentBadgeCluster summary={makeSummary()} type="anime" density="header" />,
    )
    const kinds = Array.from(container.querySelectorAll('[data-enrichment-badge]')).map((el) =>
      el.getAttribute('data-kind'),
    )
    expect(kinds).toEqual(['douban', 'bangumi', 'source', 'meta', 'pinyin'])
  })
})

// ── 8. density 差异 ───────────────────────────────────────────────

describe('EnrichmentBadgeCluster — density 差异', () => {
  it('row → 各徽标 size=sm + 无 label 文本 + 无 enrichedAt slot', () => {
    const { container } = render(
      <EnrichmentBadgeCluster
        summary={makeSummary({ titleEnIsPinyin: false })}
        type="movie"
        density="row"
        enrichedAtLabel="2 分钟前"
      />,
    )
    const douban = container.querySelector('[data-kind="douban"]') as HTMLElement
    expect(douban.getAttribute('data-size')).toBe('sm')
    expect(pillOf(douban).textContent).not.toContain('已匹配')
    expect(container.querySelector('[data-enrichment-cluster-time]')).toBeNull()
  })

  it('header → 各徽标 size=md + 有 label + 渲染 enrichedAtLabel', () => {
    const { container } = render(
      <EnrichmentBadgeCluster
        summary={makeSummary({ titleEnIsPinyin: false })}
        type="movie"
        density="header"
        enrichedAtLabel="2 分钟前"
      />,
    )
    const douban = container.querySelector('[data-kind="douban"]') as HTMLElement
    expect(douban.getAttribute('data-size')).toBe('md')
    expect(pillOf(douban).textContent).toContain('已匹配')
    const time = container.querySelector('[data-enrichment-cluster-time]')
    expect(time?.textContent).toBe('2 分钟前')
  })

  it('header + enrichedAtLabel 省略 → 显示「未富集」兜底', () => {
    const { container } = render(
      <EnrichmentBadgeCluster
        summary={makeSummary({ titleEnIsPinyin: false })}
        type="movie"
        density="header"
      />,
    )
    expect(container.querySelector('[data-enrichment-cluster-time]')?.textContent).toBe('未富集')
  })

  it('簇根 data attribute 完整', () => {
    const { container } = render(
      <EnrichmentBadgeCluster
        summary={makeSummary()}
        type="anime"
        density="row"
        testId="cluster-1"
      />,
    )
    const root = container.querySelector('[data-enrichment-badge-cluster]') as HTMLElement
    expect(root.getAttribute('data-type')).toBe('anime')
    expect(root.getAttribute('data-density')).toBe('row')
    expect(root.getAttribute('data-testid')).toBe('cluster-1')
  })
})

// ── 9. 零硬编码颜色 ───────────────────────────────────────────────

describe('EnrichmentBadge — 零硬编码颜色（仅 var(--*) token）', () => {
  it('单徽标渲染输出无 hex/rgb/oklch 字面量', () => {
    const { container } = render(<EnrichmentBadge kind="douban" status="unmatched" />)
    const html = container.innerHTML
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(html).not.toMatch(/rgb\(/)
    expect(html).not.toMatch(/oklch\(/)
    // 颜色经 var() token 消费
    expect(html).toContain('var(--state-error')
  })

  it('簇含时间文本（--fg-muted）仍无硬编码颜色', () => {
    const { container } = render(
      <EnrichmentBadgeCluster summary={makeSummary()} type="anime" density="header" />,
    )
    const html = container.innerHTML
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(html).not.toMatch(/rgb\(/)
    expect(html).not.toMatch(/oklch\(/)
    expect(html).toContain('var(--fg-muted)')
  })
})

// ── 10. a11y 复合 aria-label ──────────────────────────────────────

describe('EnrichmentBadge — a11y 复合 aria-label', () => {
  it('每个徽标 aria-label 含维度前缀 + 派生文案', () => {
    const { container } = render(
      <EnrichmentBadgeCluster summary={makeSummary()} type="anime" density="row" />,
    )
    const labels = Array.from(container.querySelectorAll('[data-pill]')).map((p) =>
      p.getAttribute('aria-label'),
    )
    expect(labels).toContain('豆瓣：已匹配')
    expect(labels).toContain('Bangumi：已匹配')
    expect(labels).toContain('源活性：正常')
    expect(labels).toContain('元数据完整度：90')
    expect(labels).toContain('英文标题疑似拼音')
  })

  it('showLabel=false 时 aria-label 仍完整（不因隐藏 label 丢 a11y）', () => {
    const { container } = render(
      <EnrichmentBadge kind="source" status="all_dead" showLabel={false} />,
    )
    expect(pillOf(badge(container)!).getAttribute('aria-label')).toBe('源活性：全部失效')
  })
})
