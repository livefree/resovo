/**
 * CrawlerRunsView.test.tsx — runs tab MVP 单测（CHG-SN-6-15）
 *
 * 覆盖（≥ 9）：
 *   1. 渲染基础：data-crawler-runs-view
 *   2. runs 列表加载：id 短缩 + status badge + triggerType
 *   3. status badge 7 类全覆盖（按 fixture 抽样）
 *   4. siteCount 显示（已入队 / 请求 / 跳过）
 *   5. 时间 + 耗时 cell 格式化
 *   6. status filter 切换 → 调 API 带参
 *   7. triggerType filter 切换
 *   8. 清空筛选按钮
 *   9. Empty state
 *   10. Error state
 *   11. 默认参数 page=1 limit=20
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const listCrawlerRunsMock = vi.fn()
const cancelCrawlerRunMock = vi.fn()
const pauseCrawlerRunMock = vi.fn()
const resumeCrawlerRunMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/crawler/api', () => ({
  listCrawlerRuns: (...args: unknown[]) => listCrawlerRunsMock(...args),
  cancelCrawlerRun: (...args: unknown[]) => cancelCrawlerRunMock(...args),
  pauseCrawlerRun: (...args: unknown[]) => pauseCrawlerRunMock(...args),
  resumeCrawlerRun: (...args: unknown[]) => resumeCrawlerRunMock(...args),
}))

// api-client 内部依赖 authStore（Next.js alias 在 vitest 中未解析），stub 出 ApiClientError
vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(message: string, public readonly status?: number) { super(message) }
  },
  apiClient: {
    get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn(),
  },
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

// REDO-01-H：CrawlerRunsView 已迁至 crawler/runs/_client/（独立路由 /admin/crawler/runs）
import { CrawlerRunsView } from '../../../../../../apps/server-next/src/app/admin/crawler/runs/_client/CrawlerRunsView'

const RUN_SUCCESS = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  triggerType: 'batch' as const,
  mode: 'incremental',
  status: 'success' as const,
  controlStatus: 'normal',
  requestedSiteCount: 5,
  enqueuedSiteCount: 4,
  skippedSiteCount: 1,
  timeoutSeconds: 600,
  createdBy: 'user-1',
  scheduleId: null,
  summary: null,
  startedAt: new Date(Date.now() - 120_000).toISOString(),
  finishedAt: new Date(Date.now() - 60_000).toISOString(),
  createdAt: new Date(Date.now() - 130_000).toISOString(),
  updatedAt: new Date(Date.now() - 60_000).toISOString(),
  crawlMode: 'normal',
  keyword: null,
  targetVideoId: null,
}

const RUN_FAILED = {
  ...RUN_SUCCESS,
  id: '11111111-2222-3333-4444-555555555555',
  status: 'failed' as const,
  finishedAt: null,
  startedAt: null,
}

const RUN_RUNNING = {
  ...RUN_SUCCESS,
  id: '22222222-3333-4444-5555-666666666666',
  status: 'running' as const,
  triggerType: 'all' as const,
  finishedAt: null,
}

const RUN_PAUSED = {
  ...RUN_RUNNING,
  id: '33333333-4444-5555-6666-777777777777',
  status: 'paused' as const,
}

const RESULT_3 = {
  data: [RUN_SUCCESS, RUN_FAILED, RUN_RUNNING],
  pagination: { total: 3, page: 1, limit: 20, hasNext: false },
}

const EMPTY = { data: [], pagination: { total: 0, page: 1, limit: 20, hasNext: false } }

beforeEach(() => {
  listCrawlerRunsMock.mockReset()
  cancelCrawlerRunMock.mockReset()
  pauseCrawlerRunMock.mockReset()
  resumeCrawlerRunMock.mockReset()
  toastPushMock.mockReset()
})

describe('CrawlerRunsView', () => {
  it('1. 渲染基础：data-crawler-runs-view', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce(EMPTY)
    const { container } = render(<CrawlerRunsView />)
    expect(container.querySelector('[data-crawler-runs-view]')).not.toBeNull()
  })

  it('2. runs 列表加载：id 短缩 + status badge', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce(RESULT_3)
    const { container } = render(<CrawlerRunsView />)
    await waitFor(() => {
      expect(screen.getByText('aaaaaaaa…')).not.toBeNull()
      expect(container.querySelectorAll('[data-run-status]').length).toBe(3)
    })
  })

  it('3. status badge 含成功 / 失败 / 运行中三类', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce(RESULT_3)
    render(<CrawlerRunsView />)
    await waitFor(() => {
      expect(screen.getByText('成功')).not.toBeNull()
      expect(screen.getByText('失败')).not.toBeNull()
      expect(screen.getByText('运行中')).not.toBeNull()
    })
  })

  it('4. siteCount 显示（已入队 / 请求 / 跳过）', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce(RESULT_3)
    render(<CrawlerRunsView />)
    await waitFor(() => {
      expect(screen.getAllByText(/已入队 4 \/ 请求 5/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/跳过 1/).length).toBeGreaterThan(0)
    })
  })

  it('5. 耗时 cell：startedAt null 显示 "—"', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce(RESULT_3)
    const { container } = render(<CrawlerRunsView />)
    await waitFor(() => {
      // RUN_FAILED.startedAt=null → 耗时列显示 —
      expect(container.textContent).toContain('—')
    })
  })

  it('6. status filter 切换 → 调 API 带 status 参数', async () => {
    listCrawlerRunsMock.mockResolvedValue(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => {
      expect(listCrawlerRunsMock).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      )
    })
  })

  it('7. triggerType filter / status filter 迁移到列级 ⋯（EP-5-crawler-runs / D-149-15 桥接）', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => screen.getByTestId('crawler-runs-table'))
    // toolbar.search 旧 2 select + 1 ghost button 已删（EP-5-crawler-runs）
    expect(screen.queryByTestId('crawler-runs-filters')).toBeNull()
    // 列级 ⋯ trigger 存在（status / triggerType 都可排序或可过滤 → 默认 auto 显示 ⋯）
    expect(screen.queryByTestId('th-menu-trigger-status')).not.toBeNull()
    expect(screen.queryByTestId('th-menu-trigger-triggerType')).not.toBeNull()
  })

  it('8. 清空筛选按钮：旧 toolbar ghost button 已删（迁到矩阵 popover）', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => screen.getByTestId('crawler-runs-table'))
    // 旧 toolbar.search 内 "清空筛选" ghost button 已删
    expect(screen.queryByTestId('crawler-runs-filter-clear')).toBeNull()
    // 新路径：清空走 toolbar 矩阵触发器 → matrix popover "清除全部过滤" button
    expect(screen.queryByTestId('matrix-trigger')).not.toBeNull()
  })

  it('9. Empty state 渲染', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => {
      expect(screen.getByText('暂无 runs')).not.toBeNull()
    })
  })

  it('10. Error state：fetch 失败 → ErrorState', async () => {
    listCrawlerRunsMock.mockRejectedValueOnce(new Error('runs 500'))
    render(<CrawlerRunsView />)
    await waitFor(() => {
      expect(screen.getAllByText(/加载失败|500/).length).toBeGreaterThan(0)
    })
  })

  it('11. 默认参数 page=1 limit=20 触发 API', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => {
      expect(listCrawlerRunsMock).toHaveBeenCalled()
      const call = listCrawlerRunsMock.mock.calls[0]?.[0] as { page: number; limit: number }
      expect(call.page).toBe(1)
      expect(call.limit).toBe(20)
    })
  })

  it('12. data-run-status attribute 用于 e2e 选择器', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce(RESULT_3)
    const { container } = render(<CrawlerRunsView />)
    await waitFor(() => {
      expect(container.querySelector('[data-run-status="success"]')).not.toBeNull()
      expect(container.querySelector('[data-run-status="failed"]')).not.toBeNull()
      expect(container.querySelector('[data-run-status="running"]')).not.toBeNull()
    })
  })

  // ── 行操作（CHG-SN-6-16-B）─────────────────────────────────────

  it('13. running 行渲染 pause + cancel 按钮，无 resume', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce({
      data: [RUN_RUNNING], pagination: { total: 1, page: 1, limit: 20, hasNext: false },
    })
    render(<CrawlerRunsView />)
    await waitFor(() => {
      expect(screen.getByTestId(`run-pause-${RUN_RUNNING.id}`)).not.toBeNull()
      expect(screen.getByTestId(`run-cancel-${RUN_RUNNING.id}`)).not.toBeNull()
      expect(screen.queryByTestId(`run-resume-${RUN_RUNNING.id}`)).toBeNull()
    })
  })

  it('14. paused 行渲染 resume + cancel，无 pause', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce({
      data: [RUN_PAUSED], pagination: { total: 1, page: 1, limit: 20, hasNext: false },
    })
    render(<CrawlerRunsView />)
    await waitFor(() => {
      expect(screen.getByTestId(`run-resume-${RUN_PAUSED.id}`)).not.toBeNull()
      expect(screen.getByTestId(`run-cancel-${RUN_PAUSED.id}`)).not.toBeNull()
      expect(screen.queryByTestId(`run-pause-${RUN_PAUSED.id}`)).toBeNull()
    })
  })

  it('15. success 行不显示任何操作按钮', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce({
      data: [RUN_SUCCESS], pagination: { total: 1, page: 1, limit: 20, hasNext: false },
    })
    render(<CrawlerRunsView />)
    await waitFor(() => {
      expect(screen.queryByTestId(`run-cancel-${RUN_SUCCESS.id}`)).toBeNull()
      expect(screen.queryByTestId(`run-pause-${RUN_SUCCESS.id}`)).toBeNull()
      expect(screen.queryByTestId(`run-resume-${RUN_SUCCESS.id}`)).toBeNull()
    })
  })

  it('16. cancel 按钮：confirm 通过 → 调 API + 成功 toast', async () => {
    listCrawlerRunsMock.mockResolvedValue({
      data: [RUN_RUNNING], pagination: { total: 1, page: 1, limit: 20, hasNext: false },
    })
    cancelCrawlerRunMock.mockResolvedValueOnce({ run: null, cancelledPending: 3, signaledRunning: 2 })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    try {
      render(<CrawlerRunsView />)
      const btn = await waitFor(() => screen.getByTestId(`run-cancel-${RUN_RUNNING.id}`))
      fireEvent.click(btn)
      await waitFor(() => {
        expect(cancelCrawlerRunMock).toHaveBeenCalledWith(RUN_RUNNING.id)
        expect(toastPushMock).toHaveBeenCalledWith(
          expect.objectContaining({ level: 'success', title: '已请求取消' }),
        )
      })
    } finally {
      confirmSpy.mockRestore()
    }
  })

  it('17. cancel 按钮：confirm 取消 → 不调 API', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce({
      data: [RUN_RUNNING], pagination: { total: 1, page: 1, limit: 20, hasNext: false },
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    try {
      render(<CrawlerRunsView />)
      const btn = await waitFor(() => screen.getByTestId(`run-cancel-${RUN_RUNNING.id}`))
      fireEvent.click(btn)
      // 等一个 microtask 让 handler 退出
      await new Promise((r) => setTimeout(r, 0))
      expect(cancelCrawlerRunMock).not.toHaveBeenCalled()
    } finally {
      confirmSpy.mockRestore()
    }
  })

  it('18. pause 按钮：调 API + 成功 toast', async () => {
    listCrawlerRunsMock.mockResolvedValue({
      data: [RUN_RUNNING], pagination: { total: 1, page: 1, limit: 20, hasNext: false },
    })
    pauseCrawlerRunMock.mockResolvedValueOnce({ runId: RUN_RUNNING.id, controlStatus: 'pausing' })
    render(<CrawlerRunsView />)
    const btn = await waitFor(() => screen.getByTestId(`run-pause-${RUN_RUNNING.id}`))
    fireEvent.click(btn)
    await waitFor(() => {
      expect(pauseCrawlerRunMock).toHaveBeenCalledWith(RUN_RUNNING.id)
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已暂停' }),
      )
    })
  })

  it('19. resume 按钮：调 API + 成功 toast', async () => {
    listCrawlerRunsMock.mockResolvedValue({
      data: [RUN_PAUSED], pagination: { total: 1, page: 1, limit: 20, hasNext: false },
    })
    resumeCrawlerRunMock.mockResolvedValueOnce({ runId: RUN_PAUSED.id, controlStatus: 'active' })
    render(<CrawlerRunsView />)
    const btn = await waitFor(() => screen.getByTestId(`run-resume-${RUN_PAUSED.id}`))
    fireEvent.click(btn)
    await waitFor(() => {
      expect(resumeCrawlerRunMock).toHaveBeenCalledWith(RUN_PAUSED.id)
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已恢复' }),
      )
    })
  })

  it('20. cancel 失败：toast danger', async () => {
    listCrawlerRunsMock.mockResolvedValue({
      data: [RUN_RUNNING], pagination: { total: 1, page: 1, limit: 20, hasNext: false },
    })
    cancelCrawlerRunMock.mockRejectedValueOnce(new Error('500 cancel'))
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    try {
      render(<CrawlerRunsView />)
      const btn = await waitFor(() => screen.getByTestId(`run-cancel-${RUN_RUNNING.id}`))
      fireEvent.click(btn)
      await waitFor(() => {
        expect(toastPushMock).toHaveBeenCalledWith(
          expect.objectContaining({ level: 'danger', title: '取消失败' }),
        )
      })
    } finally {
      confirmSpy.mockRestore()
    }
  })

  // ── EP-3-A sub 1 / ADR-150 阶段 4：D-149-15 桥接 → D-150 列固有自动过滤 ────

  it('21. ADR-150: status 列 ⋯ → DataTableAutoFilter popover (Google Sheets 三段布局)', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => screen.getByTestId('crawler-runs-table'))
    fireEvent.click(screen.getByTestId('th-menu-trigger-status'))
    expect(screen.queryByTestId('dt-autofilter-status')).not.toBeNull()
    expect(screen.queryByTestId('dt-autofilter-status-apply')).not.toBeNull()
  })

  it('22. ADR-150: triggerType 列 ⋯ → DataTableAutoFilter popover', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => screen.getByTestId('crawler-runs-table'))
    fireEvent.click(screen.getByTestId('th-menu-trigger-triggerType'))
    expect(screen.queryByTestId('dt-autofilter-triggerType')).not.toBeNull()
  })

  it('23. ADR-150: 勾选 "运行中" → 应用按钮 → fetch 带 status: [running] + setPage(1)', async () => {
    listCrawlerRunsMock.mockResolvedValue(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => screen.getByTestId('crawler-runs-table'))
    fireEvent.click(screen.getByTestId('th-menu-trigger-status'))
    fireEvent.click(screen.getByTestId('dt-autofilter-status-opt-running'))
    fireEvent.click(screen.getByTestId('dt-autofilter-status-apply'))
    await waitFor(() => {
      expect(listCrawlerRunsMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: ['running'], page: 1 }),
      )
    })
  })

  it('24. ADR-150: 矩阵 popover 含 status / triggerType 过滤格 + 未过滤时 switch aria-checked=false', async () => {
    listCrawlerRunsMock.mockResolvedValueOnce(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => screen.getByTestId('crawler-runs-table'))
    fireEvent.click(screen.getByTestId('matrix-trigger'))
    expect(screen.queryByTestId('matrix-filter-status')).not.toBeNull()
    expect(screen.queryByTestId('matrix-filter-triggerType')).not.toBeNull()
    expect(screen.getByTestId('matrix-filter-status').getAttribute('aria-checked')).toBe('false')
  })

  it('25. ADR-150: 应用 status filter 后 矩阵清除全部 → fetch 不再带 status', async () => {
    listCrawlerRunsMock.mockResolvedValue(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => screen.getByTestId('crawler-runs-table'))
    fireEvent.click(screen.getByTestId('th-menu-trigger-status'))
    fireEvent.click(screen.getByTestId('dt-autofilter-status-opt-running'))
    fireEvent.click(screen.getByTestId('dt-autofilter-status-apply'))
    await waitFor(() => {
      expect(listCrawlerRunsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: ['running'] }),
      )
    })
    fireEvent.click(screen.getByTestId('matrix-trigger'))
    fireEvent.click(screen.getByTestId('matrix-foot-clear-filters'))
    await waitFor(() => {
      const lastCall = listCrawlerRunsMock.mock.calls[listCrawlerRunsMock.mock.calls.length - 1]
      expect(lastCall[0]).not.toHaveProperty('status')
    })
  })

  // ── sub1-EXTEND（2026-05-24）：3 列 filterable 补齐 + fetch 派生新增 5 参数 ────

  it('26. sub1-EXTEND: id 列 text filter → fetch 带 idPrefix（lowercased / 前缀匹配）', async () => {
    listCrawlerRunsMock.mockResolvedValue(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => screen.getByTestId('crawler-runs-table'))
    fireEvent.click(screen.getByTestId('th-menu-trigger-id'))
    expect(screen.queryByTestId('dt-autofilter-id')).not.toBeNull()
    fireEvent.change(screen.getByTestId('dt-autofilter-id-text-input'), { target: { value: 'abc12345' } })
    fireEvent.click(screen.getByTestId('dt-autofilter-id-apply'))
    await waitFor(() => {
      expect(listCrawlerRunsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ idPrefix: 'abc12345', page: 1 }),
      )
    })
  })

  it('27. sub1-EXTEND: siteCount 列 number range filter → fetch 带 siteCountMin/Max', async () => {
    listCrawlerRunsMock.mockResolvedValue(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => screen.getByTestId('crawler-runs-table'))
    fireEvent.click(screen.getByTestId('th-menu-trigger-siteCount'))
    expect(screen.queryByTestId('dt-autofilter-siteCount')).not.toBeNull()
    fireEvent.change(screen.getByTestId('dt-autofilter-siteCount-number-min'), { target: { value: '5' } })
    fireEvent.change(screen.getByTestId('dt-autofilter-siteCount-number-max'), { target: { value: '100' } })
    fireEvent.click(screen.getByTestId('dt-autofilter-siteCount-apply'))
    await waitFor(() => {
      expect(listCrawlerRunsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ siteCountMin: 5, siteCountMax: 100, page: 1 }),
      )
    })
  })

  it('28. sub1-EXTEND: createdAt 列 date-range filter → fetch 带 createdAtFrom/To', async () => {
    listCrawlerRunsMock.mockResolvedValue(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => screen.getByTestId('crawler-runs-table'))
    fireEvent.click(screen.getByTestId('th-menu-trigger-createdAt'))
    expect(screen.queryByTestId('dt-autofilter-createdAt')).not.toBeNull()
    fireEvent.change(screen.getByTestId('dt-autofilter-createdAt-date-from'), { target: { value: '2026-05-01' } })
    fireEvent.change(screen.getByTestId('dt-autofilter-createdAt-date-to'), { target: { value: '2026-05-24' } })
    fireEvent.click(screen.getByTestId('dt-autofilter-createdAt-apply'))
    await waitFor(() => {
      expect(listCrawlerRunsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ createdAtFrom: '2026-05-01', createdAtTo: '2026-05-24', page: 1 }),
      )
    })
  })

  // sub 2 EXTEND（2026-05-24）：sort 全栈打通 / createdAt 列 enableSorting → 升序点击 → fetch 透传
  it('29. sub2-EXTEND: createdAt 列点击 ⋯ 升序 → fetch 带 sortField=createdAt + sortDirection=asc', async () => {
    listCrawlerRunsMock.mockResolvedValue(EMPTY)
    render(<CrawlerRunsView />)
    await waitFor(() => screen.getByTestId('crawler-runs-table'))
    fireEvent.click(screen.getByTestId('th-menu-trigger-createdAt'))
    expect(screen.queryByTestId('dt-autofilter-createdAt')).not.toBeNull()
    // 排序段始终渲染 / createdAt enableSorting=true → 升序按钮非 disabled
    fireEvent.click(screen.getByTestId('dt-autofilter-createdAt-sort-asc'))
    await waitFor(() => {
      expect(listCrawlerRunsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortField: 'createdAt', sortDirection: 'asc' }),
      )
    })
  })
})
