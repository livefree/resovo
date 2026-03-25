import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdminSubtitleList } from '@/components/admin/AdminSubtitleList'

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
    id: 'ast1',
    video_id: 'v1',
    video_title: 'Alpha',
    language: 'zh',
    label: '中文',
    format: 'srt',
    file_url: 'https://example.com/a.srt',
    is_verified: false,
    created_at: '2026-03-20T00:00:00Z',
  },
  {
    id: 'ast2',
    video_id: 'v2',
    video_title: 'Beta',
    language: 'en',
    label: 'English',
    format: 'ass',
    file_url: 'https://example.com/b.ass',
    is_verified: false,
    created_at: '2026-03-21T00:00:00Z',
  },
]

describe('AdminSubtitleList (CHG-129)', () => {
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
    render(<AdminSubtitleList />)
    await screen.findByText('Alpha')

    const rowsDesc = Array.from(document.querySelectorAll('tr[data-testid^="admin-subtitle-row-"]'))
    expect(rowsDesc[0]?.getAttribute('data-testid')).toBe('admin-subtitle-row-ast2')

    fireEvent.click(screen.getByTestId('admin-subtitle-sort-video'))

    await waitFor(() => {
      const rowsAsc = Array.from(document.querySelectorAll('tr[data-testid^="admin-subtitle-row-"]'))
      expect(rowsAsc[0]?.getAttribute('data-testid')).toBe('admin-subtitle-row-ast1')
    })
  })

  it('supports column visibility toggle', async () => {
    render(<AdminSubtitleList />)
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByTestId('admin-subtitle-columns-toggle'))
    fireEvent.click(screen.getByTestId('admin-subtitle-column-toggle-format'))

    await waitFor(() => {
      expect(screen.queryByTestId('admin-subtitle-sort-format')).toBeNull()
    })
  })

  it('persists resized column width after remount', async () => {
    const { unmount } = render(<AdminSubtitleList />)
    await screen.findByText('Alpha')

    const languageHeader = screen.getByTestId('admin-subtitle-sort-language').closest('th')
    expect(languageHeader?.getAttribute('style')).toContain('width: 150px')

    fireEvent.mouseDown(screen.getByTestId('admin-subtitle-resize-language'), { clientX: 120 })
    fireEvent.mouseMove(window, { clientX: 160 })
    fireEvent.mouseUp(window)

    await waitFor(() => {
      expect(languageHeader?.getAttribute('style')).toContain('width: 190px')
    })

    unmount()
    render(<AdminSubtitleList />)
    await screen.findByText('Alpha')

    const remountLanguageHeader = screen.getByTestId('admin-subtitle-sort-language').closest('th')
    expect(remountLanguageHeader?.getAttribute('style')).toContain('width: 190px')
  })
})
