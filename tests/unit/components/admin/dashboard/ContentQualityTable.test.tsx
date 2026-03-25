/**
 * tests/unit/components/admin/dashboard/ContentQualityTable.test.tsx
 * ADMIN-06: ContentQualityTable 渲染与数据展示
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ContentQualityTable } from '@/components/admin/dashboard/ContentQualityTable'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

import { apiClient } from '@/lib/api-client'
const mockGet = apiClient.get as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ContentQualityTable', () => {
  it('数据加载中时显示加载提示', () => {
    mockGet.mockReturnValue(new Promise(() => {})) // never resolves
    render(<ContentQualityTable />)
    expect(screen.getByText('加载中…')).toBeTruthy()
  })

  it('无数据时显示引导文字', async () => {
    mockGet.mockResolvedValue({ data: [] })
    render(<ContentQualityTable />)
    await waitFor(() => expect(screen.getByText(/暂无数据/)).toBeTruthy())
  })

  it('有数据时渲染表格，显示站点名称和覆盖率', async () => {
    mockGet.mockResolvedValue({
      data: [
        {
          siteKey: 'site-a',
          total: 100,
          published: 80,
          hasCover: 90,
          hasDescription: 70,
          hasYear: 95,
          activeSources: 180,
          totalSources: 200,
        },
      ],
    })
    render(<ContentQualityTable />)

    const table = await waitFor(() => screen.getByTestId('content-quality-table'))
    expect(table).toBeTruthy()
    expect(screen.getByText('site-a')).toBeTruthy()
    expect(screen.getByText('100')).toBeTruthy()
    // 已发布 80/100 = 80%
    expect(screen.getAllByText('80%').length).toBeGreaterThanOrEqual(1)
    // 封面/源存活率含 90%
    expect(screen.getAllByText('90%').length).toBeGreaterThanOrEqual(1)
  })

  it('total 为 0 时百分比列显示 —', async () => {
    mockGet.mockResolvedValue({
      data: [
        {
          siteKey: 'empty-site',
          total: 0,
          published: 0,
          hasCover: 0,
          hasDescription: 0,
          hasYear: 0,
          activeSources: 0,
          totalSources: 0,
        },
      ],
    })
    render(<ContentQualityTable />)
    await waitFor(() => screen.getByTestId('content-quality-table'))
    const dashCells = screen.getAllByText('—')
    // 5 个百分比列（published/cover/desc/year/sources）都显示 —
    expect(dashCells.length).toBeGreaterThanOrEqual(5)
  })
})
