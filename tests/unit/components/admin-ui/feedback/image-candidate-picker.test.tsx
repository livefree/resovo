/**
 * image-candidate-picker.test.tsx — ImageCandidatePicker 共享组件单元测试（IMGH-P2-2B / SEQ-20260619-02）
 *
 * 覆盖 arch-reviewer 契约要点：候选网格渲染 / 选中受控 + onSelect 回传整 option
 *   / confidence 视觉仅由 isWinner 决定（🟢/🟡）/ applied 标记 / source pill 内置 + renderSourcePill 逃生口
 *   / loading→LoadingState / error→ErrorState(+retry) / 空→EmptyState / loadMoreSlot / 缩略 onError 降级
 */

import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ImageCandidatePicker } from '../../../../../packages/admin-ui/src/components/feedback/image-candidate-picker'
import type { ImageCandidateOption } from '../../../../../packages/admin-ui/src/components/feedback/image-candidate-picker.types'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function opt(over: Partial<ImageCandidateOption> = {}): ImageCandidateOption {
  return {
    key: 'tmdb::ref-1',
    url: 'https://cdn.example.com/c1.jpg',
    source: 'tmdb',
    confidence: 0.9,
    isWinner: true,
    applied: false,
    ...over,
  }
}

describe('ImageCandidatePicker — 候选网格 + 选中', () => {
  it('渲染候选网格 + testId', () => {
    render(<ImageCandidatePicker candidates={[opt(), opt({ key: 'douban::', source: 'douban', isWinner: false })]} onSelect={vi.fn()} testId="pick-x" />)
    expect(screen.getByTestId('pick-x')).not.toBeNull()
    expect(document.querySelectorAll('[data-candidate-card]').length).toBe(2)
  })

  it('点击候选 → onSelect 回传整 option', () => {
    const onSelect = vi.fn()
    const o = opt({ key: 'douban::ref-9', source: 'douban' })
    render(<ImageCandidatePicker candidates={[o]} onSelect={onSelect} />)
    fireEvent.click(document.querySelector('[data-candidate-card="douban::ref-9"]') as HTMLElement)
    expect(onSelect).toHaveBeenCalledWith(o)
  })

  it('selectedKey 受控 → 选中卡 aria-pressed + data-selected', () => {
    render(<ImageCandidatePicker candidates={[opt({ key: 'a::1' }), opt({ key: 'b::2' })]} selectedKey="b::2" onSelect={vi.fn()} />)
    const selected = document.querySelector('[data-candidate-card="b::2"]') as HTMLElement
    expect(selected.getAttribute('aria-pressed')).toBe('true')
    expect(selected.getAttribute('data-selected')).toBe('true')
    expect((document.querySelector('[data-candidate-card="a::1"]') as HTMLElement).getAttribute('aria-pressed')).toBe('false')
  })

  it('confidence 视觉仅由 isWinner 决定（🟢 high / 🟡 low）', () => {
    render(<ImageCandidatePicker candidates={[opt({ key: 'w::1', isWinner: true, confidence: 0.1 }), opt({ key: 'l::2', isWinner: false, confidence: 0.99 })]} onSelect={vi.fn()} />)
    // confidence 数值不影响分级：winner=high 即便 confidence 低；非 winner=low 即便 confidence 高
    expect(document.querySelector('[data-candidate-card="w::1"] [data-candidate-confidence="high"]')).not.toBeNull()
    expect(document.querySelector('[data-candidate-card="l::2"] [data-candidate-confidence="low"]')).not.toBeNull()
  })

  it('applied 候选 → 已应用标记', () => {
    render(<ImageCandidatePicker candidates={[opt({ applied: true })]} onSelect={vi.fn()} />)
    expect(document.querySelector('[data-candidate-applied]')?.textContent).toBe('已应用')
  })

  it('source pill 内置（sourceLabel 优先 source）', () => {
    render(<ImageCandidatePicker candidates={[opt({ sourceLabel: 'tmdb 9.1分 zh' })]} onSelect={vi.fn()} />)
    expect(screen.getByText('tmdb 9.1分 zh')).not.toBeNull()
  })

  it('renderSourcePill 逃生口接管 source 渲染', () => {
    render(<ImageCandidatePicker candidates={[opt()]} onSelect={vi.fn()} renderSourcePill={(o) => <span data-testid="custom-pill">{o.source.toUpperCase()}</span>} />)
    expect(screen.getByTestId('custom-pill').textContent).toBe('TMDB')
  })

  it('缩略 onError → 降级占位', () => {
    render(<ImageCandidatePicker candidates={[opt({ key: 'x::1' })]} onSelect={vi.fn()} />)
    const img = document.querySelector('[data-candidate-thumb="x::1"]') as HTMLImageElement
    fireEvent.error(img)
    expect(document.querySelector('[data-candidate-thumb-fallback]')).not.toBeNull()
  })
})

describe('ImageCandidatePicker — 三态 + loadMore', () => {
  it('loading → LoadingState（不渲染网格）', () => {
    render(<ImageCandidatePicker candidates={[]} loading onSelect={vi.fn()} />)
    expect(document.querySelector('[data-candidate-grid]')).toBeNull()
  })

  it('error → ErrorState + onRetry 可触发', () => {
    const onRetry = vi.fn()
    render(<ImageCandidatePicker candidates={[]} error={{ message: '候选拉取超时', onRetry }} onSelect={vi.fn()} />)
    expect(document.querySelector('[data-error-message]')?.textContent).toBe('候选拉取超时')
    expect(document.querySelector('[data-candidate-grid]')).toBeNull()
    fireEvent.click(document.querySelector('[data-retry-btn]') as HTMLElement)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('空候选 → EmptyState（自定义文案）', () => {
    render(<ImageCandidatePicker candidates={[]} onSelect={vi.fn()} emptyTitle="无候选" emptyDescription="先跑富集" />)
    expect(screen.getByText('无候选')).not.toBeNull()
    expect(screen.getByText('先跑富集')).not.toBeNull()
  })

  it('loadMoreSlot 渲染在候选后', () => {
    render(<ImageCandidatePicker candidates={[opt()]} onSelect={vi.fn()} loadMoreSlot={<button>加载更多</button>} />)
    expect(document.querySelector('[data-candidate-load-more]')?.textContent).toBe('加载更多')
  })
})
