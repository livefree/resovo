/**
 * BrokenSamplesGrid.test.tsx — 破损样本 grid 单元测试
 *
 * ADR-210 / IMGH-P3-1B：数据源改为 recent-broken-samples 端点（broken_image_events 事件流口径）。
 *   每行即破损样本，组件不再 client-side 过滤 posterStatus='broken'（旧设计因 poster_status
 *   全库无 'broken' 恒空 = 破损样本区空白根因）。
 *
 * 覆盖：
 * - 空 rows → 暂无破损样本
 * - 任意行均渲染 sample card（不再依赖 posterStatus 过滤）
 * - 2:3 ratio + danger dashed border（inline style 校验）
 * - bottom overlay 显示 brokenDomain
 * - 点击 → 打开 ImageLightbox（元信息含来源/破损域）
 * - 超过 MAX_SAMPLES(24) 截断
 * - count badge 显示正确数量
 */

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BrokenSamplesGrid } from '../../../../../../apps/server-next/src/app/admin/image-health/_client/BrokenSamplesGrid'
import type { BrokenSampleRow } from '../../../../../../apps/server-next/src/lib/image-health/api'

afterEach(() => cleanup())

function makeRow(overrides: Partial<BrokenSampleRow> = {}): BrokenSampleRow {
  return {
    videoId: 'v-001',
    catalogId: 'c-001',
    title: 'Test Video',
    posterUrl: 'https://cdn.example.com/poster.jpg',
    posterSource: null,
    posterStatus: 'pending_review',
    eventType: 'fetch_404',
    brokenDomain: 'cdn.example.com',
    occurrenceCount: 3,
    lastSeenBrokenAt: '2026-06-20T00:00:00.000Z',
    ...overrides,
  }
}

describe('BrokenSamplesGrid — empty state', () => {
  it('rows 为空 → 显示「暂无破损样本」', () => {
    render(<BrokenSamplesGrid rows={[]} />)
    expect(screen.queryByText('暂无破损样本')).not.toBeNull()
  })
})

describe('BrokenSamplesGrid — 行即破损样本（ADR-210 无 client 过滤）', () => {
  it('单行 → 渲染 data-broken-sample', () => {
    const rows = [makeRow({ videoId: 'v-001' })]
    const { container } = render(<BrokenSamplesGrid rows={rows} />)
    expect(container.querySelector('[data-broken-sample]')).not.toBeNull()
  })

  it('3 行 → 渲染 3 个 sample card', () => {
    const rows = [
      makeRow({ videoId: 'v-1' }),
      makeRow({ videoId: 'v-2' }),
      makeRow({ videoId: 'v-3' }),
    ]
    const { container } = render(<BrokenSamplesGrid rows={rows} />)
    expect(container.querySelectorAll('[data-broken-sample]').length).toBe(3)
  })

  it('posterStatus 非 broken（pending_review/low_quality）也渲染 → 不再 client 过滤', () => {
    const rows = [
      makeRow({ videoId: 'v-1', posterStatus: 'pending_review' }),
      makeRow({ videoId: 'v-2', posterStatus: 'low_quality' }),
    ]
    const { container } = render(<BrokenSamplesGrid rows={rows} />)
    expect(container.querySelectorAll('[data-broken-sample]').length).toBe(2)
  })
})

describe('BrokenSamplesGrid — 样式校验（2:3 ratio + danger dashed border）', () => {
  it('card 具有 2/3 aspect-ratio + dashed border（inline style）', () => {
    const { container } = render(<BrokenSamplesGrid rows={[makeRow()]} />)
    const card = container.querySelector('[data-broken-sample]') as HTMLElement
    expect(card).not.toBeNull()
    expect(card.style.aspectRatio).toBe('2 / 3')
    expect(card.style.border).toContain('dashed')
  })
})

describe('BrokenSamplesGrid — overlay 内容', () => {
  it('brokenDomain 有值 → overlay 显示域名', () => {
    const rows = [makeRow({ brokenDomain: 'cdn.example.com', videoId: 'v-1' })]
    const { container } = render(<BrokenSamplesGrid rows={rows} />)
    const overlay = container.querySelector('[data-broken-overlay]') as HTMLElement
    expect(overlay).not.toBeNull()
    expect(overlay.textContent).toContain('cdn.example.com')
  })
})

describe('BrokenSamplesGrid — 点击打开 ImageLightbox（IMGH-P1-3）', () => {
  it('点击破损样本 → 打开 Lightbox（元信息含来源/破损域）', async () => {
    const rows = [makeRow({ videoId: 'v-1', posterSource: 'tmdb', brokenDomain: 'cdn.example.com', occurrenceCount: 7 })]
    const { container } = render(<BrokenSamplesGrid rows={rows} />)
    expect(document.querySelector('[data-image-lightbox]')).toBeNull()
    fireEvent.click(container.querySelector('[data-broken-sample]') as HTMLElement)
    expect(await screen.findByTestId('broken-sample-lightbox')).not.toBeNull()
    expect(screen.getByTestId('lightbox-meta-source').textContent).toBe('tmdb')
    expect(screen.getByTestId('lightbox-meta-broken').textContent).toContain('cdn.example.com')
  })

  it('Lightbox 关闭后从 DOM 移除', async () => {
    const rows = [makeRow({ videoId: 'v-1' })]
    const { container } = render(<BrokenSamplesGrid rows={rows} />)
    fireEvent.click(container.querySelector('[data-broken-sample]') as HTMLElement)
    await screen.findByTestId('broken-sample-lightbox')
    fireEvent.click(document.querySelector('[data-close-btn]') as HTMLElement)
    expect(document.querySelector('[data-image-lightbox]')).toBeNull()
  })
})

describe('BrokenSamplesGrid — count badge', () => {
  it('count badge data-broken-count 显示正确数字', () => {
    const rows = Array.from({ length: 3 }, (_, i) => makeRow({ videoId: `v-${i}` }))
    const { container } = render(<BrokenSamplesGrid rows={rows} />)
    const badge = container.querySelector('[data-broken-count]') as HTMLElement
    expect(badge).not.toBeNull()
    expect(badge.textContent).toBe('3')
  })
})

describe('BrokenSamplesGrid — MAX_SAMPLES 截断', () => {
  it('超过 24 行 → 最多渲染 24 个 card', () => {
    const rows = Array.from({ length: 30 }, (_, i) => makeRow({ videoId: `v-${i}` }))
    const { container } = render(<BrokenSamplesGrid rows={rows} />)
    expect(container.querySelectorAll('[data-broken-sample]').length).toBe(24)
  })

  it('count badge 截断后显示 24', () => {
    const rows = Array.from({ length: 30 }, (_, i) => makeRow({ videoId: `v-${i}` }))
    const { container } = render(<BrokenSamplesGrid rows={rows} />)
    const badge = container.querySelector('[data-broken-count]') as HTMLElement
    expect(badge.textContent).toBe('24')
  })
})
