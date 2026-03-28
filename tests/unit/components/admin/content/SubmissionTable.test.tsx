/**
 * SubmissionTable.test.tsx — CHG-259
 * 验证：数据渲染 / 服务端排序参数 / 列显示切换
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SubmissionTable } from '@/components/admin/content/SubmissionTable'

const getMock = vi.fn()
const postMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}))

vi.mock('@/components/admin/content/ReviewModal', () => ({
  ReviewModal: () => null,
}))

const MOCK_ROWS = [
  {
    id: 's1',
    video_id: 'v1',
    source_url: 'https://example.com/a',
    source_name: 'A',
    submitted_by: null,
    submitted_by_username: 'alpha',
    video_title: 'Alpha',
    created_at: '2026-03-20T00:00:00Z',
  },
  {
    id: 's2',
    video_id: 'v2',
    source_url: 'https://example.com/b',
    source_name: 'B',
    submitted_by: null,
    submitted_by_username: 'beta',
    video_title: 'Beta',
    created_at: '2026-03-21T00:00:00Z',
  },
]

describe('SubmissionTable (CHG-259)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: MOCK_ROWS.length })
    postMock.mockResolvedValue({})
  })

  it('renders submission rows with video title and source url', async () => {
    render(<SubmissionTable />)
    await screen.findByText('Alpha')
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(screen.getByText('https://example.com/a')).toBeTruthy()
  })

  it('calls API with default sortField=created_at&sortDir=desc on mount', async () => {
    render(<SubmissionTable />)
    await screen.findByText('Alpha')

    const firstCall = getMock.mock.calls[0][0] as string
    expect(firstCall).toContain('sortField=created_at')
    expect(firstCall).toContain('sortDir=desc')
  })

  it('refetches with new sortField/sortDir when sort header is clicked', async () => {
    render(<SubmissionTable />)
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByTestId('modern-table-sort-video'))

    await waitFor(() => {
      const calls = getMock.mock.calls.map((c) => c[0] as string)
      const sortedCall = calls.find((url) => url.includes('sortField=video'))
      expect(sortedCall).toBeTruthy()
      expect(sortedCall).toContain('sortDir=asc')
    })
  })

  it('supports column visibility toggle via TableSettingsTrigger', async () => {
    render(<SubmissionTable />)
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByTestId('submission-table-scroll-settings-btn'))
    fireEvent.click(screen.getByTestId('submission-table-scroll-settings-content-visible-source_url'))

    await waitFor(() => {
      expect(screen.queryByTestId('modern-table-sort-source_url')).toBeNull()
    })
  })

  it('shows empty state when no submissions', async () => {
    getMock.mockResolvedValue({ data: [], total: 0 })
    render(<SubmissionTable />)

    await screen.findByText('暂无待审投稿')
  })
})
