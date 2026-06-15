/**
 * metadata-status-panel.test.tsx — MetadataStatusPanel 面板单测（META-33-B / ADR-201 §审核详情·视频编辑）
 *
 * 覆盖：三 variant 结构（detail/drawer 全展开 / compact 折叠）/ 四来源卡 / 问题列表 Pill 映射 /
 *       onAction 整体级 + per-provider / sourceEvidence slot / nextAction='none' / compact top-3 问题 / SSR。
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, fireEvent, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { MetadataStatusPanel } from '../../../../../packages/admin-ui/src/components/metadata-status/metadata-status-panel'
import { makeSummary } from './_fixtures'

afterEach(() => cleanup())

function panel(c: HTMLElement) {
  return c.querySelector('[data-metadata-status-panel]') as HTMLElement
}

describe('MetadataStatusPanel — variant 结构差异', () => {
  it('detail：Header overall + 四来源卡 + 图标簇', () => {
    const s = makeSummary({}, { overall: 'partial', score: 72 })
    const { container } = render(<MetadataStatusPanel summary={s} variant="detail" />)
    expect((panel(container).querySelector('[data-panel-overall]') as HTMLElement).textContent).toBe('部分增强')
    expect(panel(container).querySelectorAll('[data-metadata-source-card]')).toHaveLength(4)
    expect(panel(container).querySelector('[data-metadata-source-icon-cluster]')).not.toBeNull()
    expect(panel(container).getAttribute('data-variant')).toBe('detail')
  })

  it('drawer：同 detail 全展开四来源卡', () => {
    const { container } = render(<MetadataStatusPanel summary={makeSummary()} variant="drawer" />)
    expect(panel(container).querySelectorAll('[data-metadata-source-card]')).toHaveLength(4)
  })

  it('compact：折叠无来源卡，仅 Header 簇', () => {
    const { container } = render(<MetadataStatusPanel summary={makeSummary()} variant="compact" />)
    expect(panel(container).querySelector('[data-panel-source-cards]')).toBeNull()
    expect(panel(container).querySelector('[data-metadata-source-icon-cluster]')).not.toBeNull()
  })

  it('四来源卡固定顺序 douban/bangumi/tmdb/imdb', () => {
    const { container } = render(<MetadataStatusPanel summary={makeSummary()} variant="detail" />)
    const order = Array.from(panel(container).querySelectorAll('[data-metadata-source-card]')).map((el) =>
      el.getAttribute('data-provider'),
    )
    expect(order).toEqual(['douban', 'bangumi', 'tmdb', 'imdb'])
  })
})

describe('MetadataStatusPanel — 问题列表（Pill 映射）', () => {
  it('issues 渲染为 Pill（level none 过滤）', () => {
    const s = makeSummary({}, {
      issues: [
        { code: 'candidate_unconfirmed', level: 'warn', provider: 'bangumi', message: 'x', action: 'confirm_candidate' },
        { code: 'noop', level: 'none', provider: null, message: 'ignored', action: 'none' },
      ],
    })
    const { container } = render(<MetadataStatusPanel summary={s} variant="detail" />)
    const issues = panel(container).querySelectorAll('[data-panel-issue]')
    expect(issues).toHaveLength(1)
    expect(issues[0].textContent).toContain('Bangumi 候选尚未应用')
  })

  it('field_conflict（ADR-205 M3 / META-49-D2）→「多源字段冲突：<字段名>」（label + message 字段名拼接）', () => {
    const s = makeSummary({}, {
      overall: 'needs_review',
      issues: [
        { code: 'field_conflict', level: 'danger', provider: null, message: 'title, rating', action: 'review_conflict' },
      ],
    })
    const { container } = render(<MetadataStatusPanel summary={s} variant="detail" />)
    const issues = panel(container).querySelectorAll('[data-panel-issue]')
    expect(issues).toHaveLength(1)
    expect(issues[0].textContent).toContain('多源字段冲突：title, rating')
  })

  it('compact 仅 top-3 问题', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      code: 'candidate_unconfirmed', level: 'warn' as const, provider: 'bangumi' as const, message: `m${i}`, action: 'confirm_candidate' as const,
    }))
    const { container } = render(<MetadataStatusPanel summary={makeSummary({}, { issues: many })} variant="compact" />)
    expect(panel(container).querySelectorAll('[data-panel-issue]')).toHaveLength(3)
  })

  it('无问题 → 不渲染问题区', () => {
    const { container } = render(<MetadataStatusPanel summary={makeSummary()} variant="detail" />)
    expect(panel(container).querySelector('[data-panel-issues]')).toBeNull()
  })
})

describe('MetadataStatusPanel — onAction', () => {
  it('整体级：下一步主按钮 → onAction(nextAction)', () => {
    const onAction = vi.fn()
    const s = makeSummary({}, { nextAction: 'run_enrichment' })
    const { container } = render(<MetadataStatusPanel summary={s} variant="detail" onAction={onAction} testId="p" />)
    const btn = panel(container).querySelector('[data-testid="p-next-action"]') as HTMLElement
    expect(btn.textContent).toBe('重新增强')
    fireEvent.click(btn)
    expect(onAction).toHaveBeenCalledWith('run_enrichment')
  })

  it("nextAction='none' → 无主按钮", () => {
    const { container } = render(<MetadataStatusPanel summary={makeSummary()} variant="detail" />)
    expect(panel(container).querySelector('[data-panel-next-action]')).toBeNull()
  })

  it('nextAction != none 但未传 onAction → 不渲染死按钮（避免 no-op 主操作）', () => {
    const s = makeSummary({}, { nextAction: 'run_enrichment' })
    const { container } = render(<MetadataStatusPanel summary={s} variant="detail" />)
    expect(panel(container).querySelector('[data-panel-next-action]')).toBeNull()
  })

  it('per-provider：candidate 来源卡动作 → onAction(confirm_candidate, provider)', () => {
    const onAction = vi.fn()
    const s = makeSummary({ bangumi: { state: 'candidate', externalId: '123' } })
    const { container } = render(<MetadataStatusPanel summary={s} variant="detail" onAction={onAction} />)
    const card = panel(container).querySelector('[data-metadata-source-card][data-provider="bangumi"]') as HTMLElement
    const btn = within(card).getByRole('button')
    expect(btn.textContent).toBe('确认候选')
    fireEvent.click(btn)
    expect(onAction).toHaveBeenCalledWith('confirm_candidate', 'bangumi')
  })

  it('per-provider：problem 来源卡 → onAction(review_conflict, provider) + danger 按钮', () => {
    const onAction = vi.fn()
    const s = makeSummary({ douban: { state: 'problem', externalId: '9' } })
    const { container } = render(<MetadataStatusPanel summary={s} variant="detail" onAction={onAction} />)
    const card = panel(container).querySelector('[data-metadata-source-card][data-provider="douban"]') as HTMLElement
    const btn = within(card).getByRole('button')
    expect(btn.textContent).toBe('复核冲突')
    fireEvent.click(btn)
    expect(onAction).toHaveBeenCalledWith('review_conflict', 'douban')
  })

  it('applied/missing 来源卡无动作按钮', () => {
    const s = makeSummary({ douban: { state: 'applied', externalId: '1' }, tmdb: { state: 'missing' } })
    const { container } = render(<MetadataStatusPanel summary={s} variant="detail" />)
    const douban = panel(container).querySelector('[data-metadata-source-card][data-provider="douban"]') as HTMLElement
    const tmdb = panel(container).querySelector('[data-metadata-source-card][data-provider="tmdb"]') as HTMLElement
    expect(within(douban).queryByRole('button')).toBeNull()
    expect(within(tmdb).queryByRole('button')).toBeNull()
  })
})

describe('MetadataStatusPanel — sourceEvidence slot', () => {
  it('detail + sourceEvidence → 渲染来源证据区', () => {
    const { container } = render(
      <MetadataStatusPanel summary={makeSummary()} variant="detail" sourceEvidence={<div data-testid="ev">证据</div>} />,
    )
    const ev = panel(container).querySelector('[data-panel-source-evidence]') as HTMLElement
    expect(ev).not.toBeNull()
    expect(within(ev).getByTestId('ev')).not.toBeNull()
  })

  it('compact + sourceEvidence → 不渲染证据区', () => {
    const { container } = render(
      <MetadataStatusPanel summary={makeSummary()} variant="compact" sourceEvidence={<div>证据</div>} />,
    )
    expect(panel(container).querySelector('[data-panel-source-evidence]')).toBeNull()
  })

  it('detail 无 sourceEvidence → 不渲染证据区', () => {
    const { container } = render(<MetadataStatusPanel summary={makeSummary()} variant="detail" />)
    expect(panel(container).querySelector('[data-panel-source-evidence]')).toBeNull()
  })
})

describe('MetadataStatusPanel — 来源卡字段 + SSR', () => {
  it('来源卡展示外部 ID 外链 + 匹配方式 + 置信度', () => {
    const s = makeSummary({ douban: { state: 'applied', externalId: '3541415', matchMethod: 'manual', confidence: 0.92 } })
    const { container } = render(<MetadataStatusPanel summary={s} variant="detail" />)
    const card = panel(container).querySelector('[data-metadata-source-card][data-provider="douban"]') as HTMLElement
    const link = card.querySelector('a') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://movie.douban.com/subject/3541415/')
    expect(card.textContent).toContain('人工')
    expect(card.textContent).toContain('置信度 92%')
  })

  it('renderToString 不崩，含 panel + 四来源卡', () => {
    const html = renderToString(<MetadataStatusPanel summary={makeSummary()} variant="detail" />)
    expect(html).toContain('data-metadata-status-panel')
    expect((html.match(/data-metadata-source-card/g) ?? []).length).toBe(4)
  })
})
