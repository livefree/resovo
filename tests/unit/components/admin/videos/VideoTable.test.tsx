import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VideoTable } from '@/components/admin/videos/VideoTable'

const getMock = vi.fn()
const patchMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
  },
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (_key: string) => null,
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
    created_at: '2026-03-20T00:00:00Z',
  },
]

describe('VideoTable (CHG-125)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: MOCK_ROWS.length })
    patchMock.mockResolvedValue({})
  })

  it('applies default title sort and supports toggleSort', async () => {
    render(<VideoTable />)

    await screen.findByText('Alpha Movie')

    const rowsAsc = Array.from(document.querySelectorAll('tr[data-testid^="video-row-"]'))
    expect(rowsAsc[0]?.getAttribute('data-testid')).toBe('video-row-v1')

    fireEvent.click(screen.getByTestId('video-sort-title'))

    await waitFor(() => {
      const rowsDesc = Array.from(document.querySelectorAll('tr[data-testid^="video-row-"]'))
      expect(rowsDesc[0]?.getAttribute('data-testid')).toBe('video-row-v2')
    })
  })

  it('supports column visibility toggle', async () => {
    render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    fireEvent.click(screen.getByTestId('video-columns-toggle'))
    fireEvent.click(screen.getByTestId('video-column-toggle-year'))

    await waitFor(() => {
      expect(screen.queryByTestId('video-sort-year')).toBeNull()
    })
  })

  it('persists resized column width after remount', async () => {
    const { unmount } = render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    const titleHeader = screen.getByTestId('video-sort-title').closest('th')
    expect(titleHeader?.getAttribute('style')).toContain('width: 320px')

    fireEvent.mouseDown(screen.getByTestId('video-resize-title'), { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 180 })
    fireEvent.mouseUp(window)

    await waitFor(() => {
      expect(titleHeader?.getAttribute('style')).toContain('width: 400px')
    })

    unmount()

    render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    const remountTitleHeader = screen.getByTestId('video-sort-title').closest('th')
    expect(remountTitleHeader?.getAttribute('style')).toContain('width: 400px')
  })
})
