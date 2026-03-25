/**
 * tests/unit/components/browse/BrowseGrid.test.tsx
 * VIDEO-08: BrowseGrid 分页控件渲染与 URL 更新
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowseGrid } from '@/components/browse/BrowseGrid'
import type { VideoCard as VideoCardType, ApiListResponse } from '@/types'

// ── Mocks ──────────────────────────────────────────────────────────

const mockPush = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/browse',
  useSearchParams: () => mockSearchParams,
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      noResults: '暂无结果',
    }
    return map[key] ?? key
  },
}))

const getMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}))

// ── Helpers ────────────────────────────────────────────────────────

function makeVideoCard(n: number): VideoCardType {
  return {
    id: `vid-${n}`,
    shortId: `sh${n}`.padEnd(8, '0').slice(0, 8),
    slug: `video-${n}`,
    title: `视频 ${n}`,
    titleEn: null,
    coverUrl: null,
    type: 'movie',
    rating: null,
    year: 2024,
    status: 'completed',
    episodeCount: 1,
    sourceCount: 1,
  }
}

function makeResponse(total: number, count = 24): ApiListResponse<VideoCardType> {
  return {
    data: Array.from({ length: count }, (_, i) => makeVideoCard(i)),
    pagination: { page: 1, limit: 24, total },
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('BrowseGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  it('单页时不渲染分页控件', async () => {
    getMock.mockResolvedValue(makeResponse(10, 10))
    render(<BrowseGrid />)
    await screen.findByTestId('browse-grid')
    expect(screen.queryByTestId('browse-pagination')).toBeNull()
  })

  it('多页时渲染分页控件', async () => {
    getMock.mockResolvedValue(makeResponse(50))
    render(<BrowseGrid />)
    await screen.findByTestId('browse-pagination')
    expect(screen.getByTestId('pagination-prev')).toBeTruthy()
    expect(screen.getByTestId('pagination-next')).toBeTruthy()
    expect(screen.getByText('1 / 3')).toBeTruthy()
  })

  it('首页时「上一页」按钮 disabled', async () => {
    getMock.mockResolvedValue(makeResponse(50))
    render(<BrowseGrid />)
    await screen.findByTestId('browse-pagination')
    const prevBtn = screen.getByTestId('pagination-prev') as HTMLButtonElement
    expect(prevBtn.disabled).toBe(true)
  })

  it('末页时「下一页」按钮 disabled', async () => {
    mockSearchParams = new URLSearchParams('page=3')
    getMock.mockResolvedValue(makeResponse(50))
    render(<BrowseGrid />)
    await screen.findByTestId('browse-pagination')
    const nextBtn = screen.getByTestId('pagination-next') as HTMLButtonElement
    expect(nextBtn.disabled).toBe(true)
  })

  it('点击下一页调用 router.push 并携带 page 参数', async () => {
    getMock.mockResolvedValue(makeResponse(50))
    render(<BrowseGrid />)
    await screen.findByTestId('browse-pagination')
    fireEvent.click(screen.getByTestId('pagination-next'))
    expect(mockPush).toHaveBeenCalledWith('/browse?page=2')
  })

  it('从第2页点击上一页时删除 page 参数', async () => {
    mockSearchParams = new URLSearchParams('page=2')
    getMock.mockResolvedValue(makeResponse(50))
    render(<BrowseGrid />)
    await screen.findByTestId('browse-pagination')
    fireEvent.click(screen.getByTestId('pagination-prev'))
    expect(mockPush).toHaveBeenCalledWith('/browse?')
  })

  it('总数为0时不渲染分页控件', async () => {
    getMock.mockResolvedValue(makeResponse(0, 0))
    render(<BrowseGrid />)
    await screen.findByTestId('browse-empty')
    expect(screen.queryByTestId('browse-pagination')).toBeNull()
  })
})
