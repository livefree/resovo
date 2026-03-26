import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SourceTable } from '@/components/admin/sources/SourceTable'

const getMock = vi.fn()
const deleteMock = vi.fn()
const patchMock = vi.fn()
const postMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}))

vi.mock('@/components/admin/sources/SourceVerifyButton', () => ({
  SourceVerifyButton: () => <button type="button">验证</button>,
}))

vi.mock('@/components/admin/sources/BatchDeleteBar', () => ({
  BatchDeleteBar: () => null,
}))

vi.mock('@/components/admin/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}))

const MOCK_ROWS = [
  {
    id: 's2',
    video_id: 'v2',
    source_url: 'https://zeta.example.com/play.m3u8',
    source_name: 'zeta',
    quality: null,
    type: 'm3u8',
    is_active: false,
    season_number: 1,
    episode_number: 2,
    last_checked: '2026-03-20T10:00:00Z',
    created_at: '2026-03-20T00:00:00Z',
    video_title: 'Zeta Video',
  },
  {
    id: 's1',
    video_id: 'v1',
    source_url: 'https://alpha.example.com/play.m3u8',
    source_name: 'alpha',
    quality: null,
    type: 'm3u8',
    is_active: true,
    season_number: 1,
    episode_number: 1,
    last_checked: '2026-03-21T10:00:00Z',
    created_at: '2026-03-20T00:00:00Z',
    video_title: 'Alpha Video',
  },
]

const MOCK_SUBMISSIONS = [
  {
    id: 'sub-1',
    video_id: 'v9',
    source_url: 'https://fix.example.com/play.m3u8',
    source_name: 'fix',
    is_active: false,
    submitted_by_username: 'alice',
    created_at: '2026-03-21T00:00:00Z',
    video_title: 'Fix Video',
  },
]

describe('SourceTable (CHG-216)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/sources?')) {
        return { data: MOCK_ROWS, total: MOCK_ROWS.length }
      }
      if (url.startsWith('/admin/submissions?')) {
        return { data: MOCK_SUBMISSIONS, total: MOCK_SUBMISSIONS.length }
      }
      return { data: [], total: 0 }
    })
    deleteMock.mockResolvedValue({})
    patchMock.mockResolvedValue({})
    postMock.mockResolvedValue({})
  })

  it('loads inactive sources by default and supports toggle sort', async () => {
    render(<SourceTable />)

    await screen.findByText('Alpha Video')
    expect(getMock).toHaveBeenCalledWith('/admin/sources?page=1&limit=20&status=inactive')

    const rowsDefault = Array.from(document.querySelectorAll('tr[data-testid^="source-row-"]'))
    expect(rowsDefault[0]?.getAttribute('data-testid')).toBe('source-row-s1')

    fireEvent.click(screen.getByTestId('source-sort-last_checked'))

    await waitFor(() => {
      const rowsToggled = Array.from(document.querySelectorAll('tr[data-testid^="source-row-"]'))
      expect(rowsToggled[0]?.getAttribute('data-testid')).toBe('source-row-s2')
    })
  })

  it('supports column visibility toggle', async () => {
    render(<SourceTable />)
    await screen.findByText('Alpha Video')

    fireEvent.click(screen.getByTestId('source-columns-toggle'))
    fireEvent.click(screen.getByTestId('source-column-toggle-status'))

    await waitFor(() => {
      expect(screen.queryByTestId('source-sort-status')).toBeNull()
    })
  })

  it('switches to submissions tab with independent request', async () => {
    render(<SourceTable />)

    fireEvent.click(screen.getByTestId('source-tab-submissions'))

    await screen.findByText('Fix Video')
    expect(getMock).toHaveBeenCalledWith('/admin/submissions?page=1&limit=20')
    expect(screen.getByText('alice')).toBeTruthy()
  })

  it('approves submission and refreshes submissions tab', async () => {
    render(<SourceTable />)

    fireEvent.click(screen.getByTestId('source-tab-submissions'))
    await screen.findByText('Fix Video')
    fireEvent.click(screen.getByTestId('submission-approve-btn-sub-1'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/submissions/sub-1/approve')
      expect(getMock).toHaveBeenCalledWith('/admin/submissions?page=1&limit=20')
    })
  })

  it('persists resized width after remount', async () => {
    const { unmount } = render(<SourceTable />)
    await screen.findByText('Alpha Video')

    const urlHeader = screen.getByTestId('source-sort-source_url').closest('th')
    expect(urlHeader?.getAttribute('style')).toContain('width: 340px')

    fireEvent.mouseDown(screen.getByTestId('source-resize-source_url'), { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 180 })
    fireEvent.mouseUp(window)

    await waitFor(() => {
      expect(urlHeader?.getAttribute('style')).toContain('width: 420px')
    })

    unmount()
    render(<SourceTable />)
    await screen.findByText('Alpha Video')

    const remountUrlHeader = screen.getByTestId('source-sort-source_url').closest('th')
    expect(remountUrlHeader?.getAttribute('style')).toContain('width: 420px')
  })

  it('opens replace modal and updates source url', async () => {
    render(<SourceTable />)

    await screen.findByText('Alpha Video')
    fireEvent.click(screen.getByTestId('source-replace-btn-s1'))
    fireEvent.change(screen.getByTestId('source-url-replace-input'), {
      target: { value: 'https://new.example.com/updated.m3u8' },
    })
    fireEvent.click(screen.getByTestId('source-url-replace-save'))

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/admin/sources/s1', {
        sourceUrl: 'https://new.example.com/updated.m3u8',
      })
    })
  })
})
