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

describe('SubmissionTable (CHG-128)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: MOCK_ROWS.length })
    postMock.mockResolvedValue({})
  })

  it('applies default created_at sort and supports toggleSort', async () => {
    render(<SubmissionTable />)
    await screen.findByText('Alpha')

    const rowsDesc = Array.from(document.querySelectorAll('tr[data-testid^="submission-row-"]'))
    expect(rowsDesc[0]?.getAttribute('data-testid')).toBe('submission-row-s2')

    fireEvent.click(screen.getByTestId('submission-sort-video'))

    await waitFor(() => {
      const rowsAsc = Array.from(document.querySelectorAll('tr[data-testid^="submission-row-"]'))
      expect(rowsAsc[0]?.getAttribute('data-testid')).toBe('submission-row-s1')
    })
  })

  it('supports column visibility toggle', async () => {
    render(<SubmissionTable />)
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByTestId('submission-columns-toggle'))
    fireEvent.click(screen.getByTestId('submission-column-toggle-source_url'))

    await waitFor(() => {
      expect(screen.queryByTestId('submission-sort-source_url')).toBeNull()
    })
  })

  it('persists resized column width after remount', async () => {
    const { unmount } = render(<SubmissionTable />)
    await screen.findByText('Alpha')

    const sourceHeader = screen.getByTestId('submission-sort-source_url').closest('th')
    expect(sourceHeader?.getAttribute('style')).toContain('width: 320px')

    fireEvent.mouseDown(screen.getByTestId('submission-resize-source_url'), { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 160 })
    fireEvent.mouseUp(window)

    await waitFor(() => {
      expect(sourceHeader?.getAttribute('style')).toContain('width: 380px')
    })

    unmount()
    render(<SubmissionTable />)
    await screen.findByText('Alpha')

    const remountSourceHeader = screen.getByTestId('submission-sort-source_url').closest('th')
    expect(remountSourceHeader?.getAttribute('style')).toContain('width: 380px')
  })
})
