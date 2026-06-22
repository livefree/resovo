/**
 * ImageGovernanceDrawer.test.tsx — 图片治理抽屉编排视图测试（IMGH-P2-3A / SEQ-20260619-02）
 *
 * 覆盖三治理流程 + 数据契约：
 * - 候选补图：拉候选 → 选候选 → ImageCompare 探活达标 → 确认 → applyImageCandidate(§C source/sourceRef) → onMutated
 * - 手填 URL：输入 → 替换 → useVideoImages.update('poster', url) → onMutated
 * - 标记已解决：row.eventId → resolveImageEvents([eventId]) → onMutated；eventId=null → 按钮禁用
 * - 图片矩阵渲染 4 类 + 破损详情区
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const listCandidatesMock = vi.hoisted(() => vi.fn())
const applyMock = vi.hoisted(() => vi.fn())
const resolveMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/image-health/api', () => ({
  listImageCandidates: listCandidatesMock,
  applyImageCandidate: applyMock,
  resolveImageEvents: resolveMock,
}))

const updateMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const useVideoImagesMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/videos/use-images', () => ({
  useVideoImages: useVideoImagesMock,
}))

import { ImageGovernanceDrawer } from '@/app/admin/image-health/_client/ImageGovernanceDrawer'
import type { MissingVideoRow } from '@/lib/image-health/api'

function makeRow(over: Partial<MissingVideoRow> = {}): MissingVideoRow {
  return {
    videoId: 'v-1', catalogId: 'c-1', title: '沙丘', posterStatus: 'broken',
    posterUrl: 'https://cdn/cur.jpg', posterSource: 'tmdb',
    lastSeenBrokenAt: '2026-06-20', brokenDomain: 'img3.tmdb.org', occurrenceCount: 12,
    eventType: 'fetch_404', eventId: 'evt-1', candidateCount: 1, hasHighConfidenceCandidate: true,
    ...over,
  }
}

const IMAGES = {
  poster: { url: 'https://cdn/p.jpg', status: 'broken' },
  backdrop: { url: 'https://cdn/b.jpg', status: 'ok' },
  logo: { url: null, status: 'missing' },
  banner_backdrop: { url: null, status: null },
  lastStatusUpdatedAt: null,
}

beforeEach(() => {
  listCandidatesMock.mockReset().mockResolvedValue([])
  applyMock.mockReset().mockResolvedValue({ applied: true, status: 'pending_review' })
  resolveMock.mockReset().mockResolvedValue({ resolvedCount: 1 })
  updateMock.mockReset().mockResolvedValue(undefined)
  useVideoImagesMock.mockReset().mockReturnValue([
    { images: IMAGES, loading: false, error: null, updatePending: new Set() },
    { reload: vi.fn(), update: updateMock },
  ])
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('ImageGovernanceDrawer — 渲染', () => {
  it('open=false → 抽屉不显示内容', () => {
    render(<ImageGovernanceDrawer open={false} row={makeRow()} onClose={vi.fn()} onMutated={vi.fn()} />)
    expect(document.querySelector('[data-governance-body]')).toBeNull()
  })

  it('open + row → 图片矩阵 4 类 + 破损详情', () => {
    render(<ImageGovernanceDrawer open row={makeRow()} onClose={vi.fn()} onMutated={vi.fn()} />)
    expect(document.querySelector('[data-matrix-cell="poster"]')).not.toBeNull()
    expect(document.querySelector('[data-matrix-cell="backdrop"]')).not.toBeNull()
    expect(document.querySelector('[data-matrix-cell="logo"]')).not.toBeNull()
    expect(document.querySelector('[data-matrix-cell="banner_backdrop"]')).not.toBeNull()
    const detail = document.querySelector('[data-broken-detail]')?.textContent ?? ''
    expect(detail).toContain('fetch_404')
    expect(detail).toContain('img3.tmdb.org')
    expect(detail).toContain('12')
  })
})

describe('ImageGovernanceDrawer — 候选补图流程（§C source/sourceRef）', () => {
  it('选候选 → 探活达标 → 确认 → applyImageCandidate + onMutated', async () => {
    listCandidatesMock.mockResolvedValue([
      { source: 'tmdb', sourceRef: 'ref-9', url: 'https://cdn/cand.jpg', confidence: 0.9, isWinner: true, applied: false, trust: 4 },
    ])
    const onMutated = vi.fn()
    render(<ImageGovernanceDrawer open row={makeRow()} onClose={vi.fn()} onMutated={onMutated} />)

    // 候选异步加载 → 卡出现
    const card = await screen.findByTestId('governance-candidate-picker').then(
      () => document.querySelector('[data-candidate-card="tmdb::ref-9"]') as HTMLElement,
    )
    expect(card).not.toBeNull()
    fireEvent.click(card)

    // ImageCompare 出现 → 加载候选图达标 → 确认启用
    const candImg = document.querySelector('[data-compare-img="candidate"]') as HTMLImageElement
    Object.defineProperty(candImg, 'naturalWidth', { value: 600, configurable: true })
    Object.defineProperty(candImg, 'naturalHeight', { value: 900, configurable: true })
    fireEvent.load(candImg)

    const confirm = document.querySelector('[data-compare-confirm]') as HTMLButtonElement
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)

    await waitFor(() => expect(applyMock).toHaveBeenCalledWith({
      catalogId: 'c-1', videoId: 'v-1', field: 'coverUrl', source: 'tmdb', sourceRef: 'ref-9',
    }))
    await waitFor(() => expect(onMutated).toHaveBeenCalledWith('v-1'))
  })

  it('无候选 → EmptyState 提示手填', async () => {
    listCandidatesMock.mockResolvedValue([])
    render(<ImageGovernanceDrawer open row={makeRow()} onClose={vi.fn()} onMutated={vi.fn()} />)
    expect(await screen.findByText('暂无跨源候选')).not.toBeNull()
  })
})

describe('ImageGovernanceDrawer — 手填 URL 流程', () => {
  it('输入 URL → 替换 → useVideoImages.update(poster) + onMutated', async () => {
    const onMutated = vi.fn()
    render(<ImageGovernanceDrawer open row={makeRow()} onClose={vi.fn()} onMutated={onMutated} />)
    // AdminInput 的 data-testid 落在容器 → 取其内 input 元素
    const input = screen.getByTestId('governance-manual-url').querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://new/cover.jpg' } })
    fireEvent.click(screen.getByTestId('governance-manual-apply'))
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('poster', 'https://new/cover.jpg'))
    await waitFor(() => expect(onMutated).toHaveBeenCalledWith('v-1'))
  })

  it('空 URL → 替换按钮禁用', () => {
    render(<ImageGovernanceDrawer open row={makeRow()} onClose={vi.fn()} onMutated={vi.fn()} />)
    expect((screen.getByTestId('governance-manual-apply') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('ImageGovernanceDrawer — 标记已解决流程', () => {
  it('row.eventId → resolveImageEvents([eventId]) + onMutated', async () => {
    const onMutated = vi.fn()
    render(<ImageGovernanceDrawer open row={makeRow({ eventId: 'evt-7' })} onClose={vi.fn()} onMutated={onMutated} />)
    fireEvent.click(screen.getByTestId('governance-resolve'))
    await waitFor(() => expect(resolveMock).toHaveBeenCalledWith(['evt-7']))
    await waitFor(() => expect(onMutated).toHaveBeenCalledWith('v-1'))
  })

  it('eventId=null → 标记已解决按钮禁用（无事件可解决）', () => {
    render(<ImageGovernanceDrawer open row={makeRow({ eventId: null })} onClose={vi.fn()} onMutated={vi.fn()} />)
    expect((screen.getByTestId('governance-resolve') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('ImageGovernanceDrawer — focusKind 跨 kind 深链（ADR-211 D-211-3）', () => {
  it('focusKind 省略 → 默认 poster（向后兼容 Tab B）：候选拉 coverUrl + 手填 update(poster)', async () => {
    render(<ImageGovernanceDrawer open row={makeRow()} onClose={vi.fn()} onMutated={vi.fn()} />)
    await waitFor(() => expect(listCandidatesMock).toHaveBeenCalledWith('c-1', 'coverUrl'))
    expect(screen.getByText('替换封面 · 从外部源候选')).not.toBeNull()
  })

  it('focusKind=backdrop → 候选拉 backdropUrl + 标题「替换背景」+ 手填 update(backdrop)', async () => {
    listCandidatesMock.mockResolvedValue([])
    render(<ImageGovernanceDrawer open row={makeRow()} focusKind="backdrop" onClose={vi.fn()} onMutated={vi.fn()} />)
    await waitFor(() => expect(listCandidatesMock).toHaveBeenCalledWith('c-1', 'backdropUrl'))
    expect(screen.getByText('替换背景 · 从外部源候选')).not.toBeNull()
    const input = screen.getByTestId('governance-manual-url').querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://new/bd.jpg' } })
    fireEvent.click(screen.getByTestId('governance-manual-apply'))
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('backdrop', 'https://new/bd.jpg'))
  })

  it('focusKind=banner_backdrop → 无跨源候选字段，候选区隐藏（仅手填，不调 listImageCandidates）', () => {
    render(<ImageGovernanceDrawer open row={makeRow()} focusKind="banner_backdrop" onClose={vi.fn()} onMutated={vi.fn()} />)
    expect(document.querySelector('[data-no-candidate]')).not.toBeNull()
    expect(screen.queryByTestId('governance-candidate-picker')).toBeNull()
    expect(listCandidatesMock).not.toHaveBeenCalled()
  })
})
