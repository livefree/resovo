/**
 * InactiveSourceTable.test.tsx — CHG-262/282
 * 验证：数据渲染 / 列显示切换 / 空状态 / 失效源多选批量删除链路
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { InactiveSourceTable } from '@/components/admin/sources/InactiveSourceTable'

const getMock = vi.fn()
const postMock = vi.fn()
const deleteMock = vi.fn()
const patchMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
  },
}))

vi.mock('@/components/admin/sources/SourceVerifyButton', () => ({
  SourceVerifyButton: ({ sourceId }: { sourceId: string }) => (
    <button type="button" data-testid={`source-verify-btn-${sourceId}`}>验证</button>
  ),
}))

const MOCK_ROWS = [
  {
    id: 'src1',
    video_id: 'v1',
    source_url: 'https://example.com/a',
    source_name: 'A',
    quality: null,
    type: 'direct',
    is_active: false,
    season_number: 1,
    episode_number: 1,
    last_checked: '2026-03-20T00:00:00Z',
    created_at: '2026-03-01T00:00:00Z',
    video_title: 'Alpha',
  },
  {
    id: 'src2',
    video_id: 'v2',
    source_url: 'https://example.com/b',
    source_name: 'B',
    quality: null,
    type: 'direct',
    is_active: false,
    season_number: 1,
    episode_number: 2,
    last_checked: null,
    created_at: '2026-03-02T00:00:00Z',
    video_title: 'Beta',
  },
]

describe('InactiveSourceTable (CHG-262)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: MOCK_ROWS.length })
    postMock.mockImplementation(async (url: string) => {
      if (url === '/admin/sources/batch-verify') {
        return {
          data: {
            scope: 'site',
            totalMatched: 2,
            processed: 2,
            activated: 1,
            inactivated: 1,
            timeout: 1,
            failed: 0,
          },
        }
      }
      return {}
    })
    deleteMock.mockResolvedValue({})
    patchMock.mockResolvedValue({})
  })

  it('renders source rows with video title and url', async () => {
    render(<InactiveSourceTable />)
    await screen.findByText('Alpha')
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(getMock).toHaveBeenCalledWith('/admin/sources?page=1&limit=20&status=inactive&sortField=last_checked&sortDir=desc')
  })

  it('supports status=all mode', async () => {
    render(<InactiveSourceTable status="all" />)
    await screen.findByText('Alpha')
    expect(getMock).toHaveBeenCalledWith('/admin/sources?page=1&limit=20&status=all&sortField=last_checked&sortDir=desc')
    // 复选框始终可见（CHG-330：selection.enabled = true）
    expect(screen.queryByLabelText('全选当前页失效源')).toBeTruthy()
    // 批量删除 bar 仍在 !isAllStatus 条件下隐藏（危险操作保持限制）
    expect(screen.queryByTestId('batch-delete-bar')).toBeNull()
  })

  it('supports column visibility toggle', async () => {
    render(<InactiveSourceTable />)
    await screen.findByText('Alpha')

    // Open settings panel, toggle off coordinate, verify header is gone
    fireEvent.click(screen.getByTestId('inactive-source-table-scroll-settings-btn'))
    fireEvent.click(screen.getByTestId('inactive-source-table-scroll-settings-content-visible-coordinate'))

    await waitFor(() => {
      // 仅在表格内查找，排除 settings 面板中仍显示的列标签
      const tableScroll = screen.getByTestId('inactive-source-table-scroll')
      expect(within(tableScroll).queryByText('S/E')).toBeNull()
    })
  })

  it('shows empty state when no sources', async () => {
    getMock.mockResolvedValue({ data: [], total: 0 })
    render(<InactiveSourceTable />)
    await screen.findByText('暂无失效源')
  })

  it('supports row selection and batch delete flow for inactive view', async () => {
    render(<InactiveSourceTable />)
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByLabelText('选择 Alpha'))
    expect(screen.getByTestId('batch-delete-bar')).toBeTruthy()
    expect(screen.getByTestId('batch-delete-count').textContent).toContain('1')

    fireEvent.click(screen.getByTestId('batch-delete-confirm-btn'))
    await screen.findByText('确认批量删除')
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/sources/batch-delete', { ids: ['src1'] })
      expect(getMock).toHaveBeenCalledTimes(2)
    })
  })

  it('runs batch verify by site and shows summary', async () => {
    render(
      <InactiveSourceTable
        status="all"
        siteKey="site-a"
      />,
    )
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByTestId('source-batch-verify-site'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/sources/batch-verify', {
        scope: 'site',
        siteKey: 'site-a',
        activeOnly: false,
        limit: 500,
      })
    })

    expect(await screen.findByTestId('source-batch-verify-summary')).toBeTruthy()
    expect(screen.getByTestId('source-batch-verify-summary').textContent).toContain('命中 2')
    expect(getMock).toHaveBeenCalledTimes(2)
  })

  it('enables batch verify button when siteKey is provided', async () => {
    render(<InactiveSourceTable status="all" siteKey="site-a" />)
    await screen.findByText('Alpha')

    const bySite = screen.getByTestId('source-batch-verify-site') as HTMLButtonElement

    expect(bySite.disabled).toBe(false)
  })

  it('disables batch verify button when siteKey is missing', async () => {
    render(<InactiveSourceTable status="all" />)
    await screen.findByText('Alpha')
    expect((screen.getByTestId('source-batch-verify-site') as HTMLButtonElement).disabled).toBe(true)
  })

  it('supports row-level status toggle (optimistic, no refetch)', async () => {
    render(<InactiveSourceTable status="all" />)
    await screen.findByText('Alpha')
    expect(getMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('source-status-toggle-src1'))

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/admin/sources/src1/status', { isActive: true })
      // Optimistic: badge updates immediately without refetch
      expect(screen.getAllByText('活跃').length).toBeGreaterThan(0)
    })
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('supports batch status toggle for selected rows (optimistic, no refetch)', async () => {
    render(<InactiveSourceTable />)
    await screen.findByText('Alpha')
    expect(getMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('选择 Alpha'))
    fireEvent.click(screen.getByTestId('source-batch-status-active'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/sources/batch-status', {
        ids: ['src1'],
        isActive: true,
      })
      // Optimistic: badge updates immediately without refetch
      expect(screen.getAllByText('活跃').length).toBeGreaterThan(0)
    })
    expect(getMock).toHaveBeenCalledTimes(1)
  })
})
