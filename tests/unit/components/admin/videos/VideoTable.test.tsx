import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { VideoTable } from '@/components/admin/videos/VideoTable'

const getMock = vi.fn()
const patchMock = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    post: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key),
  }),
}))

const MOCK_ROWS = [
  {
    id: 'v2',
    short_id: 'v2short',
    title: 'Zeta Movie',
    title_en: null,
    cover_url: null,
    type: 'movie',
    year: 2024,
    is_published: false,
    source_count: '3',
    active_source_count: '1',
    total_source_count: '3',
    visibility_status: 'internal',
    review_status: 'pending_review',
    created_at: '2026-03-20T00:00:00Z',
  },
  {
    id: 'v1',
    short_id: 'v1short',
    title: 'Alpha Movie',
    title_en: null,
    cover_url: null,
    type: 'series',
    year: 2025,
    is_published: true,
    source_count: '9',
    active_source_count: '8',
    total_source_count: '9',
    visibility_status: 'public',
    review_status: 'approved',
    created_at: '2026-03-20T00:00:00Z',
  },
]

describe('VideoTable (CHG-211/212)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockSearchParams.forEach((_value, key) => mockSearchParams.delete(key))
    getMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/videos?')) {
        const params = new URLSearchParams(url.split('?')[1] ?? '')
        const sortField = params.get('sortField')
        const sortDir = params.get('sortDir')
        // Server returns rows sorted per params (simulates server-side sort)
        if (sortField === 'title' && sortDir === 'desc') {
          // DESC: Zeta first (v2), Alpha second (v1)
          return { data: [...MOCK_ROWS], total: MOCK_ROWS.length }
        }
        // Default / title ASC: Alpha first (v1), Zeta second (v2)
        return { data: [...MOCK_ROWS].reverse(), total: MOCK_ROWS.length }
      }

      if (url === '/admin/videos/v1') {
        return {
          data: {
            id: 'v1',
            title: 'Alpha Movie',
            description: 'Old description',
            year: 2025,
            type: 'series',
            country: 'JP',
          },
        }
      }

      if (url === '/admin/sources?videoId=v1&page=1&limit=20') {
        return {
          data: [
            {
              id: 'src-1',
              source_url: 'https://cdn.example.com/v1.m3u8',
              source_name: 'main',
              is_active: true,
              episode_number: 1,
              season_number: 1,
            },
          ],
          total: 1,
        }
      }

      return { data: [], total: 0 }
    })
    patchMock.mockResolvedValue({
      data: {
        visibility_status: 'hidden',
        is_published: false,
      },
    })
  })

  it('applies default title sort and supports toggleSort', async () => {
    render(<VideoTable />)

    await screen.findByText('Alpha Movie')

    const rowsAsc = screen.getAllByTestId(/modern-table-row-/)
    expect(rowsAsc[0]?.getAttribute('data-testid')).toBe('modern-table-row-v1')

    fireEvent.click(screen.getByTestId('modern-table-sort-title'))

    await waitFor(() => {
      const rowsDesc = screen.getAllByTestId(/modern-table-row-/)
      expect(rowsDesc[0]?.getAttribute('data-testid')).toBe('modern-table-row-v2')
    })
  })

  it('supports column visibility toggle', async () => {
    render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    fireEvent.click(screen.getByTestId('video-columns-toggle'))
    fireEvent.click(screen.getByTestId('video-column-toggle-review_status'))

    await waitFor(() => {
      expect(screen.queryByTestId('modern-table-sort-review_status')).toBeNull()
    })
  })

  it('persists resized column width after remount', async () => {
    const { unmount } = render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    const titleHeader = screen.getByTestId('modern-table-sort-title').closest('th')
    expect(titleHeader?.getAttribute('style')).toContain('width: 320px')

    fireEvent.mouseDown(screen.getByTestId('modern-table-resize-title'), { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 180 })
    fireEvent.mouseUp(window)

    await waitFor(() => {
      expect(titleHeader?.getAttribute('style')).toContain('width: 400px')
    })

    unmount()

    render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    const remountTitleHeader = screen.getByTestId('modern-table-sort-title').closest('th')
    expect(remountTitleHeader?.getAttribute('style')).toContain('width: 400px')
  })

  it('requests visibilityStatus and reviewStatus filters from search params', async () => {
    mockSearchParams.set('visibilityStatus', 'internal')
    mockSearchParams.set('reviewStatus', 'approved')

    render(<VideoTable />)

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(expect.stringContaining('visibilityStatus=internal'))
      expect(getMock).toHaveBeenCalledWith(expect.stringContaining('reviewStatus=approved'))
    })
  })

  it('renders modern cells for source health, visibility and review status', async () => {
    render(<VideoTable />)

    const row = await screen.findByTestId('modern-table-row-v1')
    expect(within(row).getByText('Alpha Movie')).toBeTruthy()
    expect(within(row).getByText('v1short')).toBeTruthy()
    expect(within(row).getByText('🟡 8/9 活跃')).toBeTruthy()
    expect(within(row).getByText('公开')).toBeTruthy()
    expect(within(row).getByText('已通过')).toBeTruthy()
  })

  it('optimistically toggles visibility without refetching the table', async () => {
    render(<VideoTable />)

    const row = await screen.findByTestId('modern-table-row-v1')
    const switchButton = within(row).getByTestId('table-switch-toggle')
    expect(getMock).toHaveBeenCalledTimes(1)

    fireEvent.click(switchButton)

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/admin/videos/v1/visibility', { visibility: 'hidden' })
      expect(within(screen.getByTestId('modern-table-row-v1')).getByText('隐藏')).toBeTruthy()
    })

    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('rolls back visibility on toggle failure', async () => {
    patchMock.mockRejectedValueOnce(new Error('服务异常'))
    render(<VideoTable />)

    const row = await screen.findByTestId('modern-table-row-v1')
    fireEvent.click(within(row).getByTestId('table-switch-toggle'))

    await waitFor(() => {
      const currentRow = screen.getByTestId('modern-table-row-v1')
      expect(within(currentRow).getByText('公开')).toBeTruthy()
      expect(within(currentRow).getByText('服务异常')).toBeTruthy()
    })
  })

  it('opens detail drawer, loads video sources and saves metadata', async () => {
    render(<VideoTable />)

    await screen.findByText('Alpha Movie')
    // Open the actions dropdown for row v1, then click the edit item
    fireEvent.click(within(screen.getByTestId('video-actions-v1')).getByRole('button'))
    fireEvent.click(await screen.findByRole('menuitem', { name: '编辑' }))

    await screen.findByTestId('video-detail-drawer-title')
    expect(getMock).toHaveBeenCalledWith('/admin/videos/v1')
    expect(getMock).toHaveBeenCalledWith('/admin/sources?videoId=v1&page=1&limit=20')
    expect(screen.getByText('https://cdn.example.com/v1.m3u8')).toBeTruthy()

    fireEvent.change(screen.getByTestId('video-detail-title-input'), { target: { value: 'Alpha Movie Updated' } })
    fireEvent.change(screen.getByTestId('video-detail-country-input'), { target: { value: 'US' } })
    fireEvent.click(screen.getByTestId('video-detail-save'))

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/admin/videos/v1', {
        title: 'Alpha Movie Updated',
        description: 'Old description',
        year: 2025,
        type: 'series',
        country: 'US',
      })
    })
  })
})
