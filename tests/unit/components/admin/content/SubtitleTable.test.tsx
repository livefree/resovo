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

describe('SubtitleTable (CHG-129)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: MOCK_ROWS.length })
    postMock.mockResolvedValue({})
  })

  it('applies default created_at sort and supports toggleSort', async () => {
    render(<SubtitleTable />)
    await screen.findByText('Alpha')

    const rowsDesc = Array.from(document.querySelectorAll('tr[data-testid^="subtitle-row-"]'))
    expect(rowsDesc[0]?.getAttribute('data-testid')).toBe('subtitle-row-st2')

    fireEvent.click(screen.getByTestId('subtitle-sort-video'))

    await waitFor(() => {
      const rowsAsc = Array.from(document.querySelectorAll('tr[data-testid^="subtitle-row-"]'))
      expect(rowsAsc[0]?.getAttribute('data-testid')).toBe('subtitle-row-st1')
    })
  })

  it('supports column visibility toggle', async () => {
    render(<SubtitleTable />)
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByTestId('subtitle-columns-toggle'))
    fireEvent.click(screen.getByTestId('subtitle-columns-panel-toggle-language'))

    await waitFor(() => {
      expect(screen.queryByTestId('subtitle-sort-language')).toBeNull()
    })
  })

  it('persists resized column width after remount', async () => {
    const { unmount } = render(<SubtitleTable />)
    await screen.findByText('Alpha')

    const languageHeader = screen.getByTestId('subtitle-sort-language').closest('th')
    expect(languageHeader?.getAttribute('style')).toContain('width: 130px')

    fireEvent.mouseDown(screen.getByTestId('subtitle-resize-language'), { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 140 })
    fireEvent.mouseUp(window)

    await waitFor(() => {
      expect(languageHeader?.getAttribute('style')).toContain('width: 170px')
    })

    unmount()
    render(<SubtitleTable />)
    await screen.findByText('Alpha')

    const remountLanguageHeader = screen.getByTestId('subtitle-sort-language').closest('th')
    expect(remountLanguageHeader?.getAttribute('style')).toContain('width: 170px')
  })
})
