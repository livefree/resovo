/**
 * tests/unit/components/admin/crawler/CrawlerLaunchPanel.test.tsx
 * UX-08: 采集发起面板测试
 * 覆盖：模式切换渲染、批量/关键词/补源表单显示、站点加载状态
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CrawlerLaunchPanel } from '@/components/admin/system/crawler-site/components/CrawlerLaunchPanel'

// ── Mocks ──────────────────────────────────────────────────────────

const postMock = vi.fn()
const getMock = vi.fn()
const notifySuccessMock = vi.fn()
const notifyErrorMock = vi.fn()
const notifyWarnMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
    get: (...args: unknown[]) => getMock(...args),
  },
}))

vi.mock('@/components/admin/shared/toast/useAdminToast', () => ({
  notify: {
    success: (...args: unknown[]) => notifySuccessMock(...args),
    error: (...args: unknown[]) => notifyErrorMock(...args),
    warn: (...args: unknown[]) => notifyWarnMock(...args),
    info: vi.fn(),
  },
}))

const MOCK_SITES = [
  { key: 'site-a', name: '站点A', apiUrl: 'https://a.example.com', format: 'json' },
  { key: 'site-b', name: '站点B', apiUrl: 'https://b.example.com', format: 'json' },
]

vi.mock('@/components/admin/system/crawler-site/hooks/useCrawlerSites', () => ({
  useCrawlerSites: () => ({
    sites: MOCK_SITES,
    loading: false,
    fetchSites: vi.fn(),
  }),
}))

// ── Tests ──────────────────────────────────────────────────────────

describe('CrawlerLaunchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('默认显示批量采集表单', () => {
    render(<CrawlerLaunchPanel />)
    expect(screen.getByTestId('crawler-launch-panel')).toBeDefined()
    expect(screen.getByTestId('batch-crawl-form')).toBeDefined()
    expect(screen.getByTestId('launch-mode-batch')).toBeDefined()
  })

  it('切换到关键词搜索显示 KeywordCrawlForm', async () => {
    render(<CrawlerLaunchPanel />)
    await userEvent.click(screen.getByTestId('launch-mode-keyword'))
    expect(screen.getByTestId('keyword-crawl-form')).toBeDefined()
    expect(screen.queryByTestId('batch-crawl-form')).toBeNull()
  })

  it('切换到单视频补源显示 SourceRefetchForm', async () => {
    render(<CrawlerLaunchPanel />)
    await userEvent.click(screen.getByTestId('launch-mode-refetch'))
    expect(screen.getByTestId('source-refetch-form')).toBeDefined()
    expect(screen.queryByTestId('batch-crawl-form')).toBeNull()
  })

  it('站点列表渲染到各表单中', () => {
    render(<CrawlerLaunchPanel />)
    // 批量采集表单中的站点 checkbox
    expect(screen.getByTestId('site-checkbox-site-a')).toBeDefined()
    expect(screen.getByTestId('site-checkbox-site-b')).toBeDefined()
  })

  it('批量采集：点击发起采集按钮调用 POST /admin/crawler/runs', async () => {
    postMock.mockResolvedValue({
      data: { runId: 'run-1', taskIds: ['t-1', 't-2'], enqueuedSiteKeys: ['site-a', 'site-b'], skippedSiteKeys: [] },
    })

    render(<CrawlerLaunchPanel />)
    await userEvent.click(screen.getByTestId('batch-crawl-btn'))

    expect(postMock).toHaveBeenCalledWith(
      '/admin/crawler/runs',
      expect.objectContaining({ triggerType: 'batch', mode: 'incremental' })
    )
    expect(notifySuccessMock).toHaveBeenCalledWith(
      expect.stringContaining('采集任务已入队')
    )
  })

  it('关键词搜索：无关键词时 warn 提示', async () => {
    render(<CrawlerLaunchPanel />)
    await userEvent.click(screen.getByTestId('launch-mode-keyword'))
    await userEvent.click(screen.getByTestId('crawl-btn'))
    expect(notifyWarnMock).toHaveBeenCalledWith('请输入搜索关键词')
    expect(postMock).not.toHaveBeenCalled()
  })

  it('关键词搜索：输入关键词后发起采集', async () => {
    postMock.mockResolvedValue({
      data: { runId: 'run-2', taskIds: [], enqueuedSiteKeys: ['site-a'], skippedSiteKeys: [] },
    })

    render(<CrawlerLaunchPanel />)
    await userEvent.click(screen.getByTestId('launch-mode-keyword'))

    // 找到关键词输入框并输入
    const inputWrapper = screen.getByTestId('keyword-input')
    const input = inputWrapper.querySelector('input')!
    await userEvent.type(input, '星际穿越')

    await userEvent.click(screen.getByTestId('crawl-btn'))

    expect(postMock).toHaveBeenCalledWith(
      '/admin/crawler/runs',
      expect.objectContaining({ crawlMode: 'keyword', keyword: '星际穿越' })
    )
  })

  it('模式选择器显示三个模式按钮', () => {
    render(<CrawlerLaunchPanel />)
    expect(screen.getByTestId('launch-mode-batch')).toBeDefined()
    expect(screen.getByTestId('launch-mode-keyword')).toBeDefined()
    expect(screen.getByTestId('launch-mode-refetch')).toBeDefined()
  })
})
