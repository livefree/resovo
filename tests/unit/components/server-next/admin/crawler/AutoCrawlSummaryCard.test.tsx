/**
 * AutoCrawlSummaryCard.test.tsx — ADR-155 D-155-5 / EP-1B2
 *
 * 覆盖（5 case）：
 *   1. disabled（globalEnabled=false）→ 「未启用」Pill + [编辑] 按钮
 *   2. countdown（globalEnabled=true + autoCrawlNext + daily）→ 「下次: ...」Pill + scheduleSummary + [立即关闭] + [编辑]
 *   3. scheduler-disabled（schedulerEnabled=false）→ 红色警告卡（HOTFIX-C 范式）
 *   4. [立即关闭] confirm 通过 → setAutoCrawlConfig({globalEnabled: false}) + success toast
 *   5. [编辑] 按钮调 onEditClick props（父层打开 SchedulerConfigDrawer）
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockGetAutoCrawlConfig = vi.fn()
const mockSetAutoCrawlConfig = vi.fn()
const mockGetCrawlerSystemStatus = vi.fn()
const toastPushMock = vi.fn()

vi.mock('@/lib/crawler/api', () => ({
  getAutoCrawlConfig: (...args: unknown[]) => mockGetAutoCrawlConfig(...args),
  setAutoCrawlConfig: (...args: unknown[]) => mockSetAutoCrawlConfig(...args),
  getCrawlerSystemStatus: (...args: unknown[]) => mockGetCrawlerSystemStatus(...args),
}))

vi.mock('@/lib/api-client', () => ({
  ApiClientError: class extends Error {},
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({
      push: (input: unknown) => { toastPushMock(input); return 'tid' },
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    }),
  }
})

import { AutoCrawlSummaryCard } from '@/app/admin/crawler/_client/AutoCrawlSummaryCard'

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

afterEach(() => {
  cleanup()
  mockGetAutoCrawlConfig.mockReset()
  mockSetAutoCrawlConfig.mockReset()
  mockGetCrawlerSystemStatus.mockReset()
  toastPushMock.mockReset()
})

beforeEach(() => {
  mockGetCrawlerSystemStatus.mockResolvedValue({ autoCrawlNext: null, schedulerEnabled: true })
})

describe('AutoCrawlSummaryCard (ADR-155 D-155-5 / EP-1B2)', () => {
  it('1. disabled（globalEnabled=false）→ 「未启用」Pill + [配置定时] 按钮', async () => {
    mockGetAutoCrawlConfig.mockResolvedValueOnce({ ...BASE_CONFIG, globalEnabled: false })
    render(<AutoCrawlSummaryCard onEditClick={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-summary-disabled')).not.toBeNull()
    })
    expect(screen.getByText('未启用')).not.toBeNull()
    expect(screen.getByTestId('auto-crawl-summary-edit')).not.toBeNull()
    // disabled 态无 [立即关闭] 按钮
    expect(screen.queryByTestId('auto-crawl-summary-close')).toBeNull()
  })

  it('2. countdown 态 daily → 显示「下次: ...」+ 每日 03:30 + 模式 增量 + [立即关闭] + [编辑]', async () => {
    const future = new Date(Date.now() + 90 * 60_000).toISOString()
    mockGetAutoCrawlConfig.mockResolvedValueOnce(BASE_CONFIG)
    mockGetCrawlerSystemStatus.mockResolvedValueOnce({ autoCrawlNext: future, schedulerEnabled: true })
    render(<AutoCrawlSummaryCard onEditClick={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-summary-countdown')).not.toBeNull()
    })
    expect(screen.getByText(/下次:\s+\d{2}-\d{2}\s+\d{2}:\d{2}/)).not.toBeNull()
    const summary = screen.getByTestId('auto-crawl-summary-schedule').textContent ?? ''
    expect(summary).toContain('每日 03:30')
    expect(summary).toContain('模式 增量')
    // countdown 态 [立即关闭] + [编辑] 两按钮
    expect(screen.getByTestId('auto-crawl-summary-close')).not.toBeNull()
    expect(screen.getByTestId('auto-crawl-summary-edit')).not.toBeNull()
  })

  it('3. schedulerEnabled=false → 「调度器进程未启动」红色警告（遮蔽其他态）', async () => {
    const future = new Date(Date.now() + 90 * 60_000).toISOString()
    // 即使 globalEnabled=true + autoCrawlNext 有值，schedulerEnabled=false 优先遮蔽
    mockGetAutoCrawlConfig.mockResolvedValueOnce(BASE_CONFIG)
    mockGetCrawlerSystemStatus.mockResolvedValueOnce({ autoCrawlNext: future, schedulerEnabled: false })
    render(<AutoCrawlSummaryCard onEditClick={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-summary-scheduler-disabled')).not.toBeNull()
    })
    expect(screen.getByText('调度器进程未启动')).not.toBeNull()
    expect(screen.getByText(/CRAWLER_SCHEDULER_ENABLED=true/)).not.toBeNull()
    // scheduler-disabled 态不渲染 countdown / disabled
    expect(screen.queryByTestId('auto-crawl-summary-countdown')).toBeNull()
    expect(screen.queryByTestId('auto-crawl-summary-disabled')).toBeNull()
  })

  it('4. [立即关闭] confirm 通过 → setAutoCrawlConfig({globalEnabled: false}) + success toast', async () => {
    const future = new Date(Date.now() + 90 * 60_000).toISOString()
    mockGetAutoCrawlConfig.mockResolvedValue(BASE_CONFIG)
    mockGetCrawlerSystemStatus.mockResolvedValue({ autoCrawlNext: future, schedulerEnabled: true })
    mockSetAutoCrawlConfig.mockResolvedValueOnce(undefined)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    try {
      render(<AutoCrawlSummaryCard onEditClick={() => {}} />)
      const closeBtn = await waitFor(() => screen.getByTestId('auto-crawl-summary-close'))
      fireEvent.click(closeBtn)
      await waitFor(() => {
        expect(mockSetAutoCrawlConfig).toHaveBeenCalledWith(
          expect.objectContaining({ globalEnabled: false, dailyTime: '03:30' }),
        )
        expect(toastPushMock).toHaveBeenCalledWith(
          expect.objectContaining({ level: 'success', title: '已关闭自动调度' }),
        )
      })
    } finally {
      confirmSpy.mockRestore()
    }
  })

  it('5. [编辑] 按钮调 onEditClick props', async () => {
    mockGetAutoCrawlConfig.mockResolvedValueOnce({ ...BASE_CONFIG, globalEnabled: false })
    const onEditClick = vi.fn()
    render(<AutoCrawlSummaryCard onEditClick={onEditClick} />)
    const editBtn = await waitFor(() => screen.getByTestId('auto-crawl-summary-edit'))
    fireEvent.click(editBtn)
    expect(onEditClick).toHaveBeenCalledTimes(1)
  })

  // ── ADR-155 D-155-6 / EP-1C-2b：多 dailyTime 显示 ──
  it('6. EP-1C-2b: dailyTimes=["03:00","04:00"] daily → schedule summary 显示多时间', async () => {
    const future = new Date(Date.now() + 90 * 60_000).toISOString()
    const CONFIG_MULTI = {
      ...BASE_CONFIG,
      dailyTime: '03:00',
      dailyTimes: ['03:00', '04:00'] as readonly string[],
    }
    mockGetAutoCrawlConfig.mockResolvedValueOnce(CONFIG_MULTI)
    mockGetCrawlerSystemStatus.mockResolvedValueOnce({ autoCrawlNext: future, schedulerEnabled: true })
    render(<AutoCrawlSummaryCard onEditClick={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-summary-countdown')).not.toBeNull()
    })
    const summary = screen.getByTestId('auto-crawl-summary-schedule').textContent ?? ''
    expect(summary).toContain('每日 03:00, 04:00')
    expect(summary).toContain('模式 增量')
  })

  it('7. EP-1C-2b: dailyTimes 缺失（仅 dailyTime alias）→ 兜底显示单时间', async () => {
    const future = new Date(Date.now() + 90 * 60_000).toISOString()
    // BASE_CONFIG 仅含 dailyTime '03:30'，无 dailyTimes 字段
    mockGetAutoCrawlConfig.mockResolvedValueOnce(BASE_CONFIG)
    mockGetCrawlerSystemStatus.mockResolvedValueOnce({ autoCrawlNext: future, schedulerEnabled: true })
    render(<AutoCrawlSummaryCard onEditClick={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('auto-crawl-summary-countdown')).not.toBeNull()
    })
    const summary = screen.getByTestId('auto-crawl-summary-schedule').textContent ?? ''
    expect(summary).toContain('每日 03:30')
    expect(summary).not.toContain(',')  // 仅一个时间
  })
})
