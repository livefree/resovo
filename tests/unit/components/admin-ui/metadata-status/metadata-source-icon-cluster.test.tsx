/**
 * metadata-source-icon-cluster.test.tsx — MetadataSourceIconCluster 簇单测（META-33-A / ADR-201）
 *
 * 覆盖：固定顺序四图标（含 missing 不过滤，DEV-33-2）/ 三密度可见性 / showScore 门控 /
 *       a11y 单 focus 目标 + aria-label 派生 / hover 与 focus 触发同一 tooltip（C6/R3）/ SSR 不崩。
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render, fireEvent } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { MetadataSourceIconCluster } from '../../../../../packages/admin-ui/src/components/metadata-status/metadata-source-icon-cluster'
import { makeSummary } from './_fixtures'

afterEach(() => cleanup())

function cluster(c: HTMLElement) {
  return c.querySelector('[data-metadata-source-icon-cluster]') as HTMLElement
}
function providerOrder(c: HTMLElement): string[] {
  return Array.from(cluster(c).querySelectorAll('[data-metadata-provider-icon]')).map(
    (el) => el.getAttribute('data-provider') ?? '',
  )
}

describe('MetadataSourceIconCluster — 固定顺序 + 全图标渲染（DEV-33-2）', () => {
  it('恒渲染四图标，固定顺序 douban/bangumi/tmdb/imdb', () => {
    const { container } = render(<MetadataSourceIconCluster summary={makeSummary()} density="table" />)
    expect(providerOrder(container)).toEqual(['douban', 'bangumi', 'tmdb', 'imdb'])
  })

  it('table 密度也渲染全部四图标（含 missing 不过滤，与旧 row 相反）', () => {
    // 全 missing 摘要 → 旧 EnrichmentBadgeCluster row 会过滤为 0；新簇恒显 4
    const { container } = render(<MetadataSourceIconCluster summary={makeSummary()} density="table" />)
    expect(cluster(container).querySelectorAll('[data-metadata-provider-icon]')).toHaveLength(4)
  })

  it('not_applicable 在三密度均显示（D-201-B）', () => {
    for (const density of ['table', 'header', 'panel'] as const) {
      const s = makeSummary({ bangumi: { state: 'not_applicable' } })
      const { container } = render(<MetadataSourceIconCluster summary={s} density={density} />)
      const bgm = cluster(container).querySelector('[data-provider="bangumi"]') as HTMLElement
      expect(bgm.getAttribute('data-state')).toBe('not_applicable')
      cleanup()
    }
  })
})

describe('MetadataSourceIconCluster — density 尺寸 + showScore 门控', () => {
  it('table=sm / header=md / panel=md', () => {
    const cases: Array<['table' | 'header' | 'panel', string]> = [
      ['table', 'sm'],
      ['header', 'md'],
      ['panel', 'md'],
    ]
    for (const [density, size] of cases) {
      const { container } = render(<MetadataSourceIconCluster summary={makeSummary()} density={density} />)
      const first = cluster(container).querySelector('[data-metadata-provider-icon]') as HTMLElement
      expect(first.getAttribute('data-size')).toBe(size)
      cleanup()
    }
  })

  it('showScore + header → 显示完整度微文案', () => {
    const s = makeSummary({}, { score: 72 })
    const { container } = render(<MetadataSourceIconCluster summary={s} density="header" showScore />)
    const score = cluster(container).querySelector('[data-metadata-cluster-score]') as HTMLElement
    expect(score.textContent).toBe('72')
    expect(score.style.color).toContain('--fg-muted')
  })

  it('showScore + table → 忽略（不显示完整度，不挤占图标）', () => {
    const s = makeSummary({}, { score: 72 })
    const { container } = render(<MetadataSourceIconCluster summary={s} density="table" showScore />)
    expect(cluster(container).querySelector('[data-metadata-cluster-score]')).toBeNull()
  })

  it('showScore=false（默认）→ header 也不显示', () => {
    const s = makeSummary({}, { score: 72 })
    const { container } = render(<MetadataSourceIconCluster summary={s} density="header" />)
    expect(cluster(container).querySelector('[data-metadata-cluster-score]')).toBeNull()
  })

  it('score=null + showScore → 不显示', () => {
    const { container } = render(
      <MetadataSourceIconCluster summary={makeSummary()} density="panel" showScore />,
    )
    expect(cluster(container).querySelector('[data-metadata-cluster-score]')).toBeNull()
  })
})

describe('MetadataSourceIconCluster — a11y 单 focus 目标', () => {
  it('role=img + tabIndex=0 + aria-label 派生', () => {
    const s = makeSummary({}, { overall: 'partial' })
    const { container } = render(<MetadataSourceIconCluster summary={s} density="table" />)
    const el = cluster(container)
    expect(el.getAttribute('role')).toBe('img')
    expect(el.getAttribute('tabindex')).toBe('0')
    expect(el.getAttribute('aria-label')).toBe('元数据状态：部分增强')
  })

  it('显式 ariaLabel 覆盖派生', () => {
    const { container } = render(
      <MetadataSourceIconCluster summary={makeSummary()} density="table" ariaLabel="自定义" />,
    )
    expect(cluster(container).getAttribute('aria-label')).toBe('自定义')
  })

  it('子图标无独立 <a>（单 focus 目标，外链归 panel）', () => {
    const s = makeSummary({ douban: { state: 'applied', externalId: '1' } })
    const { container } = render(<MetadataSourceIconCluster summary={s} density="table" />)
    expect(cluster(container).querySelectorAll('a')).toHaveLength(0)
  })
})

describe('MetadataSourceIconCluster — hover/focus 同一 tooltip（C6/R3）', () => {
  it('hover 打开 tooltip，含 headline', () => {
    const s = makeSummary({}, { overall: 'partial', score: 72 })
    const { container } = render(<MetadataSourceIconCluster summary={s} density="table" />)
    fireEvent.mouseEnter(cluster(container))
    const headline = document.body.querySelector('[data-tooltip-headline]') as HTMLElement
    expect(headline).not.toBeNull()
    expect(headline.textContent).toContain('部分增强')
    fireEvent.mouseLeave(cluster(container))
    expect(document.body.querySelector('[data-tooltip-headline]')).toBeNull()
  })

  it('键盘 focus 打开同一 tooltip（含 4 provider 行）', () => {
    const { container } = render(<MetadataSourceIconCluster summary={makeSummary()} density="table" />)
    fireEvent.focus(cluster(container))
    expect(document.body.querySelectorAll('[data-tooltip-provider]')).toHaveLength(4)
    fireEvent.blur(cluster(container))
    expect(document.body.querySelector('[data-tooltip-provider]')).toBeNull()
  })

  it('tooltip 渲染 issue 行 + 下一步', () => {
    const s = makeSummary({}, {
      overall: 'candidate',
      nextAction: 'confirm_candidate',
      issues: [{ code: 'candidate_unconfirmed', level: 'warn', provider: 'bangumi', message: 'x', action: 'confirm_candidate' }],
    })
    const { container } = render(<MetadataSourceIconCluster summary={s} density="header" />)
    fireEvent.mouseEnter(cluster(container))
    expect((document.body.querySelector('[data-tooltip-issue]') as HTMLElement).textContent).toContain('候选尚未应用')
    expect((document.body.querySelector('[data-tooltip-next]') as HTMLElement).textContent).toContain('确认候选')
  })
})

describe('MetadataSourceIconCluster — SSR', () => {
  it('renderToString 不崩，含四图标', () => {
    const html = renderToString(<MetadataSourceIconCluster summary={makeSummary()} density="table" />)
    expect(html).toContain('data-metadata-source-icon-cluster')
    expect((html.match(/data-metadata-provider-icon/g) ?? []).length).toBe(4)
  })
})
