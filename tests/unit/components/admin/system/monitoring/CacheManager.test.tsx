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

describe('CacheManager (CHG-130)', () => {
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
    await screen.findByTestId('cache-row-video')

    const rows = Array.from(document.querySelectorAll('[data-testid^="cache-row-"]'))
    expect(rows[0]?.getAttribute('data-testid')).toBe('cache-row-video')

    fireEvent.click(screen.getByTestId('cache-columns-toggle'))
    fireEvent.click(screen.getByTestId('cache-column-toggle-sizeKb'))

    await waitFor(() => {
      expect(screen.queryByTestId('cache-sort-sizeKb')).toBeNull()
    })
  })
})
