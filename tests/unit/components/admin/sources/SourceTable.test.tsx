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

  it('loads all sources by default and renders rows via ModernDataTable', async () => {
    render(<SourceTable />)

    await screen.findByText('Alpha Video')
    expect(getMock).toHaveBeenCalledWith('/admin/sources?page=1&limit=20&status=all')

    // ModernDataTable rows use modern-table-row-{id} pattern
    const rows = Array.from(document.querySelectorAll('tr[data-testid^="modern-table-row-"]'))
    expect(rows.length).toBe(2)
    // Both videos appear
    expect(screen.getByText('Zeta Video')).toBeTruthy()
  })

  it('switches to inactive tab and requests status=inactive', async () => {
    render(<SourceTable />)
    await screen.findByText('Alpha Video')

    fireEvent.click(screen.getByTestId('source-tab-inactive'))

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/admin/sources?page=1&limit=20&status=inactive')
    })
  })

  it('renders column headers for inactive sources tab', async () => {
    render(<SourceTable />)
    await screen.findByText('Alpha Video')

    // ModernDataTable column headers are rendered via column.header strings
    expect(screen.getByText('视频标题')).toBeTruthy()
    expect(screen.getByText('源 URL')).toBeTruthy()
    expect(screen.getByText('状态')).toBeTruthy()
    expect(screen.getByText('最后验证')).toBeTruthy()
  })

  it('switches to submissions tab with independent request', async () => {
    render(<SourceTable />)

    fireEvent.click(screen.getByTestId('source-tab-submissions'))

    await screen.findByText('Fix Video')
    expect(getMock).toHaveBeenCalledWith('/admin/submissions?page=1&limit=20')
    expect(screen.getByText('alice')).toBeTruthy()
  })

  it('approves submission via dropdown and refreshes submissions tab', async () => {
    render(<SourceTable />)

    fireEvent.click(screen.getByTestId('source-tab-submissions'))
    await screen.findByText('Fix Video')

    // Open dropdown for the submission row
    fireEvent.click(screen.getByTestId('source-submission-actions-sub-1'))
    await waitFor(() => screen.getByText('采纳'))
    fireEvent.click(screen.getByText('采纳'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/submissions/sub-1/approve')
    })
  })

  it('renders source_url column and row data via ModernDataTable cells', async () => {
    render(<SourceTable />)
    await screen.findByText('Alpha Video')

    // Rows use modern-table-row-{id} pattern
    const rows = Array.from(document.querySelectorAll('tr[data-testid^="modern-table-row-"]'))
    expect(rows.length).toBe(2)

    // Source URL cells rendered by TableUrlCell
    const urlCells = Array.from(document.querySelectorAll('[data-testid="table-url-cell"]'))
    expect(urlCells.length).toBeGreaterThan(0)
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
