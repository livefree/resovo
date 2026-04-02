/**
 * SourceSubmissionTable.test.tsx — CHG-267
 * 验证：数据渲染 / 列显示切换 / 空状态 / AdminDropdown 行操作
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SubmissionTable } from '@/components/admin/sources/SubmissionTable'

const getMock = vi.fn()
const postMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}))

const MOCK_ROWS = [
  {
    id: 'sub1',
    video_id: 'v1',
    source_url: 'https://example.com/a',
    source_name: 'A',
    is_active: false,
    submitted_by_username: 'alice',
    created_at: '2026-03-20T00:00:00Z',
    video_title: 'Alpha',
  },
  {
    id: 'sub2',
    video_id: 'v2',
    source_url: 'https://example.com/b',
    source_name: 'B',
    is_active: false,
    submitted_by_username: null,
    created_at: '2026-03-21T00:00:00Z',
    video_title: 'Beta',
  },
]

describe('SourceSubmissionTable (CHG-267)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: MOCK_ROWS.length })
    postMock.mockResolvedValue({})
  })

  it('renders submission rows with video title', async () => {
    render(<SubmissionTable />)
    await screen.findByText('Alpha')
    expect(screen.getByText('Beta')).toBeTruthy()
  })

  it('shows anonymous for null submitted_by', async () => {
    render(<SubmissionTable />)
    await screen.findByText('Alpha')
    expect(screen.getByText('匿名')).toBeTruthy()
  })

  it('supports column visibility toggle', async () => {
    render(<SubmissionTable />)
    await screen.findByText('Alpha')

    // Open settings panel, toggle off submitted_by, verify header gone
    fireEvent.click(screen.getByTestId('source-submission-table-scroll-settings-btn'))
    fireEvent.click(screen.getByTestId('source-submission-table-scroll-settings-content-visible-submitted_by'))

    await waitFor(() => {
      // 仅在表格内查找，排除 settings 面板中仍显示的列标签
      const tableScroll = screen.getByTestId('source-submission-table-scroll')
      expect(within(tableScroll).queryByText('提交者')).toBeNull()
    })
  })

  it('shows empty state when no submissions', async () => {
    getMock.mockResolvedValue({ data: [], total: 0 })
    render(<SubmissionTable />)
    await screen.findByText('暂无用户纠错数据')
  })

  it('calls approve API on dropdown 采纳 click', async () => {
    render(<SubmissionTable />)
    await screen.findByText('Alpha')

    // Open dropdown for first row
    fireEvent.click(screen.getByTestId('source-submission-actions-sub1'))
    await waitFor(() => screen.getByText('采纳'))
    fireEvent.click(screen.getByText('采纳'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/submissions/sub1/approve')
    })
  })
})
