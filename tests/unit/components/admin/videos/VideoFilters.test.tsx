/**
 * tests/unit/components/admin/videos/VideoFilters.test.tsx
 * CHG-27: VideoFilters URL 参数同步
 * ADMIN-07: 来源站点筛选
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VideoFilters } from '@/components/admin/videos/VideoFilters'

const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/admin/videos',
  useSearchParams: () => mockSearchParams,
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}))

import { apiClient } from '@/lib/api-client'
const mockGet = apiClient.get as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue({ data: [] })
  mockSearchParams.delete('q')
  mockSearchParams.delete('type')
  mockSearchParams.delete('status')
  mockSearchParams.delete('site')
})

describe('VideoFilters', () => {
  it('渲染搜索框、类型选择、状态选择', () => {
    render(<VideoFilters />)
    expect(screen.getByTestId('video-filters-q')).toBeTruthy()
    expect(screen.getByTestId('video-filters-type')).toBeTruthy()
    expect(screen.getByTestId('video-filters-status')).toBeTruthy()
  })

  it('选择类型后 router.push 包含 type 参数', () => {
    render(<VideoFilters />)
    const select = screen.getByTestId('video-filters-type') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'movie' } })
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('type=movie'))
  })

  it('选择状态后 router.push 包含 status 参数', () => {
    render(<VideoFilters />)
    const select = screen.getByTestId('video-filters-status') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'published' } })
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('status=published'))
  })

  it('选择"全部类型"（空值）时删除 type 参数', () => {
    mockSearchParams.set('type', 'movie')
    render(<VideoFilters />)
    const select = screen.getByTestId('video-filters-type') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '' } })
    const calledWith = mockPush.mock.calls[0][0] as string
    expect(calledWith).not.toContain('type=')
  })

  it('切换筛选时 page 参数被重置', () => {
    mockSearchParams.set('page', '3')
    render(<VideoFilters />)
    const select = screen.getByTestId('video-filters-type') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'anime' } })
    const calledWith = mockPush.mock.calls[0][0] as string
    expect(calledWith).not.toContain('page=3')
  })

  it('站点列表为空时不渲染来源站点下拉', () => {
    mockGet.mockResolvedValue({ data: [] })
    render(<VideoFilters />)
    expect(screen.queryByTestId('video-filters-site')).toBeNull()
  })

  it('站点列表有数据时渲染来源站点下拉，选择后写入 site 参数', async () => {
    mockGet.mockResolvedValue({
      data: [
        { key: 'site-a', name: '站点A' },
        { key: 'site-b', name: '站点B' },
      ],
    })
    render(<VideoFilters />)

    const select = await waitFor(() => screen.getByTestId('video-filters-site'))
    expect(select).toBeTruthy()

    fireEvent.change(select, { target: { value: 'site-a' } })
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('site=site-a'))
  })
})
