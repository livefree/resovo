/**
 * ImageHealthClient.test.tsx — /admin/image-health 视图单元测试
 *
 * IMGH-P1-2（SEQ-20260619-01）双 Tab 重构：
 *   - 概览 Tab（默认）：KPI（共享 KpiCard）+ 趋势 Spark + TOP 域 + 破损样本
 *   - 治理 Tab（?tab=governance）：缺图视频 DataTable
 *   - 缺图表相关用例通过 setTab('governance') 切到治理 Tab 再断言
 *
 * 覆盖（≥ 9 用例硬清单，quality-gates §7 第 1 项）：
 *   1-5  概览 Tab：PageHeader / KPI / 趋势 / TOP 域
 *   6-7,13-16  治理 Tab：缺图表 + 扩展列
 *   8-9  backfill toast ｜ 17 rescan ｜ 18 切域 Modal
 *   10-12 加载/refresh ｜ 19-20 双 Tab 切换 + 趋势 Spark
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// ── mock next/navigation（双 Tab ?tab= 同步，仿 ExternalResources.test）──

let currentParams = new URLSearchParams()
const routerPushMock = vi.fn()
function setTab(tab: string | null) {
  currentParams = new URLSearchParams(tab ? `tab=${tab}` : '')
}

vi.mock('next/navigation', () => ({
  useSearchParams: () => currentParams,
  useRouter: () => ({
    push: routerPushMock,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/admin/image-health',
}))

// ── mock api ──────────────────────────────────────────────────────

const getImageHealthStatsMock = vi.fn()
const getTopBrokenDomainsMock = vi.fn()
const listMissingVideosMock = vi.fn()
const triggerImageBackfillMock = vi.fn()
const triggerImageRescanMock = vi.fn()
const switchImageFallbackDomainMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/image-health/api', () => ({
  getImageHealthStats: (...args: unknown[]) => getImageHealthStatsMock(...args),
  getTopBrokenDomains: (...args: unknown[]) => getTopBrokenDomainsMock(...args),
  listMissingVideos: (...args: unknown[]) => listMissingVideosMock(...args),
  triggerImageBackfill: (...args: unknown[]) => triggerImageBackfillMock(...args),
  triggerImageRescan: (...args: unknown[]) => triggerImageRescanMock(...args),
  switchImageFallbackDomain: (...args: unknown[]) => switchImageFallbackDomainMock(...args),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({
      push: (input: unknown) => { toastPushMock(input); return 'test-toast-id' },
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    }),
  }
})

import { ImageHealthClient } from '../../../../../../apps/server-next/src/app/admin/image-health/_client/ImageHealthClient'

// ── fixtures ──────────────────────────────────────────────────────

const STATS_FIXTURE = {
  totalVideos: 12345,
  posterOkCount: 11000,
  posterCoverage: 0.891,
  backdropOkCount: 9876,
  backdropCoverage: 0.8,
  brokenLast7Days: 42,
  // IMGH-P1-1 对齐后端实返字段 date（非 day）
  brokenTrend: [
    { date: '2026-06-13', count: 3 },
    { date: '2026-06-14', count: 5 },
    { date: '2026-06-15', count: 2 },
    { date: '2026-06-16', count: 8 },
    { date: '2026-06-17', count: 6 },
    { date: '2026-06-18', count: 9 },
    { date: '2026-06-19', count: 9 },
  ],
}

const DOMAINS_FIXTURE = [
  { domain: 'cdn-broken.example.com', eventCount: 1500, affectedVideos: 320 },
  { domain: 'images.bad.com', eventCount: 800, affectedVideos: 150 },
]

const MISSING_VIDEOS_FIXTURE = {
  data: [
    {
      videoId: '00000000-0000-0000-0000-000000000001',
      title: 'Missing Poster Movie 1',
      posterStatus: 'missing' as const,
      posterUrl: null,
      posterSource: 'crawler',
      lastSeenBrokenAt: null,
      brokenDomain: null,
      occurrenceCount: 0,
    },
    {
      videoId: '00000000-0000-0000-0000-000000000002',
      title: 'Broken Poster Series',
      posterStatus: 'broken' as const,
      posterUrl: 'https://cdn-broken.example.com/p.jpg',
      posterSource: 'tmdb',
      lastSeenBrokenAt: new Date(Date.now() - 2 * 3600_000).toISOString(),  // 2h ago
      brokenDomain: 'cdn-broken.example.com',
      occurrenceCount: 15,
    },
    {
      videoId: '00000000-0000-0000-0000-000000000003',
      title: 'Pending Review Anime',
      posterStatus: 'pending_review' as const,
      posterUrl: 'https://images.test.com/p.jpg',
      posterSource: 'douban',
      lastSeenBrokenAt: null,
      brokenDomain: null,
      occurrenceCount: 0,
    },
  ],
  total: 3,
}

const EMPTY_MISSING = { data: [], total: 0 }
const EMPTY_DOMAINS: never[] = []

beforeEach(() => {
  getImageHealthStatsMock.mockReset()
  getTopBrokenDomainsMock.mockReset()
  listMissingVideosMock.mockReset()
  triggerImageBackfillMock.mockReset()
  triggerImageRescanMock.mockReset()
  switchImageFallbackDomainMock.mockReset()
  toastPushMock.mockReset()
  routerPushMock.mockReset()
  setTab(null)  // 默认概览 Tab
})

// ── 测试 ──────────────────────────────────────────────────────────

describe('ImageHealthClient', () => {
  it('1. 渲染基础：PageHeader + KPI grid', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    expect(screen.getByText('图片健康')).not.toBeNull()
    await waitFor(() => {
      expect(screen.getByTestId('image-health-kpi-grid')).not.toBeNull()
    })
  })

  it('2. KPI 加载成功：4 卡片 + 百分比格式（posterCoverage 0.891 → 89.1%）', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-videos')).not.toBeNull()
      expect(screen.getByText('89.1%')).not.toBeNull()  // poster coverage
      expect(screen.getByText('80.0%')).not.toBeNull()  // backdrop coverage
      expect(screen.getByText('42')).not.toBeNull()      // broken-last-7d
    })
  })

  it('3. KPI 加载失败：ErrorState 显示', async () => {
    getImageHealthStatsMock.mockRejectedValueOnce(new Error('stats 500'))
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getAllByText(/统计加载失败|stats 500/).length).toBeGreaterThan(0)
    })
  })

  it('4. 破损域名表加载成功：domain + eventCount + affectedVideos', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(DOMAINS_FIXTURE)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getByText('cdn-broken.example.com')).not.toBeNull()
      expect(screen.getByText('1,500')).not.toBeNull()
      expect(screen.getByText('320')).not.toBeNull()
    })
  })

  it('5. 破损域名表空态', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getByText('暂无破损域名')).not.toBeNull()
    })
  })

  it('6. 缺图视频表加载成功：title + posterStatus badge 3 类（治理 Tab）', async () => {
    setTab('governance')
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(MISSING_VIDEOS_FIXTURE)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getByText('Missing Poster Movie 1')).not.toBeNull()
      expect(screen.getByText('缺失')).not.toBeNull()
      expect(screen.getByText('破损')).not.toBeNull()
      expect(screen.getByText('待复核')).not.toBeNull()
    })
  })

  it('7. 缺图视频表空态（治理 Tab）', async () => {
    setTab('governance')
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getByText('无缺图视频')).not.toBeNull()
    })
  })

  it('8. backfill 按钮点击 → toast success', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    triggerImageBackfillMock.mockResolvedValueOnce({ enqueued: true, message: '已入队 backfill 任务' })
    render(<ImageHealthClient />)
    await waitFor(() => screen.getByTestId('image-health-backfill'))
    fireEvent.click(screen.getByTestId('image-health-backfill'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'success',
        title: 'Backfill 已入队',
      }))
    })
  })

  it('9. backfill 失败 → toast danger', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    triggerImageBackfillMock.mockRejectedValueOnce(new Error('入队失败'))
    render(<ImageHealthClient />)
    await waitFor(() => screen.getByTestId('image-health-backfill'))
    fireEvent.click(screen.getByTestId('image-health-backfill'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger',
        title: 'Backfill 触发失败',
      }))
    })
  })

  it('10. 初次加载并行调 3 端点 + 默认参数 page=1 limit=20', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(getImageHealthStatsMock).toHaveBeenCalled()
      expect(getTopBrokenDomainsMock).toHaveBeenCalledWith(20)
      expect(listMissingVideosMock).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      )
    })
  })

  it('11. 整体加载失败（3 端点全 reject）三类 ErrorState 不阻塞彼此', async () => {
    getImageHealthStatsMock.mockRejectedValueOnce(new Error('stats 500'))
    getTopBrokenDomainsMock.mockRejectedValueOnce(new Error('domains 500'))
    listMissingVideosMock.mockRejectedValueOnce(new Error('missing 500'))
    render(<ImageHealthClient />)
    await waitFor(() => {
      // 三个独立 ErrorState（Promise.allSettled 不互相阻塞）
      expect(screen.getAllByText(/加载失败|500/).length).toBeGreaterThanOrEqual(3)
    })
  })

  it('12. refresh 按钮触发重新加载', async () => {
    getImageHealthStatsMock.mockResolvedValue(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValue(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValue(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => screen.getByTestId('image-health-refresh'))
    const initialCalls = getImageHealthStatsMock.mock.calls.length
    fireEvent.click(screen.getByTestId('image-health-refresh'))
    await waitFor(() => {
      expect(getImageHealthStatsMock.mock.calls.length).toBeGreaterThan(initialCalls)
    })
  })

  // ── CHG-SN-6-RETRO-3-B / ultrareview P2-7：列扩展测试 ──

  it('13. 缺图视频表扩展列：posterSource 显示（治理 Tab）', async () => {
    setTab('governance')
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(MISSING_VIDEOS_FIXTURE)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getByText('crawler')).not.toBeNull()
      expect(screen.getByText('tmdb')).not.toBeNull()
      expect(screen.getByText('douban')).not.toBeNull()
    })
  })

  it('14. 缺图视频表扩展列：brokenDomain 显示 + null 兜底（治理 Tab）', async () => {
    setTab('governance')
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(MISSING_VIDEOS_FIXTURE)
    const { container } = render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.queryAllByText('cdn-broken.example.com').length).toBeGreaterThan(0)
      // null domain 显示"—"占位
      expect(container.querySelectorAll('[data-broken-domain]').length).toBe(3)
    })
  })

  it('15. 缺图视频表扩展列：occurrenceCount 千分位 + 加粗（> 10）（治理 Tab）', async () => {
    setTab('governance')
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(MISSING_VIDEOS_FIXTURE)
    const { container } = render(<ImageHealthClient />)
    await waitFor(() => {
      // occurrenceCount=15 > 10 → fontWeight 600（加粗）
      const occurrenceCells = container.querySelectorAll('[data-occurrence-count]')
      expect(occurrenceCells.length).toBe(3)
      // 含 15 的 cell
      const fifteenCell = Array.from(occurrenceCells).find((el) => el.textContent === '15')
      expect(fifteenCell).not.toBeUndefined()
      // 0 occurrence → "—"
      const dashCells = Array.from(occurrenceCells).filter((el) => el.textContent === '—')
      expect(dashCells.length).toBe(2)
    })
  })

  it('16. 缺图视频表扩展列：lastSeenBrokenAt 相对时间格式（h 前）+ null 兜底"—"（治理 Tab）', async () => {
    setTab('governance')
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(MISSING_VIDEOS_FIXTURE)
    const { container } = render(<ImageHealthClient />)
    await waitFor(() => {
      const lastSeenCells = container.querySelectorAll('[data-last-seen-broken]')
      expect(lastSeenCells.length).toBe(3)
      // 2h 前的事件 → 显示 "2h 前"
      expect(Array.from(lastSeenCells).some((el) => /\dh 前/.test(el.textContent ?? ''))).toBe(true)
      // null → "—"
      expect(Array.from(lastSeenCells).filter((el) => el.textContent === '—').length).toBe(2)
    })
  })

  it('17. 重扫封面按钮点击 → toast success（ADR-135）', async () => {
    getImageHealthStatsMock.mockResolvedValue(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValue(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValue(EMPTY_MISSING)
    triggerImageRescanMock.mockResolvedValueOnce({ updatedCount: 12, enqueued: true, scope: 'broken_only' })
    render(<ImageHealthClient />)
    await waitFor(() => screen.getByTestId('image-health-rescan'))
    fireEvent.click(screen.getByTestId('image-health-rescan'))
    await waitFor(() => {
      expect(triggerImageRescanMock).toHaveBeenCalledWith('broken_only')
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'success', title: '重扫已触发' }))
    })
  })

  it('18. 批量切 fallback 域按钮 → 打开 SwitchDomainModal', async () => {
    getImageHealthStatsMock.mockResolvedValue(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValue(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValue(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => screen.getByTestId('image-health-switch-domain'))
    fireEvent.click(screen.getByTestId('image-health-switch-domain'))
    await waitFor(() => {
      expect(screen.getByTestId('switch-domain-modal')).not.toBeNull()
    })
  })

  // ── IMGH-P1-2：双 Tab + 趋势 Spark ──

  it('19. 双 Tab 切换：默认概览渲染 KPI；点治理 Tab 调 router.push(tab=governance)', async () => {
    getImageHealthStatsMock.mockResolvedValue(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValue(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValue(EMPTY_MISSING)
    render(<ImageHealthClient />)
    // 默认概览 Tab：KPI grid 在、缺图表不在
    await waitFor(() => expect(screen.getByTestId('image-health-kpi-grid')).not.toBeNull())
    expect(screen.queryByTestId('image-health-missing-table')).toBeNull()
    // 点「图片治理」→ router.push 带 tab=governance
    fireEvent.click(screen.getByText('图片治理'))
    expect(routerPushMock).toHaveBeenCalledWith(expect.stringContaining('tab=governance'))
  })

  it('20. 概览 Tab 渲染 7 日破损趋势 Spark（消费 brokenTrend.date）', async () => {
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(EMPTY_MISSING)
    render(<ImageHealthClient />)
    await waitFor(() => {
      expect(screen.getByTestId('image-health-trend-card')).not.toBeNull()
    })
  })

  it('21. 治理 Tab：仅缺图表渲染，概览的 KPI grid 不在', async () => {
    setTab('governance')
    getImageHealthStatsMock.mockResolvedValueOnce(STATS_FIXTURE)
    getTopBrokenDomainsMock.mockResolvedValueOnce(EMPTY_DOMAINS)
    listMissingVideosMock.mockResolvedValueOnce(MISSING_VIDEOS_FIXTURE)
    render(<ImageHealthClient />)
    await waitFor(() => expect(screen.getByTestId('image-health-missing-card')).not.toBeNull())
    expect(screen.queryByTestId('image-health-kpi-grid')).toBeNull()
  })
})
