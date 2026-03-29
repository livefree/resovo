import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CacheManager } from '@/components/admin/system/monitoring/CacheManager'

const getCacheStatsMock = vi.fn()
const clearCacheMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getCacheStats: (...args: unknown[]) => getCacheStatsMock(...args),
    clearCache: (...args: unknown[]) => clearCacheMock(...args),
  },
}))

describe('CacheManager (CHG-310)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getCacheStatsMock.mockResolvedValue({
      data: [
        { type: 'search', count: 10, sizeKb: 32 },
        { type: 'video', count: 100, sizeKb: 240 },
      ],
    })
    clearCacheMock.mockResolvedValue({ data: { deleted: 0 } })
  })

  it('applies default count desc sort and supports column visibility toggle', async () => {
    render(<CacheManager />)
    await screen.findByTestId('modern-table-row-video')

    const rows = Array.from(document.querySelectorAll('[data-testid^="modern-table-row-"]'))
    expect(rows[0]?.getAttribute('data-testid')).toBe('modern-table-row-video')

    // Open settings panel via ⋮ trigger button
    fireEvent.click(screen.getByTestId('cache-manager-table-scroll-settings-btn'))
    // Toggle sizeKb visibility off
    fireEvent.click(screen.getByTestId('cache-manager-table-scroll-settings-content-visible-sizeKb'))

    await waitFor(() => {
      expect(screen.queryByTestId('modern-table-sort-sizeKb')).toBeNull()
    })
  })
})
