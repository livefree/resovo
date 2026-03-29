import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PerformanceMonitor } from '@/components/admin/system/monitoring/PerformanceMonitor'

const getMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}))

describe('PerformanceMonitor (CHG-311)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockResolvedValue({
      data: {
        requests: { perMinute: 8, total24h: 1200 },
        latency: { avgMs: 80, p95Ms: 230 },
        memory: { heapUsedMb: 120, heapTotalMb: 256, rssMb: 380 },
        uptime: 1200,
        slowRequests: [
          { timestamp: 1000, durationMs: 600, method: 'GET', url: '/v1/a', statusCode: 200 },
          { timestamp: 2000, durationMs: 900, method: 'POST', url: '/v1/b', statusCode: 500 },
        ],
      },
    })
  })

  it('applies default duration desc sort and supports column visibility toggle', async () => {
    render(<PerformanceMonitor />)
    await screen.findByTestId('modern-table-row-0')

    const rows = Array.from(document.querySelectorAll('[data-testid^="modern-table-row-"]'))
    expect(rows[0]?.getAttribute('data-testid')).toBe('modern-table-row-0')
    expect(rows[0]?.textContent).toContain('/v1/b')

    // Open settings panel via ⋮ trigger button
    fireEvent.click(screen.getByTestId('perf-slow-request-table-scroll-settings-btn'))
    // Toggle statusCode visibility off
    fireEvent.click(screen.getByTestId('perf-slow-request-table-scroll-settings-content-visible-statusCode'))

    await waitFor(() => {
      expect(screen.queryByTestId('modern-table-sort-statusCode')).toBeNull()
    })
  })
})
