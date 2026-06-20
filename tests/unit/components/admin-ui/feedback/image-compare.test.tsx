/**
 * image-compare.test.tsx — ImageCompare 共享组件单元测试（IMGH-P2-2A / SEQ-20260619-02）
 *
 * 覆盖 arch-reviewer 契约要点：open 守卫 / 双侧渲染 / 候选探活+尺寸校验闸门
 *   / 确认 enabled 条件（reachable && meetsMinDimension）/ onConfirm 回传尺寸不调 API
 *   / 尺寸过小禁用+提示 / onError 不可达禁用 / candidate.url=null 待选占位禁用
 *   / onCancel / onCandidateValidated 回传 / minWidth/minHeight 覆盖 / metaSlot 逃生口 / status Pill
 */

import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ImageCompare } from '../../../../../packages/admin-ui/src/components/feedback/image-compare'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const CUR = 'https://cdn.example.com/current.jpg'
const CAND = 'https://cdn.example.com/candidate.jpg'

function loadImg(prefix: 'current' | 'candidate', width: number, height: number): void {
  const img = document.querySelector(`[data-compare-img="${prefix}"]`) as HTMLImageElement
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true })
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true })
  fireEvent.load(img)
}

function side(url: string | null, extra: Record<string, unknown> = {}) {
  return { url, alt: 'x', ...extra }
}

describe('ImageCompare — open 守卫 + 渲染', () => {
  it('open=false → 不渲染', () => {
    const { container } = render(
      <ImageCompare open={false} current={side(CUR)} candidate={side(CAND)} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(container.querySelector('[data-image-compare]')).toBeNull()
  })

  it('open=true → 渲染双侧 + 确认/取消按钮 + testId', () => {
    render(
      <ImageCompare open current={side(CUR)} candidate={side(CAND)} onConfirm={vi.fn()} onCancel={vi.fn()} testId="cmp-x" />,
    )
    expect(screen.getByTestId('cmp-x')).not.toBeNull()
    expect(document.querySelector('[data-compare-side="current"]')).not.toBeNull()
    expect(document.querySelector('[data-compare-side="candidate"]')).not.toBeNull()
    expect(document.querySelector('[data-compare-confirm]')).not.toBeNull()
    expect(document.querySelector('[data-compare-cancel]')).not.toBeNull()
  })

  it('status 提供 → 渲染 Pill', () => {
    render(
      <ImageCompare
        open
        current={side(CUR, { status: 'broken' })}
        candidate={side(CAND, { status: 'pending_review' })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('破损')).not.toBeNull()
    expect(screen.getByText('待复核')).not.toBeNull()
  })
})

describe('ImageCompare — 候选探活 + 尺寸校验闸门', () => {
  it('候选加载成功且尺寸达标 → 确认 enabled + onConfirm 回传尺寸', () => {
    const onConfirm = vi.fn()
    render(<ImageCompare open current={side(CUR)} candidate={side(CAND)} onConfirm={onConfirm} onCancel={vi.fn()} />)
    const confirmBtn = document.querySelector('[data-compare-confirm]') as HTMLButtonElement
    // 加载前：禁用
    expect(confirmBtn.disabled).toBe(true)
    loadImg('candidate', 600, 900)
    expect(confirmBtn.disabled).toBe(false)
    expect(document.querySelector('[data-compare-reach="candidate"]')?.textContent).toContain('可达')
    fireEvent.click(confirmBtn)
    expect(onConfirm).toHaveBeenCalledWith({ candidateUrl: CAND, candidateSize: { width: 600, height: 900 } })
  })

  it('候选尺寸过小（< 默认 200）→ 确认禁用 + 提示', () => {
    const onConfirm = vi.fn()
    render(<ImageCompare open current={side(CUR)} candidate={side(CAND)} onConfirm={onConfirm} onCancel={vi.fn()} />)
    loadImg('candidate', 150, 150)
    const confirmBtn = document.querySelector('[data-compare-confirm]') as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)
    expect(document.querySelector('[data-compare-hint]')?.textContent).toContain('尺寸过小')
    fireEvent.click(confirmBtn)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('候选加载失败（onError）→ 不可达 + 确认禁用 + 提示', () => {
    render(<ImageCompare open current={side(CUR)} candidate={side(CAND)} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const img = document.querySelector('[data-compare-img="candidate"]') as HTMLImageElement
    fireEvent.error(img)
    expect((document.querySelector('[data-compare-confirm]') as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelector('[data-compare-reach="candidate"]')?.textContent).toContain('不可达')
    expect(document.querySelector('[data-compare-hint]')?.textContent).toContain('不可达')
  })

  it('candidate.url=null → 待选图占位 + 确认恒禁用', () => {
    render(<ImageCompare open current={side(CUR)} candidate={side(null)} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect((document.querySelector('[data-compare-confirm]') as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelector('[data-compare-fallback="candidate"]')?.textContent).toContain('待选图')
  })

  it('minWidth/minHeight 覆盖默认阈值 → 较大候选仍可被拦', () => {
    render(
      <ImageCompare open current={side(CUR)} candidate={side(CAND)} onConfirm={vi.fn()} onCancel={vi.fn()} minWidth={800} minHeight={800} />,
    )
    loadImg('candidate', 600, 900)  // 600 < 800 → 不达标
    expect((document.querySelector('[data-compare-confirm]') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('ImageCompare — 回调 + 逃生口', () => {
  it('取消按钮 → onCancel', () => {
    const onCancel = vi.fn()
    render(<ImageCompare open current={side(CUR)} candidate={side(CAND)} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(document.querySelector('[data-compare-cancel]') as HTMLElement)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('onCandidateValidated 在候选加载后回传校验态', () => {
    const onValidated = vi.fn()
    render(
      <ImageCompare open current={side(CUR)} candidate={side(CAND)} onConfirm={vi.fn()} onCancel={vi.fn()} onCandidateValidated={onValidated} />,
    )
    loadImg('candidate', 600, 900)
    expect(onValidated).toHaveBeenLastCalledWith({
      reachable: true, meetsMinDimension: true, size: { width: 600, height: 900 },
    })
  })

  it('metaSlot 逃生口 → 接管对比区（不渲染内置双侧）', () => {
    render(
      <ImageCompare
        open
        current={side(CUR)}
        candidate={side(CAND)}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        metaSlot={<div data-testid="custom-meta">自定义对比</div>}
      />,
    )
    expect(screen.getByTestId('custom-meta')).not.toBeNull()
    expect(document.querySelector('[data-compare-side="current"]')).toBeNull()
  })
})
