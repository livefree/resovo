/**
 * ProblemImageCard.test.tsx — 问题图片卡单元测试（ADR-211 D-211-3/D-211-6 / IMGH-P3-4B）
 *
 * 覆盖：
 * - 缩略 = 真实 imageUrl（data-problem-thumb）
 * - onError → 「✗ 加载失败」失败态（data-problem-failed，非原生裂图，D-211-6）
 * - 卡下显影片标题（取代域名）
 * - problemReason 分色（data-problem-reason + Pill 文案）
 * - 点击 → onOpen(row)
 * - hover/focus → 详情浮层（opacity 切换）
 * - secondary 空字段隐藏（source=null 不渲染「来源」，Codex L-2）
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ProblemImageCard } from '@/app/admin/image-health/_client/ProblemImageCard'
import type { ProblemImageRow } from '@/lib/image-health/api'

afterEach(() => cleanup())

function makeRow(over: Partial<ProblemImageRow> = {}): ProblemImageRow {
  return {
    videoId: 'v-1',
    catalogId: 'c-1',
    title: '沙丘',
    isPublished: true,
    kind: 'poster',
    imageUrl: 'https://cdn.example.com/p.jpg',
    status: 'low_quality',
    problemReason: 'low_quality',
    source: 'tmdb',
    eventType: null,
    brokenDomain: null,
    occurrenceCount: 0,
    lastSeenBrokenAt: null,
    ...over,
  }
}

describe('ProblemImageCard — 缩略与失败态', () => {
  it('渲染真实 imageUrl 缩略（data-problem-thumb）', () => {
    const { container } = render(<ProblemImageCard row={makeRow()} onOpen={vi.fn()} />)
    const img = container.querySelector('[data-problem-thumb]') as HTMLImageElement
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/p.jpg')
  })

  it('onError → 失败态（data-problem-failed），缩略 img 移除（非原生裂图）', () => {
    const { container } = render(<ProblemImageCard row={makeRow()} onOpen={vi.fn()} />)
    const img = container.querySelector('[data-problem-thumb]') as HTMLImageElement
    fireEvent.error(img)
    expect(container.querySelector('[data-problem-failed]')).not.toBeNull()
    expect(container.querySelector('[data-problem-thumb]')).toBeNull()
    expect(container.querySelector('[data-problem-failed]')?.textContent).toContain('加载失败')
  })
})

describe('ProblemImageCard — 标题 / reason 分色', () => {
  it('卡下显影片标题（取代域名）', () => {
    const { container } = render(<ProblemImageCard row={makeRow({ title: '奥本海默' })} onOpen={vi.fn()} />)
    expect(container.querySelector('[data-problem-title]')?.textContent).toBe('奥本海默')
  })

  it('data-problem-reason 反映 problemReason + reason pill 文案', () => {
    const { container, rerender } = render(
      <ProblemImageCard row={makeRow({ problemReason: 'client_error' })} onOpen={vi.fn()} />,
    )
    expect(container.querySelector('[data-problem-reason]')?.getAttribute('data-problem-reason')).toBe('client_error')
    expect(screen.getByText('加载失败')).not.toBeNull()
    rerender(<ProblemImageCard row={makeRow({ problemReason: 'low_quality' })} onOpen={vi.fn()} />)
    expect(screen.getByText('低质量')).not.toBeNull()
    // ADR-213 D-213-7：新增 unknown（stale-ok 未验证）
    rerender(<ProblemImageCard row={makeRow({ problemReason: 'unknown' })} onOpen={vi.fn()} />)
    expect(screen.getByText('未验证')).not.toBeNull()
  })
})

describe('ProblemImageCard — 交互', () => {
  it('点击卡片 → onOpen(row)', () => {
    const onOpen = vi.fn()
    const row = makeRow({ videoId: 'v-9' })
    const { container } = render(<ProblemImageCard row={row} onOpen={onOpen} />)
    fireEvent.click(container.querySelector('button') as HTMLElement)
    expect(onOpen).toHaveBeenCalledWith(row)
  })

  it('hover → 详情浮层 opacity 0→1', () => {
    const { container } = render(<ProblemImageCard row={makeRow()} onOpen={vi.fn()} />)
    const detail = container.querySelector('[data-problem-detail]') as HTMLElement
    const btn = container.querySelector('button') as HTMLElement
    expect(detail.style.opacity).toBe('0')
    fireEvent.mouseEnter(btn)
    expect(detail.style.opacity).toBe('1')
    fireEvent.mouseLeave(btn)
    expect(detail.style.opacity).toBe('0')
  })
})

describe('ProblemImageCard — 详情字段（secondary 空隐藏，Codex L-2）', () => {
  it('source 有值 → 详情含「来源」；source=null → 隐藏', () => {
    const { container, rerender } = render(
      <ProblemImageCard row={makeRow({ source: 'tmdb' })} onOpen={vi.fn()} />,
    )
    expect(container.querySelector('[data-problem-detail]')?.textContent).toContain('来源 tmdb')
    rerender(<ProblemImageCard row={makeRow({ source: null })} onOpen={vi.fn()} />)
    expect(container.querySelector('[data-problem-detail]')?.textContent).not.toContain('来源')
  })

  it('eventType/brokenDomain/occurrence/lastSeen 有值 → 详情显示', () => {
    const { container } = render(
      <ProblemImageCard
        row={makeRow({
          problemReason: 'client_error',
          eventType: 'fetch_404',
          brokenDomain: 'cdn.bad.com',
          occurrenceCount: 7,
          lastSeenBrokenAt: '2026-06-20T08:00:00.000Z',
        })}
        onOpen={vi.fn()}
      />,
    )
    const text = container.querySelector('[data-problem-detail]')?.textContent ?? ''
    expect(text).toContain('原因 fetch_404')
    expect(text).toContain('域 cdn.bad.com')
    expect(text).toContain('次数 7')
    expect(text).toContain('最近 2026-06-20')
  })
})
