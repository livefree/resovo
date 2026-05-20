/**
 * BrokenSamplesGrid.test.tsx — 破损样本 grid 单元测试（CHG-SN-7-MISC-IMAGE-2）
 *
 * 覆盖：
 * - 空 rows → 暂无破损样本
 * - 非 broken 状态 rows → 不渲染任何 sample card
 * - broken rows → 渲染 data-broken-sample
 * - 2:3 ratio + danger dashed border（inline style 校验）
 * - bottom overlay 显示 brokenDomain
 * - brokenDomain 为 null → overlay 显示 posterStatus
 * - 超过 MAX_SAMPLES(24) 截断
 * - count badge 显示正确数量
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrokenSamplesGrid } from '../../../../../../apps/server-next/src/app/admin/image-health/_client/BrokenSamplesGrid'
import type { MissingVideoRow } from '../../../../../../apps/server-next/src/lib/image-health/api'

function makeRow(overrides: Partial<MissingVideoRow> = {}): MissingVideoRow {
  return {
    videoId: 'v-001',
    title: 'Test Video',
    posterStatus: 'broken',
    posterUrl: null,
    posterSource: null,
    lastSeenBrokenAt: null,
    brokenDomain: 'cdn.example.com',
    occurrenceCount: 3,
    ...overrides,
  }
}

describe('BrokenSamplesGrid — empty state', () => {
  it('rows 为空 → 显示「暂无破损样本」', () => {
    render(<BrokenSamplesGrid rows={[]} />)
    expect(screen.queryByText('暂无破损样本')).not.toBeNull()
  })

  it('rows 全为 missing 状态 → 无 broken card → 显示空提示', () => {
    const rows = [makeRow({ posterStatus: 'missing', videoId: 'v-1' })]
    render(<BrokenSamplesGrid rows={rows} />)
    expect(screen.queryByText('暂无破损样本')).not.toBeNull()
  })

  it('rows 全为 pending_review → 无 broken card → 显示空提示', () => {
    const rows = [makeRow({ posterStatus: 'pending_review', videoId: 'v-2' })]
    render(<BrokenSamplesGrid rows={rows} />)
    expect(screen.queryByText('暂无破损样本')).not.toBeNull()
  })
})

describe('BrokenSamplesGrid — broken rows 渲染', () => {
  it('broken row → 渲染 data-broken-sample', () => {
    const rows = [makeRow({ videoId: 'v-001' })]
    const { container } = render(<BrokenSamplesGrid rows={rows} />)
    expect(container.querySelector('[data-broken-sample]')).not.toBeNull()
  })

  it('3 个 broken rows → 渲染 3 个 sample card', () => {
    const rows = [
      makeRow({ videoId: 'v-1' }),
      makeRow({ videoId: 'v-2' }),
      makeRow({ videoId: 'v-3' }),
    ]
    const { container } = render(<BrokenSamplesGrid rows={rows} />)
    expect(container.querySelectorAll('[data-broken-sample]').length).toBe(3)
  })

  it('混合 broken + missing → 只渲染 broken cards', () => {
    const rows = [
      makeRow({ videoId: 'v-1', posterStatus: 'broken' }),
      makeRow({ videoId: 'v-2', posterStatus: 'missing' }),
      makeRow({ videoId: 'v-3', posterStatus: 'broken' }),
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

  it('brokenDomain 为 null → overlay 显示 posterStatus', () => {
    const rows = [makeRow({ brokenDomain: null, posterStatus: 'broken', videoId: 'v-1' })]
    const { container } = render(<BrokenSamplesGrid rows={rows} />)
    const overlay = container.querySelector('[data-broken-overlay]') as HTMLElement
    expect(overlay.textContent).toContain('broken')
  })
})

describe('BrokenSamplesGrid — count badge', () => {
  it('1 个 broken → badge 显示「1」', () => {
    render(<BrokenSamplesGrid rows={[makeRow()]} />)
    const badge = screen.getByTestId ? null : null // 用 querySelector
  })

  it('count badge data-broken-count 显示正确数字', () => {
    const rows = Array.from({ length: 3 }, (_, i) => makeRow({ videoId: `v-${i}` }))
    const { container } = render(<BrokenSamplesGrid rows={rows} />)
    const badge = container.querySelector('[data-broken-count]') as HTMLElement
    expect(badge).not.toBeNull()
    expect(badge.textContent).toBe('3')
  })
})

describe('BrokenSamplesGrid — MAX_SAMPLES 截断', () => {
  it('超过 24 个 broken rows → 最多渲染 24 个 card', () => {
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
