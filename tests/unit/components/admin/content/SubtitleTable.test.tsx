/**
 * SubtitleTable.test.tsx — CHG-260
 * 验证：数据渲染 / 服务端排序参数 / 列显示切换 / 空状态
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SubtitleTable } from '@/components/admin/content/SubtitleTable'

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
    id: 'st1',
    video_id: 'v1',
    language: 'zh',
    format: 'srt',
    label: '中文',
    file_url: 'https://example.com/a.srt',
    uploaded_by: null,
    created_at: '2026-03-20T00:00:00Z',
    video_title: 'Alpha',
    uploader_username: 'alpha',
  },
  {
    id: 'st2',
    video_id: 'v2',
    language: 'en',
    format: 'ass',
    label: 'English',
    file_url: 'https://example.com/b.ass',
    uploaded_by: null,
    created_at: '2026-03-21T00:00:00Z',
    video_title: 'Beta',
    uploader_username: 'beta',
  },
]

describe('SubtitleTable (CHG-260)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: MOCK_ROWS.length })
    postMock.mockResolvedValue({})
  })

  it('renders subtitle rows with video title and language', async () => {
    render(<SubtitleTable />)
    await screen.findByText('Alpha')
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(screen.getByText('zh')).toBeTruthy()
  })

  it('calls API with default sortField=created_at&sortDir=desc on mount', async () => {
    render(<SubtitleTable />)
    await screen.findByText('Alpha')

    const firstCall = getMock.mock.calls[0][0] as string
    expect(firstCall).toContain('sortField=created_at')
    expect(firstCall).toContain('sortDir=desc')
  })

  it('refetches with new sortField/sortDir when sort header is clicked', async () => {
    render(<SubtitleTable />)
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByTestId('modern-table-sort-video'))

    await waitFor(() => {
      const calls = getMock.mock.calls.map((c) => c[0] as string)
      const sortedCall = calls.find((url) => url.includes('sortField=video'))
      expect(sortedCall).toBeTruthy()
      expect(sortedCall).toContain('sortDir=asc')
    })
  })

  it('supports column visibility toggle via ColumnSettingsPanel', async () => {
    render(<SubtitleTable />)
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByTestId('subtitle-columns-toggle'))
    fireEvent.click(screen.getByTestId('subtitle-columns-panel-toggle-language'))

    await waitFor(() => {
      expect(screen.queryByTestId('modern-table-sort-language')).toBeNull()
    })
  })

  it('shows empty state when no subtitles', async () => {
    getMock.mockResolvedValue({ data: [], total: 0 })
    render(<SubtitleTable />)

    await screen.findByText('暂无待审字幕')
  })
})
