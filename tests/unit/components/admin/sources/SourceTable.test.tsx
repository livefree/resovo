import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SourceTable } from '@/components/admin/sources/SourceTable'

const getMock = vi.fn()
const deleteMock = vi.fn()
const patchMock = vi.fn()
const postMock = vi.fn()
const replaceMock = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (...args: unknown[]) => replaceMock(...args) }),
  usePathname: () => '/admin/sources',
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key),
    toString: () => mockSearchParams.toString(),
  }),
}))

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

describe('SourceTable (CHG-291)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockSearchParams.forEach((_value, key) => mockSearchParams.delete(key))

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

    const rows = Array.from(document.querySelectorAll('tr[data-testid^="modern-table-row-"]'))
    expect(rows.length).toBe(2)
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

  it('syncs tab change into URL params', async () => {
    render(<SourceTable />)
    await screen.findByText('Alpha Video')

    fireEvent.click(screen.getByTestId('source-tab-inactive'))
    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('sourceTab=inactive'))
  })

  it('renders column headers for inactive sources tab', async () => {
    render(<SourceTable />)
    await screen.findByText('Alpha Video')

    expect(screen.getAllByText('视频标题').length).toBeGreaterThan(0)
    expect(screen.getAllByText('源 URL').length).toBeGreaterThan(0)
    expect(screen.getAllByText('状态').length).toBeGreaterThan(0)
    expect(screen.getAllByText('最后验证').length).toBeGreaterThan(0)
  })

  it('reads keyword/title/videoId/siteKey/sort from URL and forwards to request', async () => {
    mockSearchParams.set('keyword', 'alpha')
    mockSearchParams.set('title', 'Alpha')
    mockSearchParams.set('videoId', '11111111-1111-4111-8111-111111111111')
    mockSearchParams.set('siteKey', 'site-a')
    mockSearchParams.set('sortField', 'video_title')
    mockSearchParams.set('sortDir', 'asc')

    render(<SourceTable />)
    await screen.findByText('Alpha Video')

    expect(getMock).toHaveBeenCalledWith(
      '/admin/sources?page=1&limit=20&status=all&keyword=alpha&title=Alpha&videoId=11111111-1111-4111-8111-111111111111&siteKey=site-a&sortField=video_title&sortDir=asc',
    )
  })

  it('updates URL when filter inputs change', async () => {
    render(<SourceTable />)
    await screen.findByText('Alpha Video')

    fireEvent.change(screen.getByTestId('source-filters-keyword'), {
      target: { value: 'new-keyword' },
    })
    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('keyword=new-keyword'))

    fireEvent.change(screen.getByTestId('source-filters-site-key'), {
      target: { value: 'site-b' },
    })
    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('siteKey=site-b'))

    fireEvent.change(screen.getByTestId('source-filters-video-id'), {
      target: { value: '11111111-1111-4111-8111-111111111111' },
    })
    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('videoId=11111111-1111-4111-8111-111111111111'))
  })

  it('updates URL when sort changes', async () => {
    render(<SourceTable />)
    await screen.findByText('Alpha Video')

    fireEvent.change(screen.getByTestId('source-filters-sort-field'), {
      target: { value: 'last_checked' },
    })
    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('sortField=last_checked'))

    fireEvent.change(screen.getByTestId('source-filters-sort-dir'), {
      target: { value: 'asc' },
    })
    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('sortDir=asc'))
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

    fireEvent.click(screen.getByTestId('source-submission-actions-sub-1'))
    await waitFor(() => screen.getByText('采纳'))
    fireEvent.click(screen.getByText('采纳'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/submissions/sub-1/approve')
    })
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
