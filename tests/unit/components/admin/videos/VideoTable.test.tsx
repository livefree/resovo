import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { VideoTable } from '@/components/admin/videos/VideoTable'

const getMock = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    patch: vi.fn(),
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

describe('VideoTable (CHG-211)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockSearchParams.forEach((_value, key) => mockSearchParams.delete(key))
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: MOCK_ROWS.length })
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
    expect(within(row).getByText('8/9 活跃')).toBeTruthy()
    expect(within(row).getByText('公开')).toBeTruthy()
    expect(within(row).getByText('已通过')).toBeTruthy()

    const switchButton = within(row).getByTestId('table-switch-toggle') as HTMLButtonElement
    expect(switchButton.disabled).toBe(true)
  })
})
