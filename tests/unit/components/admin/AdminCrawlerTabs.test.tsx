import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminCrawlerTabs } from '@/components/admin/AdminCrawlerTabs'

const mockReplace = vi.fn()

let mockPathname = '/zh/admin/crawler'
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}))

vi.mock('@/components/admin/AdminCrawlerPanel', () => ({
  AdminCrawlerPanel: ({ initialRunId }: { initialRunId?: string }) => (
    <div data-testid="mock-admin-crawler-panel">{initialRunId ?? ''}</div>
  ),
}))

vi.mock('@/components/admin/system/crawler-site/CrawlerSiteManager', () => ({
  CrawlerSiteManager: () => <div data-testid="mock-crawler-site-manager">sites</div>,
}))

describe('AdminCrawlerTabs', () => {
  beforeEach(() => {
    mockReplace.mockReset()
    mockPathname = '/zh/admin/crawler'
    mockSearchParams = new URLSearchParams()
  })

  it('读取 tab=tasks&runId 后默认进入任务记录并透传 initialRunId', () => {
    mockSearchParams = new URLSearchParams({
      tab: 'tasks',
      runId: '11111111-1111-4111-8111-111111111111',
    })

    render(<AdminCrawlerTabs />)

    expect(screen.queryByTestId('admin-crawler-tab-panel-tasks')).not.toBeNull()
    expect(screen.getByTestId('mock-admin-crawler-panel').textContent).toContain(
      '11111111-1111-4111-8111-111111111111',
    )
  })

  it('从控制台切到任务记录会写入 tab=tasks 查询参数', async () => {
    render(<AdminCrawlerTabs />)
    await userEvent.click(screen.getByTestId('admin-crawler-tab-tasks'))

    expect(mockReplace).toHaveBeenCalledWith('/zh/admin/crawler?tab=tasks')
  })

  it('切回控制台会清理 tab/runId 查询参数', async () => {
    mockSearchParams = new URLSearchParams({
      tab: 'tasks',
      runId: '11111111-1111-4111-8111-111111111111',
    })
    render(<AdminCrawlerTabs />)

    await userEvent.click(screen.getByTestId('admin-crawler-tab-sites'))

    expect(mockReplace).toHaveBeenCalledWith('/zh/admin/crawler')
  })
})
