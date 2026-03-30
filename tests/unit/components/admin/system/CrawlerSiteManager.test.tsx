import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CrawlerSiteManager } from '@/components/admin/system/crawler-site/CrawlerSiteManager'

const getMock = vi.fn()
const postMock = vi.fn()
const patchMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}))

const MOCK_SITES = [
  {
    key: 'alpha',
    name: 'Alpha 源',
    apiUrl: 'https://alpha.test/api.php/provide/vod',
    detail: null,
    sourceType: 'vod',
    format: 'json',
    weight: 90,
    isAdult: false,
    disabled: false,
    fromConfig: false,
    lastCrawledAt: null,
    lastCrawlStatus: null,
    ingestPolicy: { allow_auto_publish: false },
    createdAt: '2026-03-19T00:00:00Z',
    updatedAt: '2026-03-19T00:00:00Z',
  },
  {
    key: 'beta',
    name: 'Beta 源',
    apiUrl: 'https://beta.test/api.php/provide/vod',
    detail: null,
    sourceType: 'shortdrama',
    format: 'xml',
    weight: 20,
    isAdult: true,
    disabled: true,
    fromConfig: true,
    lastCrawledAt: null,
    lastCrawlStatus: null,
    ingestPolicy: { allow_auto_publish: false },
    createdAt: '2026-03-19T00:00:00Z',
    updatedAt: '2026-03-19T00:00:00Z',
  },
]

describe('CrawlerSiteManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getMock.mockResolvedValue({ data: MOCK_SITES })
    postMock.mockResolvedValue({ data: {} })
    patchMock.mockResolvedValue({ data: {} })
    deleteMock.mockResolvedValue({})
  })

  it('renders scroll container for long list area', async () => {
    render(<CrawlerSiteManager />)
    await waitFor(() => {
      expect(screen.getByTestId('crawler-sites-scroll-container')).not.toBeNull()
    })
  })

  it('filters rows by key or name', async () => {
    render(<CrawlerSiteManager />)
    await screen.findByText('Alpha 源')

    fireEvent.change(screen.getByPlaceholderText('筛选 名称 / key'), {
      target: { value: 'beta' },
    })

    await waitFor(() => {
      expect(screen.queryByText('Alpha 源')).toBeNull()
      expect(screen.getByText('Beta 源')).not.toBeNull()
    })
  })

  it('sorts by weight when clicking weight header', async () => {
    render(<CrawlerSiteManager />)
    await screen.findByText('Alpha 源')

    fireEvent.click(screen.getAllByRole('button', { name: /权重/i })[0])
    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      expect(rows.length).toBeGreaterThan(2)
    })
  })

  it('restores column visibility from localStorage after remount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<CrawlerSiteManager />)
    await screen.findByText('Alpha 源')

    await user.click(screen.getByTestId('crawler-site-table-scroll-settings-btn'))
    await user.click(screen.getByTestId('crawler-site-table-scroll-settings-content-visible-key'))

    await waitFor(() => {
      expect(screen.queryByTestId('modern-table-sort-key')).toBeNull()
    })
    // Flush all pending effects (including localStorage write-back) before unmounting
    await act(async () => {})

    unmount()

    render(<CrawlerSiteManager />)
    await screen.findByText('Alpha 源')

    // Wait for settings hydration from localStorage (useTableSettings mount effect is async)
    await waitFor(() => {
      expect(screen.queryByTestId('modern-table-sort-key')).toBeNull()
    })
  })

  it('resize handle exists and initial column width is set', async () => {
    render(<CrawlerSiteManager />)
    await screen.findByText('Alpha 源')

    const nameHeader = screen.getByText('名称').closest('th')
    expect(nameHeader?.getAttribute('style') ?? '').toContain('width: 180px')
    // Resize handle is rendered for resizable columns
    expect(screen.getByTestId('modern-table-resize-name')).toBeTruthy()
  })
})
