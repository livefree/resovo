/**
 * CrawlerClient.test.tsx — REDO-01-C 重写后骨架单测
 *
 * 真源：M-SN-7-redo-01-contract.md §1（6 组件契约）
 *
 * 范围（REDO-01-C 骨架）：
 *   - PageHeader title + 3 actions（导出 / + 新增站点 / 全站全量）
 *   - CrawlerKpiRow 5 张 KpiCard 数据绑定
 *   - CrawlerTimelineCard 框架 + pause toggle + 冻结 pill
 *   - CrawlerSiteList 9 列骨架 + empty / error 三态
 *   - + 新增站点 drawer 触发
 *   - 全站全量 confirm + API + toast
 *
 * 不在本卡范围（暂不覆盖）：
 *   - 行级 {more} 菜单（REDO-01-D）
 *   - 行展开（REDO-01-E + F）
 *   - 高级 dropdown / freeze toggle / stop-all / reindex（REDO-01-G）
 *   - runs 独立路由（REDO-01-H）
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const listCrawlerSitesMock = vi.fn()
const getCrawlerSystemStatusMock = vi.fn()
const getCrawlerKpiMock = vi.fn()
const getCrawlerTimelineMock = vi.fn()
const runCrawlerAllMock = vi.fn()
const runCrawlerSiteMock = vi.fn()
const createCrawlerSiteMock = vi.fn()
const updateCrawlerSiteMock = vi.fn()
const deleteCrawlerSiteMock = vi.fn()
const validateCrawlerSiteMock = vi.fn()
// REDO-01-E：sources 域跨调 mocks
const listRoutesBySiteMock = vi.fn()
const upsertLineAliasMock = vi.fn()
// REDO-01-E2：sources 域行级 mutations mocks
const testRouteMock = vi.fn()
const reprobeRouteMock = vi.fn()
const deleteRouteMock = vi.fn()
// REDO-01-G：高级菜单 4 项（freeze / stop-all / reindex）
const setCrawlerFreezeMock = vi.fn()
const stopAllCrawlerMock = vi.fn()
const triggerReindexMock = vi.fn()
const toastPushMock = vi.fn()
const confirmSpy = vi.fn().mockReturnValue(true)
// CHG-SN-8-03：next/navigation router.push 用于 toast action 深链
const routerPushMock = vi.fn()
// CW1-D：SchedulerConfigDrawer mock 暴露引用 (默认 pending Promise / case 内可 mockResolvedValueOnce)
const getAutoCrawlConfigMock = vi.fn(() => new Promise(() => {}))
const setAutoCrawlConfigMock = vi.fn(() => new Promise(() => {}))

vi.mock('../../../../../../apps/server-next/src/lib/crawler/api', () => ({
  listCrawlerSites: (...args: unknown[]) => listCrawlerSitesMock(...args),
  createCrawlerSite: (...args: unknown[]) => createCrawlerSiteMock(...args),
  updateCrawlerSite: (...args: unknown[]) => updateCrawlerSiteMock(...args),
  deleteCrawlerSite: (...args: unknown[]) => deleteCrawlerSiteMock(...args),
  validateCrawlerSite: (...args: unknown[]) => validateCrawlerSiteMock(...args),
  getCrawlerSystemStatus: (...args: unknown[]) => getCrawlerSystemStatusMock(...args),
  getCrawlerKpi: (...args: unknown[]) => getCrawlerKpiMock(...args),
  getCrawlerTimeline: (...args: unknown[]) => getCrawlerTimelineMock(...args),
  runCrawlerAll: (...args: unknown[]) => runCrawlerAllMock(...args),
  runCrawlerSite: (...args: unknown[]) => runCrawlerSiteMock(...args),
  setCrawlerFreeze: (...args: unknown[]) => setCrawlerFreezeMock(...args),
  stopAllCrawler: (...args: unknown[]) => stopAllCrawlerMock(...args),
  triggerReindex: (...args: unknown[]) => triggerReindexMock(...args),
  // SchedulerConfigDrawer 依赖（关闭时不会调用 / CW1-D 测试 open 状态时 case 内 mockResolvedValueOnce）
  getAutoCrawlConfig: (...args: unknown[]) => getAutoCrawlConfigMock(...args),
  setAutoCrawlConfig: (...args: unknown[]) => setAutoCrawlConfigMock(...args),
}))

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  listRoutesBySite: (...args: unknown[]) => listRoutesBySiteMock(...args),
  upsertLineAlias: (...args: unknown[]) => upsertLineAliasMock(...args),
  testRoute: (...args: unknown[]) => testRouteMock(...args),
  reprobeRoute: (...args: unknown[]) => reprobeRouteMock(...args),
  deleteRoute: (...args: unknown[]) => deleteRouteMock(...args),
}))

// CHG-SN-8-03：mock next/navigation for router.push 验证（深链 toast action）
// CW1-D：useSearchParams 改为可控 mock（默认空，case 内可 set openDrawer=scheduler）
const routerReplaceMock = vi.fn()
const mockCrawlerSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => routerPushMock(...args),
    replace: (...args: unknown[]) => routerReplaceMock(...args),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockCrawlerSearchParams,
  usePathname: () => '/admin/crawler',
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

// ADR-155 D-155-5 / EP-1B2：mock AutoCrawlSummaryCard（独立测试范围）
// CrawlerClient.test 仅验证嵌入 + 不消耗 getAutoCrawlConfig mock；SummaryCard 内部行为
// 在 AutoCrawlSummaryCard.test.tsx 单独覆盖（避免双重 mock）
vi.mock('../../../../../../apps/server-next/src/app/admin/crawler/_client/AutoCrawlSummaryCard', () => ({
  AutoCrawlSummaryCard: () => <div data-testid="mock-auto-crawl-summary-card" />,
}))

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => {
  class MockApiClientError extends Error {
    public readonly code: string
    public readonly status: number
    constructor(code: string, message: string, status: number) {
      super(message)
      this.code = code
      this.status = status
      this.name = 'ApiClientError'
    }
  }
  return {
    ApiClientError: MockApiClientError,
    apiClient: {
      get: vi.fn(), post: vi.fn(), postMultipart: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    },
  }
})

import { CrawlerClient } from '../../../../../../apps/server-next/src/app/admin/crawler/_client/CrawlerClient'
import { ApiClientError } from '../../../../../../apps/server-next/src/lib/api-client'

const SITE_1 = {
  key: 'jszyapi',
  name: '极速资源',
  displayName: null,
  apiUrl: 'https://jszyapi.com/api.php/provide/vod',
  detail: null,
  sourceType: 'vod' as const,
  format: 'json' as const,
  weight: 80,
  isAdult: false,
  disabled: false,
  fromConfig: false,
  lastCrawledAt: null,
  lastCrawlStatus: null,
  ingestPolicy: {} as never,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-16T00:00:00Z',
}

const KPI_LIVE = {
  totalSites: 40,
  healthySites: 33,
  runningSites: 7,
  failedSites: 5,
  batchVideoCount: 649,
  batchVideoDelta: 47,
  avgDurationSeconds: 62,
  siteStats: [{ key: 'jszyapi', routeCount: 3, health: 88 }],
}

const TIMELINE_LIVE = {
  rangeStart: '2026-05-18T22:00:00Z',
  rangeEnd: '2026-05-18T23:00:00Z',
  ticks: ['2026-05-18T22:00:00Z', '2026-05-18T22:30:00Z', '2026-05-18T23:00:00Z'],
  rows: [
    {
      siteKey: 'jszyapi',
      siteName: '极速资源',
      health: 88,
      startPct: 0.1,
      widthPct: 0.4,
      durationSeconds: 60,
      videoCount: 12,
      status: 'ok' as const,
      last: '2026-05-18T22:55:00Z',
    },
  ],
}

beforeEach(() => {
  listCrawlerSitesMock.mockReset()
  createCrawlerSiteMock.mockReset()
  updateCrawlerSiteMock.mockReset()
  deleteCrawlerSiteMock.mockReset()
  validateCrawlerSiteMock.mockReset()
  getCrawlerSystemStatusMock.mockReset()
  getCrawlerKpiMock.mockReset()
  getCrawlerTimelineMock.mockReset()
  runCrawlerAllMock.mockReset()
  runCrawlerSiteMock.mockReset()
  listRoutesBySiteMock.mockReset()
  upsertLineAliasMock.mockReset()
  testRouteMock.mockReset()
  reprobeRouteMock.mockReset()
  deleteRouteMock.mockReset()
  setCrawlerFreezeMock.mockReset()
  stopAllCrawlerMock.mockReset()
  triggerReindexMock.mockReset()
  toastPushMock.mockReset()
  routerPushMock.mockReset()
  routerReplaceMock.mockReset()
  confirmSpy.mockReset().mockReturnValue(true)
  ;(globalThis as unknown as { confirm: typeof confirmSpy }).confirm = confirmSpy

  // CW1-D：清空 mock search params（避免 case 之间污染 openDrawer=scheduler）
  for (const key of Array.from(mockCrawlerSearchParams.keys())) {
    mockCrawlerSearchParams.delete(key)
  }

  // 默认成功 mock，便于个别用例 override
  listCrawlerSitesMock.mockResolvedValue([])
  getCrawlerSystemStatusMock.mockResolvedValue({})
  getCrawlerKpiMock.mockResolvedValue(KPI_LIVE)
  getCrawlerTimelineMock.mockResolvedValue(TIMELINE_LIVE)
})

describe('CrawlerClient (REDO-01-C 骨架)', () => {
  it('1. 渲染基础：data-crawler-client + PageHeader title', async () => {
    const { container } = render(<CrawlerClient />)
    expect(container.querySelector('[data-crawler-client]')).not.toBeNull()
    expect(screen.getByText('采集控制')).not.toBeNull()
  })

  it('2. PageHeader 3 actions（导出 / + 新增 / 全站增量 primary）渲染 [CHG-SN-8-01]', async () => {
    render(<CrawlerClient />)
    await waitFor(() => screen.getByTestId('crawler-export-btn'))
    expect(screen.getByTestId('crawler-export-btn')).not.toBeNull()
    expect(screen.getByTestId('crawler-create-btn')).not.toBeNull()
    // CHG-SN-8-01：主按钮从「全站全量」改为「全站增量」（incremental，更高频）
    const primaryBtn = screen.getByTestId('crawler-run-all-incremental-btn')
    expect(primaryBtn).not.toBeNull()
    expect(primaryBtn.textContent).toContain('全站增量')
    // 旧 testid 已下线
    expect(screen.queryByTestId('crawler-run-all-btn')).toBeNull()
  })

  it('3. CrawlerKpiRow 5 张 KpiCard 渲染（站点 / 运行中 / 失败 / 本批 / 平均时长）', async () => {
    const { container } = render(<CrawlerClient />)
    await waitFor(() => {
      expect(container.querySelector('[data-crawler-kpi-row]')).not.toBeNull()
      expect(container.querySelector('[data-testid="crawler-kpi-total"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="crawler-kpi-running"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="crawler-kpi-failed"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="crawler-kpi-batch"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="crawler-kpi-avg-duration"]')).not.toBeNull()
    })
  })

  it('4. CrawlerTimelineCard 渲染时间轴框架 + status pill', async () => {
    const { container } = render(<CrawlerClient />)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="crawler-timeline-card"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="crawler-timeline-status-pill"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="crawler-timeline-pause-toggle"]')).not.toBeNull()
    })
  })

  it('5. freezeEnabled=true → 时间轴 pill 显示"全局冻结"', async () => {
    getCrawlerSystemStatusMock.mockResolvedValue({ freezeEnabled: true })
    const { container } = render(<CrawlerClient />)
    await waitFor(() => {
      const pill = container.querySelector('[data-testid="crawler-timeline-status-pill"]')
      expect(pill?.textContent).toContain('全局冻结')
      expect(pill?.getAttribute('data-frozen')).toBe('')
    })
  })

  it('6. 暂停切换按钮：默认"暂停刷新" → 点击后"恢复刷新"', async () => {
    render(<CrawlerClient />)
    const btn = await waitFor(() => screen.getByTestId('crawler-timeline-pause-toggle'))
    expect(btn.textContent).toContain('暂停刷新')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByTestId('crawler-timeline-pause-toggle').textContent).toContain('恢复刷新')
    })
  })

  it('7. 站点列表加载：渲染 key + name（时间轴 + 表格同名 → getAllByText）', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    render(<CrawlerClient />)
    await waitFor(() => {
      // 极速资源 在时间轴行 + 表格 site 列同时出现
      expect(screen.getAllByText('极速资源').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(/jszyapi/).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('8. Empty state：零站点渲染"暂无站点"', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([])
    render(<CrawlerClient />)
    await waitFor(() => {
      expect(screen.getByText('暂无站点')).not.toBeNull()
    })
  })

  it('9. Error state：sites fetch 失败 → ErrorState 渲染', async () => {
    listCrawlerSitesMock.mockRejectedValueOnce(new Error('crawler 500'))
    const { container } = render(<CrawlerClient />)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="crawler-site-list-error"]')).not.toBeNull()
    })
  })

  it('10. + 新增站点：点击触发 drawer 打开', async () => {
    render(<CrawlerClient />)
    await waitFor(() => screen.getByTestId('crawler-create-btn'))
    fireEvent.click(screen.getByTestId('crawler-create-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('crawler-drawer')).not.toBeNull()
    })
  })

  it('11. 全站增量：单次 confirm 通过 → runCrawlerAll(incremental) + 成功 toast [CHG-SN-8-01]', async () => {
    runCrawlerAllMock.mockResolvedValueOnce({
      runId: 'run-abc12345',
      taskIds: ['t1'],
      enqueuedSiteKeys: ['s1', 's2'],
      skippedSiteKeys: [],
    })
    render(<CrawlerClient />)
    const btn = await waitFor(() => screen.getByTestId('crawler-run-all-incremental-btn'))
    fireEvent.click(btn)
    await waitFor(() => {
      expect(runCrawlerAllMock).toHaveBeenCalledWith('incremental')
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已发起全站增量' }),
      )
    })
  })

  it('12. 全站增量：confirm 拒绝 → 不调 API [CHG-SN-8-01]', async () => {
    confirmSpy.mockReset().mockReturnValue(false)
    ;(globalThis as unknown as { confirm: typeof confirmSpy }).confirm = confirmSpy
    render(<CrawlerClient />)
    const btn = await waitFor(() => screen.getByTestId('crawler-run-all-incremental-btn'))
    fireEvent.click(btn)
    await new Promise((r) => setTimeout(r, 0))
    expect(runCrawlerAllMock).not.toHaveBeenCalled()
  })

  it('13. freezeEnabled=true → 全站增量被拦截（warn toast）[CHG-SN-8-01]', async () => {
    getCrawlerSystemStatusMock.mockResolvedValue({ freezeEnabled: true })
    render(<CrawlerClient />)
    // CW1-D：先等 status load 完成（subtitle "采集已关闭" 出现）再 click，
    // 避免 jsdom batch 跑时 button 早于 status setState 出现导致竞态。
    await waitFor(() => expect(screen.getByText(/采集已关闭/)).not.toBeNull())
    const btn = screen.getByTestId('crawler-run-all-incremental-btn')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'warn', title: '采集已冻结' }),
      )
      expect(runCrawlerAllMock).not.toHaveBeenCalled()
    })
  })

  it('13a. 全站全量（advanced menu）：双重 confirm 通过 → runCrawlerAll(full) + 成功 toast [CHG-SN-8-01]', async () => {
    // 第一次 confirm 通过 + prompt 输入"全量"
    confirmSpy.mockReset().mockReturnValue(true)
    ;(globalThis as unknown as { confirm: typeof confirmSpy }).confirm = confirmSpy
    const promptSpy = vi.fn(() => '全量')
    ;(globalThis as unknown as { prompt: typeof promptSpy }).prompt = promptSpy

    runCrawlerAllMock.mockResolvedValueOnce({
      runId: 'run-full999',
      taskIds: [],
      enqueuedSiteKeys: ['s1'],
      skippedSiteKeys: [],
    })

    render(<CrawlerClient />)
    const trigger = await waitFor(() => screen.getByTestId('crawler-advanced-trigger'))
    fireEvent.click(trigger)
    const fullItem = await waitFor(() => screen.getByText('全站全量'))
    fireEvent.click(fullItem)

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled()
      expect(promptSpy).toHaveBeenCalled()
      expect(runCrawlerAllMock).toHaveBeenCalledWith('full')
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已发起全站全量' }),
      )
    })
  })

  it('13b. 全站全量（advanced menu）：prompt 输错文字 → 静默中止 [CHG-SN-8-01]', async () => {
    confirmSpy.mockReset().mockReturnValue(true)
    ;(globalThis as unknown as { confirm: typeof confirmSpy }).confirm = confirmSpy
    const promptSpy = vi.fn(() => '错的')
    ;(globalThis as unknown as { prompt: typeof promptSpy }).prompt = promptSpy

    render(<CrawlerClient />)
    const trigger = await waitFor(() => screen.getByTestId('crawler-advanced-trigger'))
    fireEvent.click(trigger)
    const fullItem = await waitFor(() => screen.getByText('全站全量'))
    fireEvent.click(fullItem)

    await new Promise((r) => setTimeout(r, 0))
    expect(confirmSpy).toHaveBeenCalled()
    expect(promptSpy).toHaveBeenCalled()
    expect(runCrawlerAllMock).not.toHaveBeenCalled()
    // 不应出现失败 toast（静默中止）
    expect(toastPushMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ level: 'danger' }),
    )
  })

  it('13c. 全站全量（advanced menu）：第一次 confirm 取消 → 不调 prompt 也不调 API [CHG-SN-8-01]', async () => {
    confirmSpy.mockReset().mockReturnValue(false)
    ;(globalThis as unknown as { confirm: typeof confirmSpy }).confirm = confirmSpy
    const promptSpy = vi.fn()
    ;(globalThis as unknown as { prompt: typeof promptSpy }).prompt = promptSpy

    render(<CrawlerClient />)
    const trigger = await waitFor(() => screen.getByTestId('crawler-advanced-trigger'))
    fireEvent.click(trigger)
    const fullItem = await waitFor(() => screen.getByText('全站全量'))
    fireEvent.click(fullItem)

    await new Promise((r) => setTimeout(r, 0))
    expect(confirmSpy).toHaveBeenCalled()
    expect(promptSpy).not.toHaveBeenCalled()
    expect(runCrawlerAllMock).not.toHaveBeenCalled()
  })

  it('13d. 全站全量（advanced menu）：freezeEnabled=true → 不弹 confirm 直接 warn toast [CHG-SN-8-01]', async () => {
    getCrawlerSystemStatusMock.mockResolvedValue({ freezeEnabled: true })
    const promptSpy = vi.fn()
    ;(globalThis as unknown as { prompt: typeof promptSpy }).prompt = promptSpy

    render(<CrawlerClient />)
    const trigger = await waitFor(() => screen.getByTestId('crawler-advanced-trigger'))
    fireEvent.click(trigger)
    const fullItem = await waitFor(() => screen.getByText('全站全量'))
    fireEvent.click(fullItem)

    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'warn', title: '采集已冻结' }),
      )
    })
    expect(promptSpy).not.toHaveBeenCalled()
    expect(runCrawlerAllMock).not.toHaveBeenCalled()
  })

  it('13h. 全站增量 toast 含 action「查看本次新增视频」并跳 /admin/moderation?run_id=... [CHG-SN-8-03]', async () => {
    runCrawlerAllMock.mockResolvedValueOnce({
      runId: 'run-abcdef1234567890',
      taskIds: [],
      enqueuedSiteKeys: ['s1'],
      skippedSiteKeys: [],
    })

    render(<CrawlerClient />)
    const btn = await waitFor(() => screen.getByTestId('crawler-run-all-incremental-btn'))
    fireEvent.click(btn)

    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'success',
          title: '已发起全站增量',
          action: expect.objectContaining({
            label: '查看本次新增视频',
            onClick: expect.any(Function),
          }),
        }),
      )
    })

    // 触发 action onClick → router.push
    const lastCall = toastPushMock.mock.calls[toastPushMock.mock.calls.length - 1]
    const toastInput = lastCall[0] as { action?: { onClick: () => void } }
    toastInput.action?.onClick()
    expect(routerPushMock).toHaveBeenCalledWith('/admin/moderation?run_id=run-abcdef1234567890')
  })

  it('13e. 最近采集列：lastCrawlStatus=ok → 渲染"成功" pill + 时间 [CHG-SN-8-02]', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([
      { ...SITE_1, lastCrawlStatus: 'ok', lastCrawledAt: new Date(Date.now() - 5 * 60_000).toISOString() },
    ])
    const { container } = render(<CrawlerClient />)
    await waitFor(() => {
      const pill = container.querySelector('[data-last-crawl-status="ok"]')
      expect(pill).not.toBeNull()
      expect(pill?.textContent).toContain('成功')
      const time = container.querySelector('[data-last-crawl-time]')
      expect(time?.textContent).toMatch(/分钟前|刚刚/)
    })
  })

  it('13f. 最近采集列：lastCrawlStatus=failed → 渲染"失败" pill [CHG-SN-8-02]', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([
      { ...SITE_1, lastCrawlStatus: 'failed', lastCrawledAt: '2026-05-20T00:00:00Z' },
    ])
    const { container } = render(<CrawlerClient />)
    await waitFor(() => {
      const pill = container.querySelector('[data-last-crawl-status="failed"]')
      expect(pill).not.toBeNull()
      expect(pill?.textContent).toContain('失败')
    })
  })

  it('13g. 最近采集列：lastCrawlStatus=null → 渲染"未采集" pill [CHG-SN-8-02]', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([
      { ...SITE_1, lastCrawlStatus: null, lastCrawledAt: null },
    ])
    const { container } = render(<CrawlerClient />)
    await waitFor(() => {
      const pill = container.querySelector('[data-last-crawl-status="none"]')
      expect(pill).not.toBeNull()
      expect(pill?.textContent).toContain('未采集')
    })
  })

  it('14a. 导出按钮：空 sites → warn toast "无可导出数据"', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([])
    render(<CrawlerClient />)
    const btn = await waitFor(() => screen.getByTestId('crawler-export-btn'))
    fireEvent.click(btn)
    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'warn', title: '无可导出数据' }),
    )
  })

  it('14b. 导出按钮：非空 sites → CSV 下载 + success toast', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    // 拦截 anchor click 与 createObjectURL（jsdom 默认不实现）
    const clickSpy = vi.fn()
    const createObjectUrlSpy = vi.fn().mockReturnValue('blob:fake')
    const revokeSpy = vi.fn()
    ;(globalThis.URL as unknown as { createObjectURL: typeof createObjectUrlSpy }).createObjectURL = createObjectUrlSpy
    ;(globalThis.URL as unknown as { revokeObjectURL: typeof revokeSpy }).revokeObjectURL = revokeSpy
    const origCreate = document.createElement.bind(document)
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag)
      if (tag === 'a') (el as unknown as { click: typeof clickSpy }).click = clickSpy
      return el
    })
    try {
      render(<CrawlerClient />)
      const btn = await waitFor(() => screen.getByTestId('crawler-export-btn'))
      fireEvent.click(btn)
      await waitFor(() => {
        expect(clickSpy).toHaveBeenCalledOnce()
        expect(toastPushMock).toHaveBeenCalledWith(
          expect.objectContaining({ level: 'success', title: '已导出' }),
        )
      })
    } finally {
      createSpy.mockRestore()
    }
  })

  it('15. siteStats 注入 health + routeCount 列', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    const { container } = render(<CrawlerClient />)
    await waitFor(() => {
      // routeCount 列：3 条
      expect(container.querySelector('[data-route-count]')?.textContent).toContain('3')
      // health dot label
      expect(container.querySelector('[data-site-status-dot]')?.getAttribute('aria-label')).toContain('88')
    })
  })

  it('16. PageHeader subtitle 包含站点计数 + 采集已关闭状态 + 下次自动 chip [CW1-A]', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    getCrawlerSystemStatusMock.mockResolvedValue({ freezeEnabled: true })
    render(<CrawlerClient />)
    await waitFor(() => {
      expect(screen.getByText(/1 个站点/)).not.toBeNull()
      expect(screen.getByText(/采集已关闭/)).not.toBeNull()
      // CW1-A 定时面板 1/3：autoCrawlNext 未注入时 → "下次自动: 未启用"
      expect(screen.getByText(/下次自动: 未启用/)).not.toBeNull()
    })
  })

  it('16b. PageHeader subtitle 下次自动 chip — autoCrawlNext ISO → MM-DD HH:mm 格式 [CW1-A]', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    // 用未来时间避免时区敏感（取一个固定 ISO）
    const futureIso = '2030-06-15T08:30:00.000Z'
    getCrawlerSystemStatusMock.mockResolvedValue({ autoCrawlNext: futureIso })
    render(<CrawlerClient />)
    await waitFor(() => {
      // 本地时区渲染：用 new Date(iso).getHours()/getMinutes() 推断断言（避免硬编码时区）
      const d = new Date(futureIso)
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const hh = String(d.getHours()).padStart(2, '0')
      const mi = String(d.getMinutes()).padStart(2, '0')
      expect(screen.getByText(new RegExp(`下次自动: ${mm}-${dd} ${hh}:${mi}`))).not.toBeNull()
    })
  })
})

describe('CrawlerClient (REDO-01-D 行级操作)', () => {
  it('17. 行级 + 增量：点击触发 runCrawlerSite(incremental) + 成功 toast', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    runCrawlerSiteMock.mockResolvedValueOnce({
      runId: 'run-incr-001',
      taskIds: ['t1'],
      enqueuedSiteKeys: ['jszyapi'],
      skippedSiteKeys: [],
    })
    render(<CrawlerClient />)
    const btn = await waitFor(() => screen.getByTestId('crawler-row-run-incremental-jszyapi'))
    fireEvent.click(btn)
    await waitFor(() => {
      expect(runCrawlerSiteMock).toHaveBeenCalledWith('jszyapi', 'incremental')
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已发起增量' }),
      )
    })
  })

  it('18. 行级 + 全量：点击触发 runCrawlerSite(full) + 成功 toast', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    runCrawlerSiteMock.mockResolvedValueOnce({
      runId: 'run-full-001',
      taskIds: ['t1'],
      enqueuedSiteKeys: ['jszyapi'],
      skippedSiteKeys: [],
    })
    render(<CrawlerClient />)
    const btn = await waitFor(() => screen.getByTestId('crawler-row-run-full-jszyapi'))
    fireEvent.click(btn)
    await waitFor(() => {
      expect(runCrawlerSiteMock).toHaveBeenCalledWith('jszyapi', 'full')
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已发起全量' }),
      )
    })
  })

  it('19. freezeEnabled=true → 行级 + 增量 被拦截（warn toast）', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    getCrawlerSystemStatusMock.mockResolvedValue({ freezeEnabled: true })
    render(<CrawlerClient />)
    const btn = await waitFor(() => screen.getByTestId('crawler-row-run-incremental-jszyapi'))
    fireEvent.click(btn)
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'warn', title: '采集已冻结' }),
      )
      expect(runCrawlerSiteMock).not.toHaveBeenCalled()
    })
  })

  it('20. disabled site → 行级 + 增量 / + 全量 按钮 disabled', async () => {
    const SITE_DISABLED = { ...SITE_1, key: 'tmp', disabled: true }
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_DISABLED])
    render(<CrawlerClient />)
    await waitFor(() => {
      const incBtn = screen.getByTestId('crawler-row-run-incremental-tmp') as HTMLButtonElement
      const fullBtn = screen.getByTestId('crawler-row-run-full-tmp') as HTMLButtonElement
      expect(incBtn.disabled).toBe(true)
      expect(fullBtn.disabled).toBe(true)
    })
  })

  it('21. {more} dropdown：点击 trigger 展开菜单（5 项渲染 / CW1-A 撤 delete）', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    render(<CrawlerClient />)
    const trigger = await waitFor(() => screen.getByTestId('crawler-row-actions-trigger-jszyapi'))
    fireEvent.click(trigger)
    await waitFor(() => {
      expect(screen.getByText('编辑站点')).not.toBeNull()
      expect(screen.getByText('禁用')).not.toBeNull() // SITE_1.disabled=false
      expect(screen.getByText('复制 key')).not.toBeNull()
      expect(screen.getByText('标记成人')).not.toBeNull() // SITE_1.isAdult=false
      expect(screen.getByText('标记短剧')).not.toBeNull() // SITE_1.sourceType=vod
      // CW1-A：撤回 "删除站点" 入口（后端端点保留供运维脚本 + config 孤儿同步）
      expect(screen.queryByText('删除站点')).toBeNull()
    })
  })

  it('22. {more} 启用/禁用动态 label：disabled=true → "启用"', async () => {
    const SITE_OFF = { ...SITE_1, key: 'off', disabled: true }
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_OFF])
    render(<CrawlerClient />)
    const trigger = await waitFor(() => screen.getByTestId('crawler-row-actions-trigger-off'))
    fireEvent.click(trigger)
    await waitFor(() => {
      expect(screen.getByText('启用')).not.toBeNull()
    })
  })

  it('23. {more} → 启用/禁用：调 updateCrawlerSite(disabled) + 成功 toast', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    updateCrawlerSiteMock.mockResolvedValueOnce({ ...SITE_1, disabled: true })
    render(<CrawlerClient />)
    const trigger = await waitFor(() => screen.getByTestId('crawler-row-actions-trigger-jszyapi'))
    fireEvent.click(trigger)
    const toggleItem = await waitFor(() => screen.getByText('禁用'))
    fireEvent.click(toggleItem)
    await waitFor(() => {
      expect(updateCrawlerSiteMock).toHaveBeenCalledWith('jszyapi', { disabled: true })
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已禁用' }),
      )
    })
  })

  it('24. {more} → 标记成人：调 updateCrawlerSite(isAdult: true) + 成功 toast', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    updateCrawlerSiteMock.mockResolvedValueOnce({ ...SITE_1, isAdult: true })
    render(<CrawlerClient />)
    const trigger = await waitFor(() => screen.getByTestId('crawler-row-actions-trigger-jszyapi'))
    fireEvent.click(trigger)
    const item = await waitFor(() => screen.getByText('标记成人'))
    fireEvent.click(item)
    await waitFor(() => {
      expect(updateCrawlerSiteMock).toHaveBeenCalledWith('jszyapi', { isAdult: true })
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已标记成人' }),
      )
    })
  })

  it('25. {more} → 标记短剧：调 updateCrawlerSite(sourceType: shortdrama)', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    updateCrawlerSiteMock.mockResolvedValueOnce({ ...SITE_1, sourceType: 'shortdrama' })
    render(<CrawlerClient />)
    const trigger = await waitFor(() => screen.getByTestId('crawler-row-actions-trigger-jszyapi'))
    fireEvent.click(trigger)
    const item = await waitFor(() => screen.getByText('标记短剧'))
    fireEvent.click(item)
    await waitFor(() => {
      expect(updateCrawlerSiteMock).toHaveBeenCalledWith('jszyapi', { sourceType: 'shortdrama' })
    })
  })

  it('27. {more} → 编辑站点：打开 drawer 且填入 form', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    render(<CrawlerClient />)
    const trigger = await waitFor(() => screen.getByTestId('crawler-row-actions-trigger-jszyapi'))
    fireEvent.click(trigger)
    const editItem = await waitFor(() => screen.getByText('编辑站点'))
    fireEvent.click(editItem)
    await waitFor(() => {
      expect(screen.getByTestId('crawler-drawer')).not.toBeNull()
    })
  })

  it('28. {more} → 复制 key：调 navigator.clipboard.writeText + 成功 toast', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    })
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    render(<CrawlerClient />)
    const trigger = await waitFor(() => screen.getByTestId('crawler-row-actions-trigger-jszyapi'))
    fireEvent.click(trigger)
    const copyItem = await waitFor(() => screen.getByText('复制 key'))
    fireEvent.click(copyItem)
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('jszyapi')
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已复制' }),
      )
    })
  })
})

describe('CrawlerClient (REDO-01-E 行展开 + 线路 sub-table)', () => {
  const ROUTE_1 = {
    sourceSiteKey: 'jszyapi',
    sourceName: '线路1',
    displayName: 'JSZY 主线',
    probeStatus: 'ok' as const,
    renderStatus: 'partial' as const,
    avgLatencyMs: 120,
    sourceCount: 5,
    activeCount: 4,
    lastProbedAt: '2026-05-19T10:00:00Z',
  }

  it('29. 默认不展开：CrawlerSiteExpand 不渲染', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    render(<CrawlerClient />)
    await waitFor(() => screen.getAllByText('极速资源'))
    expect(screen.queryByTestId('crawler-expand-jszyapi')).toBeNull()
    expect(listRoutesBySiteMock).not.toHaveBeenCalled()
  })

  it('30. 点击 chevron 触发 expand → lazy fetch listRoutesBySite + 渲染线路明细', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockResolvedValueOnce([ROUTE_1])
    render(<CrawlerClient />)
    const chevron = await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi'))
    fireEvent.click(chevron)
    await waitFor(() => {
      expect(listRoutesBySiteMock).toHaveBeenCalledWith('jszyapi')
      expect(screen.getByTestId('crawler-expand-jszyapi')).not.toBeNull()
      expect(screen.getByText('线路1')).not.toBeNull()
    })
  })

  it('31. chevron 二次点击折叠：expandedKeys 移除 + expand 区消失', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockResolvedValueOnce([ROUTE_1])
    render(<CrawlerClient />)
    const chevron = await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi'))
    fireEvent.click(chevron)
    await waitFor(() => screen.getByTestId('crawler-expand-jszyapi'))
    fireEvent.click(chevron)
    await waitFor(() => {
      expect(screen.queryByTestId('crawler-expand-jszyapi')).toBeNull()
    })
  })

  it('32. chevron 旋转：expanded 时 data-expanded 属性 + aria-label 切换', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockResolvedValueOnce([ROUTE_1])
    render(<CrawlerClient />)
    const chevron = await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi'))
    expect(chevron.getAttribute('data-expanded')).toBeNull()
    expect(chevron.getAttribute('aria-label')).toContain('展开')
    fireEvent.click(chevron)
    await waitFor(() => {
      const updated = screen.getByTestId('crawler-row-expand-jszyapi')
      expect(updated.getAttribute('data-expanded')).toBe('')
      expect(updated.getAttribute('aria-label')).toContain('折叠')
    })
  })

  it('33. 线路 sub-table 渲染 6 列内容（线路名 / 别名 input / 探测 pill / 播放 pill / 延迟 / 操作占位）', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockResolvedValueOnce([ROUTE_1])
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi')))
    await waitFor(() => {
      expect(screen.getByText('线路1')).not.toBeNull()
      // AdminInput data-testid 在 wrapper div；取内部真实 input
      const aliasWrap = screen.getByTestId('crawler-route-alias-线路1')
      const aliasInput = aliasWrap.querySelector('input[data-admin-input-control]') as HTMLInputElement
      expect(aliasInput.value).toBe('JSZY 主线')
      const probe = screen.getByTestId('crawler-route-probe-线路1')
      expect(probe.getAttribute('data-signal')).toBe('ok')
      const renderPill = screen.getByTestId('crawler-route-render-线路1')
      expect(renderPill.getAttribute('data-signal')).toBe('partial')
      expect(screen.getByTestId('crawler-route-latency-线路1').textContent).toBe('120ms')
    })
  })

  it('34. 别名 inline-edit：onBlur 调 upsertLineAlias + 成功 toast + 行内 displayName 更新', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockResolvedValueOnce([ROUTE_1])
    upsertLineAliasMock.mockResolvedValueOnce({
      sourceSiteKey: 'jszyapi',
      sourceName: '线路1',
      displayName: 'JSZY 新别名',
      updatedAt: '2026-05-19T11:00:00Z',
    })
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi')))
    const wrap = await waitFor(() => screen.getByTestId('crawler-route-alias-线路1'))
    const input = wrap.querySelector('input[data-admin-input-control]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'JSZY 新别名' } })
    fireEvent.blur(input)
    await waitFor(() => {
      expect(upsertLineAliasMock).toHaveBeenCalledWith('jszyapi', '线路1', 'JSZY 新别名')
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '别名已更新' }),
      )
    })
  })

  it('35. 别名 inline-edit 同值 onBlur → 不调 API', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockResolvedValueOnce([ROUTE_1])
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi')))
    const wrap = await waitFor(() => screen.getByTestId('crawler-route-alias-线路1'))
    const input = wrap.querySelector('input[data-admin-input-control]') as HTMLInputElement
    fireEvent.blur(input)
    await new Promise((r) => setTimeout(r, 0))
    expect(upsertLineAliasMock).not.toHaveBeenCalled()
  })

  it('36. listRoutesBySite 失败 → 渲染 expand error 块 + 不抛错', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockRejectedValueOnce(new Error('routes 500'))
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi')))
    await waitFor(() => {
      expect(screen.getByTestId('crawler-expand-error-jszyapi')).not.toBeNull()
    })
  })

  it('37. 空线路 → 渲染 "暂无线路数据" 占位', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockResolvedValueOnce([])
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi')))
    await waitFor(() => {
      expect(screen.getByTestId('crawler-expand-empty-jszyapi')).not.toBeNull()
    })
  })
})

describe('CrawlerClient (REDO-01-E2 行级 3 mutations + role 守卫)', () => {
  const ROUTE_1 = {
    sourceSiteKey: 'jszyapi',
    sourceName: '线路1',
    displayName: 'JSZY 主线',
    probeStatus: 'ok' as const,
    renderStatus: 'partial' as const,
    avgLatencyMs: 120,
    sourceCount: 5,
    activeCount: 4,
    lastProbedAt: '2026-05-19T10:00:00Z',
  }

  it('38. test 按钮渲染（admin role 默认）+ click → testRoute + 成功 toast (ok=true)', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockResolvedValueOnce([ROUTE_1])
    testRouteMock.mockResolvedValueOnce({ ok: true, latencyMs: 110, sampleVideoId: 'vid-abc12345', probeJobId: 'probe-1' })
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi')))
    const btn = await waitFor(() => screen.getByTestId('crawler-route-test-线路1') as HTMLButtonElement)
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    await waitFor(() => {
      expect(testRouteMock).toHaveBeenCalledWith('jszyapi', '线路1')
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '测试通过' }),
      )
    })
  })

  it('39. reprobe 按钮：click → reprobeRoute + 成功 toast', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockResolvedValueOnce([ROUTE_1])
    reprobeRouteMock.mockResolvedValueOnce({ probeJobId: 'reprobe-1', queuedCount: 5 })
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi')))
    const btn = await waitFor(() => screen.getByTestId('crawler-route-reprobe-线路1'))
    fireEvent.click(btn)
    await waitFor(() => {
      expect(reprobeRouteMock).toHaveBeenCalledWith('jszyapi', '线路1')
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已发起重新探测' }),
      )
    })
  })

  it('40+41. CW1-A 撤回线路删除入口：crawler-route-delete-* testid 不再渲染', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockResolvedValueOnce([ROUTE_1])
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi')))
    // 行展开 + route 渲染后断言 delete 按钮缺失（test/reprobe 仍存在）
    await waitFor(() => screen.getByTestId('crawler-route-test-线路1'))
    expect(screen.queryByTestId('crawler-route-delete-线路1')).toBeNull()
    expect(screen.getByTestId('crawler-route-reprobe-线路1')).not.toBeNull()
  })

  it('42. reprobe 失败 STATE_CONFLICT → 冻结 toast', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockResolvedValueOnce([ROUTE_1])
    // 用 mock 模块同款 ApiClientError class，instanceof 才能命中
    reprobeRouteMock.mockRejectedValueOnce(new ApiClientError('STATE_CONFLICT', '采集已冻结', 409))
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi')))
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-route-reprobe-线路1')))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'danger', title: '采集已冻结' }),
      )
    })
  })
})

// REDO-01-G tests appended below after extending top-level vi.mock

describe('CrawlerClient (REDO-01-G 高级 dropdown)', () => {
  it('43. 高级 trigger 渲染（PageHeader 第 4 槽位）', async () => {
    render(<CrawlerClient />)
    const trigger = await waitFor(() => screen.getByTestId('crawler-advanced-trigger'))
    expect(trigger.textContent).toContain('高级')
  })

  it('44. 点击 trigger 展开 dropdown → 4 项渲染（CW1-A 4 字命名：定时设置/重建索引/一键停采/关闭采集）', async () => {
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-advanced-trigger')))
    await waitFor(() => {
      expect(screen.getByText('定时设置')).not.toBeNull()
      expect(screen.getByText('重建索引')).not.toBeNull()
      expect(screen.getByText('一键停采')).not.toBeNull()
      // SYSTEM_STATUS 默认 freezeEnabled=undefined → false → 显示"关闭采集"（点击会开启 freeze == 关闭采集）
      expect(screen.getByText('关闭采集')).not.toBeNull()
    })
  })

  it('45. frozen=true → 显示"开启采集"动态 label（CW1-A 命名反转）', async () => {
    getCrawlerSystemStatusMock.mockResolvedValue({ freezeEnabled: true })
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-advanced-trigger')))
    await waitFor(() => {
      // freeze=true (采集已关闭) → 点击会解除 freeze == 开启采集
      expect(screen.getByText('开启采集')).not.toBeNull()
    })
  })

  it('46. 冻结切换：关闭采集 confirm 通过 → setCrawlerFreeze(true) + success toast', async () => {
    setCrawlerFreezeMock.mockResolvedValueOnce({ freezeEnabled: true, orphanTaskCount: 2 })
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-advanced-trigger')))
    fireEvent.click(await waitFor(() => screen.getByText('关闭采集')))
    await waitFor(() => {
      expect(setCrawlerFreezeMock).toHaveBeenCalledWith(true)
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已开启全局冻结' }),
      )
    })
  })

  it('47. 一键停采：双重 confirm 通过 → stopAllCrawler + status 合并 freezeEnabled=true', async () => {
    stopAllCrawlerMock.mockResolvedValueOnce({
      freezeEnabled: true, markedRuns: 2, pendingCancelled: 5, runningSignaled: 3,
    })
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-advanced-trigger')))
    fireEvent.click(await waitFor(() => screen.getByText('一键停采')))
    await waitFor(() => {
      expect(stopAllCrawlerMock).toHaveBeenCalledWith({ freeze: true, removeRepeatableTick: true })
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '全局止血完成' }),
      )
    })
  })

  it('48. 重建索引：双重 confirm 通过 → triggerReindex + success toast', async () => {
    triggerReindexMock.mockResolvedValueOnce({ indexed: 1234, duration_ms: 5000 })
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-advanced-trigger')))
    fireEvent.click(await waitFor(() => screen.getByText('重建索引')))
    await waitFor(() => {
      expect(triggerReindexMock).toHaveBeenCalledOnce()
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: 'ES 索引已重建' }),
      )
    })
  })

  it('49. 定时设置：点击 → SchedulerConfigDrawer 渲染（drawer 打开）', async () => {
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-advanced-trigger')))
    fireEvent.click(await waitFor(() => screen.getByText('定时设置')))
    await waitFor(() => {
      // 项点击后 dropdown 应关闭
      expect(screen.queryByText('一键停采')).toBeNull()
    })
  })

  it('50. confirm 拒绝（关闭采集）→ 不调 API', async () => {
    confirmSpy.mockReset().mockReturnValue(false)
    ;(globalThis as unknown as { confirm: typeof confirmSpy }).confirm = confirmSpy
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-advanced-trigger')))
    fireEvent.click(await waitFor(() => screen.getByText('关闭采集')))
    await new Promise((r) => setTimeout(r, 0))
    expect(setCrawlerFreezeMock).not.toHaveBeenCalled()
  })
})

describe('CrawlerClient — CSV-EXPORT bug fixes (CHG-SN-7-MISC-CRAWLER-TIMELINE-BUG / COLUMN-FEATURES)', () => {
  it('51. 时间轴 rangeStart/rangeEnd + ticks 使用本地时区 HH:MM（非 UTC slice）', async () => {
    // TIMELINE_LIVE rangeStart='2026-05-18T22:00:00Z' (UTC) → 本地时区不同就会与 "22:00" 不一致
    // 直接断言：subtitle/tick 中出现的小时与 new Date('...Z').getHours() 对齐（vs 直接 UTC slice 22）
    render(<CrawlerClient />)
    await waitFor(() => screen.getByTestId('crawler-timeline-card'))
    const localStartH = new Date('2026-05-18T22:00:00Z').getHours().toString().padStart(2, '0')
    const localEndH = new Date('2026-05-18T23:00:00Z').getHours().toString().padStart(2, '0')
    const card = screen.getByTestId('crawler-timeline-card')
    // subtitle 含本地化的 HH:MM（含 :00 分钟段）
    expect(card.textContent).toContain(`${localStartH}:00`)
    expect(card.textContent).toContain(`${localEndH}:00`)
  })

  it('52. 站点列表 enableHeaderMenu + columns enableSorting → 表头 interactive + menu icon', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    const { container } = render(<CrawlerClient />)
    await waitFor(() => screen.getAllByText('极速资源'))
    // DataTable v2 enableHeaderMenu=true 时 th 含 data-th-interactive='true' + menu icon
    const interactiveTh = container.querySelectorAll('[role="columnheader"][data-th-interactive="true"]')
    expect(interactiveTh.length).toBeGreaterThan(0)
    const menuIcons = container.querySelectorAll('[data-th-menu-icon]')
    expect(menuIcons.length).toBeGreaterThan(0)
  })

  it('53. 导出按钮：空 sites → warn toast "无可导出数据"（CSV-EXPORT 重测保持）', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([])
    render(<CrawlerClient />)
    const btn = await waitFor(() => screen.getByTestId('crawler-export-btn'))
    fireEvent.click(btn)
    expect(toastPushMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'warn', title: '无可导出数据' }),
    )
  })
})

describe('CrawlerClient — CW1-D ?openDrawer=scheduler 自动开 SchedulerConfigDrawer', () => {
  const CONFIG = {
    globalEnabled: true,
    scheduleType: 'daily' as const,
    dailyTime: '03:30',
    defaultMode: 'incremental' as const,
    onlyEnabledSites: false,
    conflictPolicy: 'skip_running' as const,
    perSiteOverrides: {},
  }

  it('54. URL 含 openDrawer=scheduler → 首次渲染即 SchedulerConfigDrawer open', async () => {
    mockCrawlerSearchParams.set('openDrawer', 'scheduler')
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG)
    render(<CrawlerClient />)
    await waitFor(() => {
      expect(screen.getByTestId('scheduler-config-drawer')).not.toBeNull()
    })
  })

  it('55. URL 无 openDrawer → SchedulerConfigDrawer 不渲染', async () => {
    render(<CrawlerClient />)
    await waitFor(() => screen.getByTestId('crawler-export-btn'))
    expect(screen.queryByTestId('scheduler-config-drawer')).toBeNull()
  })

  it('56. openDrawer=scheduler 触发的 Drawer 关闭 → router.replace 清掉 query param', async () => {
    mockCrawlerSearchParams.set('openDrawer', 'scheduler')
    getAutoCrawlConfigMock.mockResolvedValueOnce(CONFIG)
    render(<CrawlerClient />)
    const cancelBtn = await waitFor(() => screen.getByTestId('scheduler-cancel'))
    fireEvent.click(cancelBtn)
    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith('/admin/crawler')
    })
  })

  // ── ADR-155 D-155-5 EP-1B2-LAYOUT：概览容器可折叠 ──────────────
  it('57. EP-1B2-LAYOUT: 默认概览展开 → SummaryCard + KpiRow + Timeline 全渲染', async () => {
    render(<CrawlerClient />)
    await waitFor(() => screen.getByTestId('crawler-export-btn'))
    // toggle 按钮可见且 aria-expanded=true
    const toggle = screen.getByTestId('crawler-overview-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.textContent).toMatch(/^▾\s+概览$/)
    // 展开态：3 块全渲染
    expect(screen.getByTestId('crawler-overview-body')).not.toBeNull()
    expect(screen.getByTestId('mock-auto-crawl-summary-card')).not.toBeNull()
    expect(screen.getByTestId('crawler-timeline-card')).not.toBeNull()
  })

  it('58. EP-1B2-LAYOUT: 点击 toggle → 概览折叠 / 3 块隐藏 / SiteList 仍可见', async () => {
    render(<CrawlerClient />)
    const toggle = await waitFor(() => screen.getByTestId('crawler-overview-toggle'))
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(toggle.getAttribute('aria-expanded')).toBe('false')
      expect(toggle.textContent).toMatch(/^▸\s+概览$/)
      expect(screen.queryByTestId('crawler-overview-body')).toBeNull()
      expect(screen.queryByTestId('mock-auto-crawl-summary-card')).toBeNull()
      expect(screen.queryByTestId('crawler-timeline-card')).toBeNull()
    })
    // SiteList 主操作区永驻可见（折叠态下用户仍能操作站点）
    expect(screen.getByTestId('crawler-export-btn')).not.toBeNull()
  })
})
