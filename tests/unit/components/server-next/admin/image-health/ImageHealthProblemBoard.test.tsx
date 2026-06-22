/**
 * ImageHealthProblemBoard.test.tsx — 问题图片可视化治理板单元测试（ADR-211 / IMGH-P3-4B）
 *
 * 覆盖：
 * - 初次加载默认 kind=poster / scope=published / offset=0 / limit=48
 * - 网格渲染 ProblemImageCard / 空态 EmptyState
 * - kind tab badge=counts / 切 kind|scope → 重拉（offset 重置）
 * - reason 子筛选客户端过滤（真破损 = client_error ∪ broken）
 * - 加载更多：offset 累积 + videoId+kind 去重追加（漂移缓解①，Codex H-3）
 * - 点卡 → 打开 ImageGovernanceDrawer（focusKind 深链）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const getProblemImagesMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/image-health/api', () => ({
  getProblemImages: getProblemImagesMock,
  // 抽屉（点卡打开时）消费：banner 无候选用不到，poster focusKind 拉 coverUrl
  listImageCandidates: vi.fn().mockResolvedValue([]),
  applyImageCandidate: vi.fn().mockResolvedValue({ applied: true, status: 'pending_review' }),
  resolveImageEvents: vi.fn().mockResolvedValue({ resolvedCount: 1 }),
}))

vi.mock('@/lib/videos/use-images', () => ({
  useVideoImages: () => [
    {
      images: {
        poster: { url: 'https://x/p.jpg', status: 'low_quality' },
        backdrop: { url: null, status: null },
        logo: { url: null, status: null },
        banner_backdrop: { url: null, status: null },
      },
      loading: false,
      error: null,
      updatePending: new Set(),
    },
    { reload: vi.fn(), update: vi.fn() },
  ],
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({ push: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

import { ImageHealthProblemBoard } from '@/app/admin/image-health/_client/ImageHealthProblemBoard'
import type { ProblemImageRow, ProblemImageCounts } from '@/lib/image-health/api'

const COUNTS: ProblemImageCounts = { poster: 25, backdrop: 41, logo: 35, banner_backdrop: 0 }

function makeRow(over: Partial<ProblemImageRow> = {}): ProblemImageRow {
  return {
    videoId: 'v-1', catalogId: 'c-1', title: '沙丘', isPublished: true,
    kind: 'poster', imageUrl: 'https://cdn/p.jpg', status: 'low_quality',
    problemReason: 'low_quality', source: 'tmdb', eventType: null,
    brokenDomain: null, occurrenceCount: 0, lastSeenBrokenAt: null,
    ...over,
  }
}

function pageOf(rows: ProblemImageRow[], total: number, counts = COUNTS) {
  return { data: rows, total, counts }
}

beforeEach(() => {
  getProblemImagesMock.mockReset().mockResolvedValue(pageOf([], 0))
})
afterEach(() => cleanup())

describe('ImageHealthProblemBoard — 初次加载与渲染', () => {
  it('初次加载默认 kind=poster / scope=published / offset=0 / limit=48', async () => {
    render(<ImageHealthProblemBoard />)
    await waitFor(() => {
      expect(getProblemImagesMock).toHaveBeenCalledWith({
        kind: 'poster', scope: 'published', offset: 0, limit: 48,
      })
    })
  })

  it('有数据 → 渲染 ProblemImageCard 网格', async () => {
    getProblemImagesMock.mockResolvedValue(pageOf([makeRow({ videoId: 'a' }), makeRow({ videoId: 'b' })], 2))
    const { container } = render(<ImageHealthProblemBoard />)
    await waitFor(() => {
      expect(container.querySelectorAll('[data-problem-card]').length).toBe(2)
    })
  })

  it('空 → EmptyState「暂无问题图片」', async () => {
    render(<ImageHealthProblemBoard />)
    await waitFor(() => expect(screen.getByText('暂无问题图片')).not.toBeNull())
  })

  it('kind tab badge 反映 counts（封面 25 / 背景 41 ...）', async () => {
    const { container } = render(<ImageHealthProblemBoard />)
    await waitFor(() => {
      const seg = container.querySelector('[data-testid="problem-board-kind-segment"]') as HTMLElement
      expect(seg.textContent).toContain('封面 25')
      expect(seg.textContent).toContain('背景 41')
    })
  })
})

describe('ImageHealthProblemBoard — tab/scope 切换重拉', () => {
  it('切 kind=背景 → getProblemImages kind=backdrop（offset 重置 0）', async () => {
    getProblemImagesMock.mockResolvedValue(pageOf([], 0))
    render(<ImageHealthProblemBoard />)
    await waitFor(() => screen.getByText('背景 41'))
    fireEvent.click(screen.getByText('背景 41'))
    await waitFor(() => {
      expect(getProblemImagesMock).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'backdrop', scope: 'published', offset: 0 }),
      )
    })
  })

  it('切 scope=全部 → getProblemImages scope=all', async () => {
    render(<ImageHealthProblemBoard />)
    await waitFor(() => screen.getByTestId('problem-board-scope-segment'))
    // scope 与 reason 子筛选都有「全部」label → 用 data-value 在 scope segment 内精确定位
    const allItem = document.querySelector(
      '[data-testid="problem-board-scope-segment"] [data-value="all"]',
    ) as HTMLElement
    fireEvent.click(allItem)
    await waitFor(() => {
      expect(getProblemImagesMock).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'poster', scope: 'all', offset: 0 }),
      )
    })
  })
})

describe('ImageHealthProblemBoard — reason 子筛选（客户端，H-2）', () => {
  it('「真破损」→ 仅 client_error/broken 卡可见（low_quality 过滤掉）', async () => {
    getProblemImagesMock.mockResolvedValue(pageOf([
      makeRow({ videoId: 'a', problemReason: 'client_error' }),
      makeRow({ videoId: 'b', problemReason: 'low_quality' }),
      makeRow({ videoId: 'c', problemReason: 'broken' }),
    ], 3))
    const { container } = render(<ImageHealthProblemBoard />)
    await waitFor(() => expect(container.querySelectorAll('[data-problem-card]').length).toBe(3))
    fireEvent.click(screen.getByText('真破损'))
    await waitFor(() => {
      const reasons = Array.from(container.querySelectorAll('[data-problem-card]'))
        .map((el) => el.getAttribute('data-problem-reason'))
      expect(reasons).toEqual(['client_error', 'broken'])
    })
  })

  it('「未验证」→ 仅 unknown 卡可见（IMGH-P4-BOARD-UX）', async () => {
    getProblemImagesMock.mockResolvedValue(pageOf([
      makeRow({ videoId: 'a', problemReason: 'unknown' }),
      makeRow({ videoId: 'b', problemReason: 'low_quality' }),
      makeRow({ videoId: 'c', problemReason: 'broken' }),
    ], 3))
    const { container } = render(<ImageHealthProblemBoard />)
    await waitFor(() => expect(container.querySelectorAll('[data-problem-card]').length).toBe(3))
    // '未验证' 同时出现在筛选 Segment 与 unknown 卡 Pill → 限定点筛选 Segment 内的
    const reasonSeg = container.querySelector('[data-testid="problem-board-reason-segment"]') as HTMLElement
    fireEvent.click(within(reasonSeg).getByText('未验证'))
    await waitFor(() => {
      const reasons = Array.from(container.querySelectorAll('[data-problem-card]'))
        .map((el) => el.getAttribute('data-problem-reason'))
      expect(reasons).toEqual(['unknown'])
    })
  })
})

describe('ImageHealthProblemBoard — 加载更多（offset 累积 + 去重，H-3）', () => {
  it('加载更多 → offset=48 + videoId+kind 去重追加（边界重复行不重复渲染）', async () => {
    getProblemImagesMock
      .mockResolvedValueOnce(pageOf([makeRow({ videoId: 'a' }), makeRow({ videoId: 'b' })], 60))
      .mockResolvedValueOnce(pageOf([makeRow({ videoId: 'b' }), makeRow({ videoId: 'c' })], 60))
    const { container } = render(<ImageHealthProblemBoard />)
    await waitFor(() => expect(container.querySelectorAll('[data-problem-card]').length).toBe(2))
    // total 60 > 已请求 48 → 显示加载更多
    fireEvent.click(screen.getByTestId('problem-board-load-more'))
    await waitFor(() => {
      // 第二次请求 offset=48
      expect(getProblemImagesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 48 }),
      )
      // 去重：a + b + c（b 重复仅一次）
      expect(container.querySelectorAll('[data-problem-card]').length).toBe(3)
    })
  })

  it('total ≤ 48 → 无加载更多按钮', async () => {
    getProblemImagesMock.mockResolvedValue(pageOf([makeRow({ videoId: 'a' })], 1))
    render(<ImageHealthProblemBoard />)
    await waitFor(() => screen.getByTestId('image-health-problem-board'))
    expect(screen.queryByTestId('problem-board-load-more')).toBeNull()
  })
})

describe('ImageHealthProblemBoard — 点卡进治理抽屉（focusKind 深链）', () => {
  it('点击卡片 → 打开 ImageGovernanceDrawer（GovernanceBody 挂载）', async () => {
    getProblemImagesMock.mockResolvedValue(pageOf([makeRow({ videoId: 'a', title: '深链作品' })], 1))
    const { container } = render(<ImageHealthProblemBoard />)
    await waitFor(() => expect(container.querySelector('[data-problem-card] button')).not.toBeNull())
    fireEvent.click(container.querySelector('[data-problem-card] button') as HTMLElement)
    await waitFor(() => expect(document.querySelector('[data-governance-body]')).not.toBeNull())
  })
})
