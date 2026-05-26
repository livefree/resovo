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
  intervalMinutes: 60,
  dailyTime: '03:30',
  defaultMode: 'incremental' as const,
  onlyEnabledSites: false,
  conflictPolicy: 'skip_running' as const,
  perSiteOverrides: {},
}

// CHG-SN-9-CW1-CW2-HOTFIX-B Step 2：interval 模式配置
const CONFIG_INTERVAL = {
  ...BASE_CONFIG,
  scheduleType: 'interval' as const,
  intervalMinutes: 30,
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

  // CHG-SN-9-CW1-CW2-HOTFIX-B Step 2：scheduleType 切换显示（CW2-C-EP-A 后回归修复）
  it('7. countdown + interval 模式 → 渲染「每 N 分钟」而非「每日 HH:MM」', async () => {
    const future = new Date(Date.now() + 90 * 60_000).toISOString()
    mockGetAutoCrawlConfig.mockResolvedValueOnce(CONFIG_INTERVAL)
    mockGetCrawlerSystemStatus.mockResolvedValueOnce({ autoCrawlNext: future })
    render(<AutoCrawlScheduleCard />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-countdown')).not.toBeNull()
    })
    const summary = screen.getByTestId('auto-crawl-schedule-summary').textContent ?? ''
    expect(summary).toContain('每 30 分钟')
    expect(summary).not.toContain('每日')
    expect(summary).toContain('模式 增量')
  })

  it('8. countdown + daily 模式 → 渲染「每日 HH:MM」（防 Step 2 回归 daily 分支）', async () => {
    const future = new Date(Date.now() + 90 * 60_000).toISOString()
    mockGetAutoCrawlConfig.mockResolvedValueOnce(BASE_CONFIG) // scheduleType='daily'
    mockGetCrawlerSystemStatus.mockResolvedValueOnce({ autoCrawlNext: future })
    render(<AutoCrawlScheduleCard />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-countdown')).not.toBeNull()
    })
    const summary = screen.getByTestId('auto-crawl-schedule-summary').textContent ?? ''
    expect(summary).toContain('每日 03:30')
    expect(summary).not.toContain('每 ')   // 区分 interval "每 N 分钟"（有空格）
  })

  // ── CHG-SN-9-CW1-CW2-HOTFIX-C Step 1：scheduler 未启动可见性 ──────────
  it('9. schedulerEnabled=false → 显 scheduler-disabled 警告（遮蔽 countdown / config 完整）', async () => {
    const future = new Date(Date.now() + 90 * 60_000).toISOString()
    // 即使 config.globalEnabled=true + autoCrawlNext 有值，schedulerEnabled=false 必须优先遮蔽
    mockGetAutoCrawlConfig.mockResolvedValueOnce(BASE_CONFIG)
    mockGetCrawlerSystemStatus.mockResolvedValueOnce({ autoCrawlNext: future, schedulerEnabled: false })
    render(<AutoCrawlScheduleCard />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-scheduler-disabled')).not.toBeNull()
    })
    // 警告卡含 Pill "调度器进程未启动" + 环境变量提示
    expect(screen.getByText('调度器进程未启动')).not.toBeNull()
    expect(screen.getByText(/CRAWLER_SCHEDULER_ENABLED=true/)).not.toBeNull()
    // countdown / schedule-summary 必须不渲染（scheduler 未启动时 autoCrawlNext 是 stale 数据）
    expect(screen.queryByTestId('auto-crawl-countdown')).toBeNull()
    expect(screen.queryByTestId('auto-crawl-schedule-summary')).toBeNull()
    // card data-state 标 scheduler-disabled 便于断言
    const card = screen.getByTestId('auto-crawl-schedule-card')
    expect(card.getAttribute('data-card-state')).toBe('scheduler-disabled')
  })

  it('10. schedulerEnabled=true → 正常 countdown 不被遮蔽（防 #9 回归）', async () => {
    const future = new Date(Date.now() + 90 * 60_000).toISOString()
    mockGetAutoCrawlConfig.mockResolvedValueOnce(BASE_CONFIG)
    mockGetCrawlerSystemStatus.mockResolvedValueOnce({ autoCrawlNext: future, schedulerEnabled: true })
    render(<AutoCrawlScheduleCard />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-countdown')).not.toBeNull()
    })
    expect(screen.queryByTestId('auto-crawl-scheduler-disabled')).toBeNull()
  })

  it('11. schedulerEnabled=undefined（缺字段兼容）→ 不显警告（兜底，避免误报）', async () => {
    const future = new Date(Date.now() + 90 * 60_000).toISOString()
    mockGetAutoCrawlConfig.mockResolvedValueOnce(BASE_CONFIG)
    // 后端旧版未返回 schedulerEnabled 字段时不报警告（兼容性兜底）
    mockGetCrawlerSystemStatus.mockResolvedValueOnce({ autoCrawlNext: future })
    render(<AutoCrawlScheduleCard />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-countdown')).not.toBeNull()
    })
    expect(screen.queryByTestId('auto-crawl-scheduler-disabled')).toBeNull()
  })
})
