import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdminSubmissionList } from '@/components/admin/AdminSubmissionList'

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
    id: 'as1',
    video_id: 'v1',
    video_title: 'Alpha',
    source_url: 'https://example.com/a',
    source_name: 'Source A',
    type: 'movie',
    submitted_by: null,
    submitted_by_username: 'user-a',
    created_at: '2026-03-20T00:00:00Z',
  },
  {
    id: 'as2',
    video_id: 'v2',
    video_title: 'Beta',
    source_url: 'https://example.com/b',
    source_name: 'Source B',
    type: 'series',
    submitted_by: null,
    submitted_by_username: 'user-b',
    created_at: '2026-03-21T00:00:00Z',
  },
]

describe('AdminSubmissionList (CHG-128)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.stubGlobal('alert', vi.fn())
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: MOCK_ROWS.length })
    postMock.mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('applies default created_at sort and supports toggleSort', async () => {
    render(<AdminSubmissionList />)
    await screen.findByText('Alpha')

    const rowsDesc = Array.from(document.querySelectorAll('tr[data-testid^="admin-submission-row-"]'))
    expect(rowsDesc[0]?.getAttribute('data-testid')).toBe('admin-submission-row-as2')

    fireEvent.click(screen.getByTestId('admin-submission-sort-video'))

    await waitFor(() => {
      const rowsAsc = Array.from(document.querySelectorAll('tr[data-testid^="admin-submission-row-"]'))
      expect(rowsAsc[0]?.getAttribute('data-testid')).toBe('admin-submission-row-as1')
    })
  })

  it('supports column visibility toggle', async () => {
    render(<AdminSubmissionList />)
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByTestId('admin-submission-columns-toggle'))
    fireEvent.click(screen.getByTestId('admin-submission-column-toggle-type'))

    await waitFor(() => {
      expect(screen.queryByTestId('admin-submission-sort-type')).toBeNull()
    })
  })

  it('persists resized column width after remount', async () => {
    const { unmount } = render(<AdminSubmissionList />)
    await screen.findByText('Alpha')

    const sourceNameHeader = screen.getByTestId('admin-submission-sort-source_name').closest('th')
    expect(sourceNameHeader?.getAttribute('style')).toContain('width: 160px')

    fireEvent.mouseDown(screen.getByTestId('admin-submission-resize-source_name'), { clientX: 120 })
    fireEvent.mouseMove(window, { clientX: 170 })
    fireEvent.mouseUp(window)

    await waitFor(() => {
      expect(sourceNameHeader?.getAttribute('style')).toContain('width: 210px')
    })

    unmount()
    render(<AdminSubmissionList />)
    await screen.findByText('Alpha')

    const remountSourceNameHeader = screen.getByTestId('admin-submission-sort-source_name').closest('th')
    expect(remountSourceNameHeader?.getAttribute('style')).toContain('width: 210px')
  })
})
