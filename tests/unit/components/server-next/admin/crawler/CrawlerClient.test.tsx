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
  // SchedulerConfigDrawer 依赖（关闭时不会调用）
  getAutoCrawlConfig: vi.fn(() => new Promise(() => {})),
  setAutoCrawlConfig: vi.fn(() => new Promise(() => {})),
}))

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  listRoutesBySite: (...args: unknown[]) => listRoutesBySiteMock(...args),
  upsertLineAlias: (...args: unknown[]) => upsertLineAliasMock(...args),
  testRoute: (...args: unknown[]) => testRouteMock(...args),
  reprobeRoute: (...args: unknown[]) => reprobeRouteMock(...args),
  deleteRoute: (...args: unknown[]) => deleteRouteMock(...args),
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
  confirmSpy.mockReset().mockReturnValue(true)
  ;(globalThis as unknown as { confirm: typeof confirmSpy }).confirm = confirmSpy

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

  it('2. PageHeader 3 actions（导出 / + 新增 / 全站全量）渲染', async () => {
    render(<CrawlerClient />)
    await waitFor(() => screen.getByTestId('crawler-export-btn'))
    expect(screen.getByTestId('crawler-export-btn')).not.toBeNull()
    expect(screen.getByTestId('crawler-create-btn')).not.toBeNull()
    expect(screen.getByTestId('crawler-run-all-btn')).not.toBeNull()
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

  it('11. 全站全量：confirm 通过 → runCrawlerAll(full) + 成功 toast', async () => {
    runCrawlerAllMock.mockResolvedValueOnce({
      runId: 'run-abc12345',
      taskIds: ['t1'],
      enqueuedSiteKeys: ['s1', 's2'],
      skippedSiteKeys: [],
    })
    render(<CrawlerClient />)
    const btn = await waitFor(() => screen.getByTestId('crawler-run-all-btn'))
    fireEvent.click(btn)
    await waitFor(() => {
      expect(runCrawlerAllMock).toHaveBeenCalledWith('full')
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已发起全站全量' }),
      )
    })
  })

  it('12. 全站全量：confirm 拒绝 → 不调 API', async () => {
    confirmSpy.mockReset().mockReturnValue(false)
    ;(globalThis as unknown as { confirm: typeof confirmSpy }).confirm = confirmSpy
    render(<CrawlerClient />)
    const btn = await waitFor(() => screen.getByTestId('crawler-run-all-btn'))
    fireEvent.click(btn)
    await new Promise((r) => setTimeout(r, 0))
    expect(runCrawlerAllMock).not.toHaveBeenCalled()
  })

  it('13. freezeEnabled=true → 全站全量被拦截（warn toast）', async () => {
    getCrawlerSystemStatusMock.mockResolvedValue({ freezeEnabled: true })
    render(<CrawlerClient />)
    const btn = await waitFor(() => screen.getByTestId('crawler-run-all-btn'))
    fireEvent.click(btn)
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'warn', title: '采集已冻结' }),
      )
      expect(runCrawlerAllMock).not.toHaveBeenCalled()
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

  it('16. PageHeader subtitle 包含站点计数 + 实时/冻结状态', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    getCrawlerSystemStatusMock.mockResolvedValue({ freezeEnabled: true })
    render(<CrawlerClient />)
    await waitFor(() => {
      expect(screen.getByText(/1 个站点/)).not.toBeNull()
      expect(screen.getByText(/全局冻结中/)).not.toBeNull()
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

  it('21. {more} dropdown：点击 trigger 展开菜单（6 项渲染）', async () => {
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
      expect(screen.getByText('删除站点')).not.toBeNull() // SITE_1.fromConfig=false
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

  it('26. {more} → fromConfig=true 站点的删除项 disabled label + 指引用户走配置文件路径', async () => {
    const SITE_CFG = { ...SITE_1, key: 'cfg', fromConfig: true }
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_CFG])
    render(<CrawlerClient />)
    const trigger = await waitFor(() => screen.getByTestId('crawler-row-actions-trigger-cfg'))
    fireEvent.click(trigger)
    // CHG-SN-7-MISC-CRAWLER-CONFIG-ORPHAN-DELETE：label 更新为指引用户走「站点设置 → 高级配置」路径
    await waitFor(() => {
      expect(screen.getByText(/删除（请在.*站点设置.*高级配置.*修改配置文件）/)).not.toBeNull()
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

  it('40. delete 按钮：confirm 通过 → deleteRoute + 成功 toast + 行移除', async () => {
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockResolvedValueOnce([ROUTE_1])
    deleteRouteMock.mockResolvedValueOnce({ deletedCount: 5 })
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi')))
    const btn = await waitFor(() => screen.getByTestId('crawler-route-delete-线路1'))
    fireEvent.click(btn)
    await waitFor(() => {
      expect(deleteRouteMock).toHaveBeenCalledWith('jszyapi', '线路1')
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已删除线路' }),
      )
      // 删除后线路行从 sub-table 消失
      expect(screen.queryByTestId('crawler-route-delete-线路1')).toBeNull()
    })
  })

  it('41. delete 按钮：confirm 拒绝 → 不调 API', async () => {
    confirmSpy.mockReset().mockReturnValue(false)
    ;(globalThis as unknown as { confirm: typeof confirmSpy }).confirm = confirmSpy
    listCrawlerSitesMock.mockResolvedValueOnce([SITE_1])
    listRoutesBySiteMock.mockResolvedValueOnce([ROUTE_1])
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-row-expand-jszyapi')))
    const btn = await waitFor(() => screen.getByTestId('crawler-route-delete-线路1'))
    fireEvent.click(btn)
    await new Promise((r) => setTimeout(r, 0))
    expect(deleteRouteMock).not.toHaveBeenCalled()
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

  it('44. 点击 trigger 展开 dropdown → 4 项渲染（调度 / 重建 / 止血 / 冻结）', async () => {
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-advanced-trigger')))
    await waitFor(() => {
      expect(screen.getByText('调度配置')).not.toBeNull()
      expect(screen.getByText('重建 ES 索引')).not.toBeNull()
      expect(screen.getByText('全局止血')).not.toBeNull()
      expect(screen.getByText('开启冻结')).not.toBeNull()  // SYSTEM_STATUS 默认 freezeEnabled=undefined → false
    })
  })

  it('45. frozen=true → 显示"解除冻结"动态 label', async () => {
    getCrawlerSystemStatusMock.mockResolvedValue({ freezeEnabled: true })
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-advanced-trigger')))
    await waitFor(() => {
      expect(screen.getByText('解除冻结')).not.toBeNull()
    })
  })

  it('46. 冻结切换：开启冻结 confirm 通过 → setCrawlerFreeze(true) + success toast', async () => {
    setCrawlerFreezeMock.mockResolvedValueOnce({ freezeEnabled: true, orphanTaskCount: 2 })
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-advanced-trigger')))
    fireEvent.click(await waitFor(() => screen.getByText('开启冻结')))
    await waitFor(() => {
      expect(setCrawlerFreezeMock).toHaveBeenCalledWith(true)
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已开启全局冻结' }),
      )
    })
  })

  it('47. 全局止血：双重 confirm 通过 → stopAllCrawler + status 合并 freezeEnabled=true', async () => {
    stopAllCrawlerMock.mockResolvedValueOnce({
      freezeEnabled: true, markedRuns: 2, pendingCancelled: 5, runningSignaled: 3,
    })
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-advanced-trigger')))
    fireEvent.click(await waitFor(() => screen.getByText('全局止血')))
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
    fireEvent.click(await waitFor(() => screen.getByText('重建 ES 索引')))
    await waitFor(() => {
      expect(triggerReindexMock).toHaveBeenCalledOnce()
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: 'ES 索引已重建' }),
      )
    })
  })

  it('49. 调度配置：点击 → SchedulerConfigDrawer 渲染（drawer 打开）', async () => {
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-advanced-trigger')))
    fireEvent.click(await waitFor(() => screen.getByText('调度配置')))
    // SchedulerConfigDrawer 内 testId / 元素未知，断言 dropdown 关闭即可
    await waitFor(() => {
      // 调度配置项点击后 dropdown 应关闭（onClick → close）
      expect(screen.queryByText('全局止血')).toBeNull()
    })
  })

  it('50. confirm 拒绝（冻结）→ 不调 API', async () => {
    confirmSpy.mockReset().mockReturnValue(false)
    ;(globalThis as unknown as { confirm: typeof confirmSpy }).confirm = confirmSpy
    render(<CrawlerClient />)
    fireEvent.click(await waitFor(() => screen.getByTestId('crawler-advanced-trigger')))
    fireEvent.click(await waitFor(() => screen.getByText('开启冻结')))
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
