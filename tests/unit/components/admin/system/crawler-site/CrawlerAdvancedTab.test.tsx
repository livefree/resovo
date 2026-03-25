import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CrawlerAdvancedTab } from '@/components/admin/system/crawler-site/components/CrawlerAdvancedTab'

const postMock = vi.fn()
const showToastMock = vi.fn()
const refreshMonitorMock = vi.fn()

const MOCK_SITES = [
  { key: 'iqiyizyapi.com', name: '爱奇艺', apiUrl: 'https://iqiyizyapi.com/api.php/provide/vod' },
  { key: '360zy.com', name: '360 资源', apiUrl: 'https://360zy.com/api.php/provide/vod' },
  { key: 'lovedan.net', name: '艾旦影视', apiUrl: 'https://lovedan.net/api.php/provide/vod' },
]

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
  },
}))

vi.mock('@/components/admin/shared/feedback/useAdminToast', () => ({
  useAdminToast: () => ({
    toast: null,
    showToast: showToastMock,
    clearToast: vi.fn(),
  }),
}))

vi.mock('@/components/admin/system/crawler-site/hooks/useCrawlerSites', () => ({
  useCrawlerSites: () => ({
    sites: MOCK_SITES,
    loading: false,
    fetchSites: vi.fn(),
  }),
}))

vi.mock('@/components/admin/system/crawler-site/hooks/useCrawlerMonitor', () => ({
  useCrawlerMonitor: () => ({
    systemStatus: { schedulerEnabled: true, freezeEnabled: false, orphanTaskCount: 0 },
    runningRuns: [],
    stopAllPending: false,
    freezeSwitchPending: false,
    stopAll: vi.fn(),
    setFreezeEnabled: vi.fn(),
    pauseRun: vi.fn(),
    resumeRun: vi.fn(),
    cancelRun: vi.fn(),
    refreshMonitor: refreshMonitorMock,
  }),
}))

vi.mock('@/components/admin/system/crawler-site/components/CrawlerSystemStatusStrip', () => ({
  CrawlerSystemStatusStrip: () => <div data-testid="mock-system-status-strip">system-strip</div>,
}))

vi.mock('@/components/admin/system/crawler-site/components/AutoCrawlSettingsPanel', () => ({
  AutoCrawlSettingsPanel: () => <div data-testid="mock-auto-settings">auto-settings</div>,
}))

vi.mock('@/components/admin/system/crawler-site/components/CrawlerRunPanel', () => ({
  CrawlerRunPanel: () => <div data-testid="mock-run-panel">run-panel</div>,
}))

describe('CrawlerAdvancedTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    postMock.mockResolvedValue({
      data: {
        runId: '11111111-1111-4111-8111-111111111111',
        taskIds: ['task-a'],
        enqueuedSiteKeys: ['iqiyizyapi.com'],
        skippedSiteKeys: [],
      },
    })
  })

  it('single 模式使用站点单选并提交 siteKeys', async () => {
    render(<CrawlerAdvancedTab />)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByTestId('crawler-custom-run-trigger-type'), 'single')
    await user.selectOptions(screen.getByTestId('crawler-custom-run-site-single'), '360zy.com')
    await user.click(screen.getByTestId('crawler-custom-run-submit'))

    expect(postMock).toHaveBeenCalledWith('/admin/crawler/runs', expect.objectContaining({
      triggerType: 'single',
      siteKeys: ['360zy.com'],
      mode: 'incremental',
    }))
    expect(refreshMonitorMock).toHaveBeenCalled()
  })

  it('batch 模式支持多选站点并提交 siteKeys[]', async () => {
    render(<CrawlerAdvancedTab />)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByTestId('crawler-custom-run-trigger-type'), 'batch')
    await user.click(screen.getByTestId('crawler-custom-run-site-item-iqiyizyapi.com'))
    await user.click(screen.getByTestId('crawler-custom-run-site-item-lovedan.net'))
    await user.click(screen.getByTestId('crawler-custom-run-submit'))

    expect(postMock).toHaveBeenCalledWith('/admin/crawler/runs', expect.objectContaining({
      triggerType: 'batch',
      siteKeys: ['iqiyizyapi.com', 'lovedan.net'],
    }))
  })

  it('batch 模式未选择站点时阻止提交', async () => {
    render(<CrawlerAdvancedTab />)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByTestId('crawler-custom-run-trigger-type'), 'batch')
    await user.click(screen.getByTestId('crawler-custom-run-submit'))

    expect(postMock).not.toHaveBeenCalled()
    expect(showToastMock).toHaveBeenCalledWith('请先选择至少一个站点', false)
  })
})

