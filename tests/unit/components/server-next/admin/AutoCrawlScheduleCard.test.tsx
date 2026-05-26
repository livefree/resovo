/**
 * AutoCrawlScheduleCard.test.tsx — CW1-D Dashboard 自动采集卡 5 状态单测
 *
 * 覆盖：
 *   1. loading → 渲染 loading
 *   2. disabled（globalEnabled=false）→ 「未启用」Pill
 *   3. countdown（globalEnabled=true & autoCrawlNext 有值）→ 「下次自动」Pill ok + 倒计时文案
 *   4. failed（globalEnabled=true & autoCrawlNext=null）→ 「调度配置异常」Pill warn
 *   5. error（getAutoCrawlConfig 失败）→ 「加载失败」
 *   6. 编辑链接 href 始终是 /admin/crawler?openDrawer=scheduler
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const mockGetAutoCrawlConfig = vi.fn()
const mockGetCrawlerSystemStatus = vi.fn()

vi.mock('@/lib/crawler/api', () => ({
  getAutoCrawlConfig: (...args: unknown[]) => mockGetAutoCrawlConfig(...args),
  getCrawlerSystemStatus: (...args: unknown[]) => mockGetCrawlerSystemStatus(...args),
}))

vi.mock('@/lib/api-client', () => ({
  ApiClientError: class extends Error {},
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

import { AutoCrawlScheduleCard } from '@/app/admin/_client/AutoCrawlScheduleCard'

const BASE_CONFIG = {
  globalEnabled: true,
  scheduleType: 'daily' as const,
  dailyTime: '03:30',
  defaultMode: 'incremental' as const,
  onlyEnabledSites: false,
  conflictPolicy: 'skip_running' as const,
  perSiteOverrides: {},
}

afterEach(() => {
  cleanup()
  mockGetAutoCrawlConfig.mockReset()
  mockGetCrawlerSystemStatus.mockReset()
})

beforeEach(() => {
  mockGetCrawlerSystemStatus.mockResolvedValue({ autoCrawlNext: null })
})

describe('AutoCrawlScheduleCard', () => {
  it('1. loading 态 → 渲染 loading 占位', () => {
    mockGetAutoCrawlConfig.mockReturnValueOnce(new Promise(() => {})) // pending
    render(<AutoCrawlScheduleCard />)
    expect(screen.getByTestId('auto-crawl-loading')).not.toBeNull()
    const card = screen.getByTestId('auto-crawl-schedule-card')
    expect(card.getAttribute('data-card-state')).toBe('loading')
  })

  it('2. disabled 态（globalEnabled=false）→ 「未启用」', async () => {
    mockGetAutoCrawlConfig.mockResolvedValueOnce({ ...BASE_CONFIG, globalEnabled: false })
    render(<AutoCrawlScheduleCard />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-disabled')).not.toBeNull()
      expect(screen.getByText('未启用')).not.toBeNull()
    })
    const card = screen.getByTestId('auto-crawl-schedule-card')
    expect(card.getAttribute('data-card-state')).toBe('disabled')
    // 编辑链接 label 是「配置定时」
    expect(screen.getByTestId('auto-crawl-edit-link').textContent).toContain('配置定时')
  })

  it('3. countdown 态 → 渲染下次自动时间 + 倒计时 + 每日 + 模式', async () => {
    const future = new Date(Date.now() + 90 * 60_000).toISOString() // 90 分钟后
    mockGetAutoCrawlConfig.mockResolvedValueOnce(BASE_CONFIG)
    mockGetCrawlerSystemStatus.mockResolvedValueOnce({ autoCrawlNext: future })
    render(<AutoCrawlScheduleCard />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-countdown')).not.toBeNull()
    })
    const remaining = screen.getByTestId('auto-crawl-countdown-remaining').textContent ?? ''
    expect(remaining).toMatch(/剩余\s+1\s+小时\s+\d+\s+分钟/)
    expect(screen.getByText(/下次自动:\s+\d{2}-\d{2}\s+\d{2}:\d{2}/)).not.toBeNull()
    expect(screen.getByText(/每日 03:30/)).not.toBeNull()
    expect(screen.getByText(/模式 增量/)).not.toBeNull()
    const card = screen.getByTestId('auto-crawl-schedule-card')
    expect(card.getAttribute('data-card-state')).toBe('countdown')
  })

  it('4. failed 态（globalEnabled=true & nextAt=null）→ 「调度配置异常」', async () => {
    mockGetAutoCrawlConfig.mockResolvedValueOnce(BASE_CONFIG)
    mockGetCrawlerSystemStatus.mockResolvedValueOnce({ autoCrawlNext: null })
    render(<AutoCrawlScheduleCard />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-failed')).not.toBeNull()
      expect(screen.getByText('调度配置异常')).not.toBeNull()
    })
    const card = screen.getByTestId('auto-crawl-schedule-card')
    expect(card.getAttribute('data-card-state')).toBe('failed')
  })

  it('5. error 态（getAutoCrawlConfig 失败）→ 加载失败提示', async () => {
    mockGetAutoCrawlConfig.mockRejectedValueOnce(new Error('500'))
    render(<AutoCrawlScheduleCard />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-error')).not.toBeNull()
    })
    expect(screen.getByText(/加载失败/)).not.toBeNull()
    const card = screen.getByTestId('auto-crawl-schedule-card')
    expect(card.getAttribute('data-card-state')).toBe('error')
  })

  it('6. 编辑链接 href 始终是 /admin/crawler?openDrawer=scheduler', async () => {
    mockGetAutoCrawlConfig.mockResolvedValueOnce({ ...BASE_CONFIG, globalEnabled: false })
    render(<AutoCrawlScheduleCard />)
    await waitFor(() => {
      const link = screen.getByTestId('auto-crawl-edit-link') as HTMLAnchorElement
      expect(link.getAttribute('href')).toBe('/admin/crawler?openDrawer=scheduler')
    })
  })
})
