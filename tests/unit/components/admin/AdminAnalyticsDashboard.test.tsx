import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdminAnalyticsDashboard } from '@/components/admin/AdminAnalyticsDashboard'

const getMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}))

describe('AdminAnalyticsDashboard (CHG-130)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockImplementation((url: string) => {
      if (url === '/admin/analytics/content-quality') {
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({
        data: {
          videos: { total: 10, published: 8, pending: 2 },
          sources: { total: 30, active: 24, inactive: 6, failRate: 0.2 },
          users: { total: 50, todayNew: 3, banned: 1 },
          queues: { submissions: 2, subtitles: 1 },
          crawlerTasks: {
            recent: [
              {
                id: 't1',
                type: 'site-a',
                status: 'done',
                created_at: '2026-03-20T00:00:00Z',
                finished_at: '2026-03-20T00:10:00Z',
              },
              {
                id: 't2',
                type: 'site-b',
                status: 'running',
                created_at: '2026-03-21T00:00:00Z',
                finished_at: null,
              },
            ],
          },
        },
      })
    })
  })

  it('applies default created_at desc sort and supports column visibility toggle', async () => {
    render(<AdminAnalyticsDashboard />)
    await screen.findByTestId('analytics-crawler-tasks')

    // Default sort: created_at DESC → t2 (2026-03-21) before t1 (2026-03-20)
    const rows = Array.from(document.querySelectorAll('[data-testid^="modern-table-row-"]'))
    expect(rows[0]?.getAttribute('data-testid')).toBe('modern-table-row-t2')

    // Toggle off status column
    fireEvent.click(screen.getByTestId('analytics-crawler-table-scroll-settings-btn'))
    fireEvent.click(screen.getByTestId('analytics-crawler-table-scroll-settings-content-visible-status'))

    await waitFor(() => {
      // After toggling off status, its sort button should be gone
      expect(screen.queryByTestId('modern-table-sort-status')).toBeNull()
    })
  })
})
