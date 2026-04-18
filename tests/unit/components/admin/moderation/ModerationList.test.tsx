/**
 * ModerationList.test.tsx
 * UX-10: 审核台左侧列表 — 豆瓣/源/元数据状态 badge + 筛选器
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ModerationList } from '@/components/admin/moderation/ModerationList'

const getMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}))

vi.mock('@/components/admin/shared/modern-table/cells', () => ({
  TableImageCell: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

// ── 工厂 ──────────────────────────────────────────────────────────

function makeRow(overrides: Partial<{
  id: string; title: string; type: string; year: number | null
  doubanStatus: string; sourceCheckStatus: string; metaScore: number; activeSourceCount: number
}> = {}) {
  return {
    id: 'v1', shortId: 'abc', title: '测试视频', type: 'movie',
    coverUrl: null, year: 2024, siteKey: null, siteName: null,
    firstSourceUrl: null, createdAt: '2026-04-01T00:00:00Z',
    doubanStatus: 'matched', sourceCheckStatus: 'ok', metaScore: 80, activeSourceCount: 3,
    ...overrides,
  }
}

function makeApiResponse(rows = [makeRow()], total = 1) {
  return { data: rows, total }
}

// ── 测试 ──────────────────────────────────────────────────────────

describe('ModerationList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockResolvedValue(makeApiResponse())
  })

  it('渲染视频行与标题', async () => {
    render(<ModerationList selectedId={null} onSelect={vi.fn()} />)
    await screen.findByText('测试视频')
    expect(screen.getByTestId('moderation-list-item-v1')).toBeTruthy()
  })

  it('豆瓣 matched 状态显示 ✓匹配 badge', async () => {
    getMock.mockResolvedValue(makeApiResponse([makeRow({ doubanStatus: 'matched' })]))
    render(<ModerationList selectedId={null} onSelect={vi.fn()} />)
    await screen.findByText('测试视频')
    expect(screen.getByTestId('douban-badge').textContent).toBe('✓匹配')
  })

  it('豆瓣 candidate 状态显示 ?候选 badge', async () => {
    getMock.mockResolvedValue(makeApiResponse([makeRow({ doubanStatus: 'candidate' })]))
    render(<ModerationList selectedId={null} onSelect={vi.fn()} />)
    await screen.findByText('测试视频')
    expect(screen.getByTestId('douban-badge').textContent).toBe('?候选')
  })

  it('豆瓣 unmatched 状态显示 ✗未匹配 badge', async () => {
    getMock.mockResolvedValue(makeApiResponse([makeRow({ doubanStatus: 'unmatched' })]))
    render(<ModerationList selectedId={null} onSelect={vi.fn()} />)
    await screen.findByText('测试视频')
    expect(screen.getByTestId('douban-badge').textContent).toBe('✗未匹配')
  })

  it('源检验 ok 时显示检测通过数量', async () => {
    getMock.mockResolvedValue(makeApiResponse([makeRow({ sourceCheckStatus: 'ok', activeSourceCount: 5 })]))
    render(<ModerationList selectedId={null} onSelect={vi.fn()} />)
    await screen.findByText('测试视频')
    expect(screen.getByTestId('source-badge').textContent).toBe('●5检测通过')
  })

  it('源检验 all_dead 显示 ✕全部异常', async () => {
    getMock.mockResolvedValue(makeApiResponse([makeRow({ sourceCheckStatus: 'all_dead' })]))
    render(<ModerationList selectedId={null} onSelect={vi.fn()} />)
    await screen.findByText('测试视频')
    expect(screen.getByTestId('source-badge').textContent).toBe('✕全部异常')
  })

  it('meta_score 显示为百分比', async () => {
    getMock.mockResolvedValue(makeApiResponse([makeRow({ metaScore: 60 })]))
    render(<ModerationList selectedId={null} onSelect={vi.fn()} />)
    await screen.findByText('测试视频')
    expect(screen.getByTestId('meta-score-badge').textContent).toBe('元60%')
  })

  it('切换豆瓣状态筛选器时带 doubanStatus 参数请求', async () => {
    render(<ModerationList selectedId={null} onSelect={vi.fn()} />)
    await screen.findByText('测试视频')

    fireEvent.change(screen.getByTestId('moderation-list-douban-filter'), {
      target: { value: 'unmatched' },
    })

    await waitFor(() => {
      const url = getMock.mock.calls.at(-1)?.[0] as string
      expect(url).toContain('doubanStatus=unmatched')
    })
  })

  it('切换源检验筛选器时带 sourceCheckStatus 参数请求', async () => {
    render(<ModerationList selectedId={null} onSelect={vi.fn()} />)
    await screen.findByText('测试视频')

    fireEvent.change(screen.getByTestId('moderation-list-source-check-filter'), {
      target: { value: 'all_dead' },
    })

    await waitFor(() => {
      const url = getMock.mock.calls.at(-1)?.[0] as string
      expect(url).toContain('sourceCheckStatus=all_dead')
    })
  })

  it('重置筛选器后清除豆瓣和源检验参数', async () => {
    render(<ModerationList selectedId={null} onSelect={vi.fn()} />)
    await screen.findByText('测试视频')

    fireEvent.change(screen.getByTestId('moderation-list-douban-filter'), {
      target: { value: 'matched' },
    })
    await waitFor(() => {
      expect(getMock.mock.calls.at(-1)?.[0]).toContain('doubanStatus=matched')
    })

    fireEvent.click(screen.getByTestId('moderation-list-reset-filter'))
    await waitFor(() => {
      const url = getMock.mock.calls.at(-1)?.[0] as string
      expect(url).not.toContain('doubanStatus')
      expect(url).not.toContain('sourceCheckStatus')
    })
  })
})
