/**
 * AdminCrawlerPanel.test.tsx — CHG-318
 * 验证：ModernDataTable 渲染、PaginationV2 显示、服务端排序参数传递
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { AdminCrawlerPanel } from '@/components/admin/AdminCrawlerPanel'

const getMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}))

const MOCK_TASKS = [
  {
    id: 'task-1',
    type: 'full-crawl',
    status: 'done' as const,
    triggerType: 'single' as const,
    runId: 'aaaa-bbbb-cccc-dddd-eeee',
    run_id: 'aaaa-bbbb-cccc-dddd-eeee',
    sourceSite: 'alpha',
    source_url: null,
    result: null,
    scheduledAt: '2026-03-29T10:00:00Z',
    startedAt: '2026-03-29T10:01:00Z',
    finishedAt: '2026-03-29T10:05:00Z',
    error: null,
    started_at: '2026-03-29T10:01:00Z',
    finished_at: '2026-03-29T10:05:00Z',
    created_at: '2026-03-29T10:00:00Z',
  },
  {
    id: 'task-2',
    type: 'incremental-crawl',
    status: 'failed' as const,
    triggerType: null,
    runId: null,
    run_id: null,
    sourceSite: null,
    source_url: 'https://beta.test/api.php',
    result: { error: 'network timeout' },
    scheduledAt: null,
    startedAt: null,
    finishedAt: null,
    error: 'network timeout',
    started_at: null,
    finished_at: null,
    created_at: '2026-03-29T11:00:00Z',
  },
]

function mockResponse(tasks = MOCK_TASKS, total = tasks.length) {
  getMock.mockResolvedValue({
    data: tasks,
    pagination: { total, page: 1, limit: 20, hasNext: false },
  })
}

describe('AdminCrawlerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResponse()
  })

  it('renders ModernDataTable scroll container', async () => {
    render(<AdminCrawlerPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('crawler-tasks-table-scroll')).toBeTruthy()
    })
  })

  it('renders task rows from API response', async () => {
    render(<AdminCrawlerPanel />)
    await screen.findByText('full-crawl')
    expect(screen.getByText('incremental-crawl')).toBeTruthy()
  })

  it('shows PaginationV2 when total > pageSize', async () => {
    getMock.mockResolvedValue({
      data: MOCK_TASKS,
      pagination: { total: 100, page: 1, limit: 20, hasNext: true },
    })
    render(<AdminCrawlerPanel />)
    await screen.findByText('full-crawl')
    // PaginationV2 renders page info
    await waitFor(() => {
      expect(screen.getByTestId('pagination-v2')).toBeTruthy()
    })
  })

  it('does not show PaginationV2 when total is 0', async () => {
    getMock.mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 20, hasNext: false },
    })
    render(<AdminCrawlerPanel />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    expect(screen.queryByTestId('pagination-v2')).toBeNull()
  })

  it('passes sortField and sortDir to API when sort changes', async () => {
    render(<AdminCrawlerPanel />)
    await screen.findByText('full-crawl')

    // Click sort on the 'type' column
    fireEvent.click(screen.getByTestId('modern-table-sort-type'))

    await waitFor(() => {
      const lastCall = getMock.mock.calls[getMock.mock.calls.length - 1][0] as string
      expect(lastCall).toContain('sortField=type')
      expect(lastCall).toContain('sortDir=asc')
    })
  })

  it('filters by status when filter button is clicked', async () => {
    render(<AdminCrawlerPanel />)
    await screen.findByText('full-crawl')

    getMock.mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 20, hasNext: false },
    })
    fireEvent.click(screen.getByTestId('admin-crawler-filter-failed'))

    await waitFor(() => {
      const lastCall = getMock.mock.calls[getMock.mock.calls.length - 1][0] as string
      expect(lastCall).toContain('status=failed')
    })
  })

  it('clicking runId pill filters by that runId', async () => {
    render(<AdminCrawlerPanel />)
    await screen.findByText('full-crawl')

    getMock.mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 20, hasNext: false },
    })
    fireEvent.click(screen.getByTestId('admin-crawler-runid-pill-task-1'))

    await waitFor(() => {
      const lastCall = getMock.mock.calls[getMock.mock.calls.length - 1][0] as string
      expect(lastCall).toContain('runId=aaaa-bbbb-cccc-dddd-eeee')
    })
  })

  it('shows log panel when view-logs button is clicked', async () => {
    getMock
      .mockResolvedValueOnce({
        data: MOCK_TASKS,
        pagination: { total: 2, page: 1, limit: 20, hasNext: false },
      })
      .mockResolvedValueOnce({
        data: { logs: [{ id: 'log-1', level: 'info', stage: 'fetch', message: '抓取完成', createdAt: '2026-03-29T10:05:00Z' }] },
      })

    render(<AdminCrawlerPanel />)
    await screen.findByText('full-crawl')

    fireEvent.click(screen.getByTestId('admin-crawler-task-logs-task-1'))

    await screen.findByTestId('admin-crawler-task-logs-panel')
    expect(screen.getByText('抓取完成')).toBeTruthy()
  })
})
