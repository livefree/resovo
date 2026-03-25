import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SourceTable } from '@/components/admin/sources/SourceTable'

const getMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
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
    last_checked: '2026-03-21T10:00:00Z',
    created_at: '2026-03-20T00:00:00Z',
    video_title: 'Alpha Video',
  },
]

describe('SourceTable (CHG-126)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: MOCK_ROWS.length })
    deleteMock.mockResolvedValue({})
  })

  it('applies default sort and supports toggle sort', async () => {
    render(<SourceTable />)

    await screen.findByText('Alpha Video')

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
})
