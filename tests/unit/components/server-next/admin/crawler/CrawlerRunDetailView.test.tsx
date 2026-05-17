/**
 * CrawlerRunDetailView.test.tsx — /admin/crawler/runs/:id 详情视图单测（CHG-SN-6-17）
 *
 * 覆盖（≥ 9）：
 *   1. 渲染基础：data-crawler-run-detail
 *   2. 加载状态 → state=loading
 *   3. run 加载失败 → state=error
 *   4. 基础信息卡：status / triggerType / siteCount
 *   5. tasks 子表：渲染（status / siteKey / mode）
 *   6. tasks 子表：status 7 类抽样（success / running / failed / timeout）
 *   7. tasks 子表：empty state
 *   8. tasks 子表：错误状态独立 ErrorState
 *   9. tasks 子表：itemCount / message 显示
 *  10. 刷新按钮：触发双重 fetch
 *  11. data-run-status / data-task-status 用于 e2e
 *  12. 默认 tasks page=1 limit=50
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getCrawlerRunByIdMock = vi.fn()
const listCrawlerRunTasksMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/crawler/api', () => ({
  getCrawlerRunById: (...args: unknown[]) => getCrawlerRunByIdMock(...args),
  listCrawlerRunTasks: (...args: unknown[]) => listCrawlerRunTasksMock(...args),
}))

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(message: string, public readonly status?: number) { super(message) }
  },
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

import { CrawlerRunDetailView } from '../../../../../../apps/server-next/src/app/admin/crawler/runs/[id]/_client/CrawlerRunDetailView'

const RUN_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

const RUN_BASE = {
  id: RUN_ID,
  triggerType: 'batch' as const,
  mode: 'incremental',
  status: 'success' as const,
  controlStatus: 'normal',
  requestedSiteCount: 5,
  enqueuedSiteCount: 4,
  skippedSiteCount: 1,
  timeoutSeconds: 600,
  createdBy: 'admin-1',
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

const TASK_SUCCESS = {
  id: '11111111-aaaa-bbbb-cccc-dddddddddddd',
  siteKey: 'site-a',
  mode: 'incremental' as const,
  status: 'success' as const,
  startedAt: new Date(Date.now() - 110_000).toISOString(),
  finishedAt: new Date(Date.now() - 90_000).toISOString(),
  message: null,
  itemCount: 42,
}

const TASK_FAILED = {
  id: '22222222-bbbb-cccc-dddd-eeeeeeeeeeee',
  siteKey: 'site-b',
  mode: 'full' as const,
  status: 'failed' as const,
  startedAt: new Date(Date.now() - 100_000).toISOString(),
  finishedAt: new Date(Date.now() - 80_000).toISOString(),
  message: '解析失败: invalid JSON',
  itemCount: null,
}

const TASK_RUNNING = {
  id: '33333333-cccc-dddd-eeee-ffffffffffff',
  siteKey: 'site-c',
  mode: 'incremental' as const,
  status: 'running' as const,
  startedAt: new Date(Date.now() - 30_000).toISOString(),
  finishedAt: null,
  message: null,
  itemCount: null,
}

const TASK_TIMEOUT = {
  id: '44444444-dddd-eeee-ffff-aaaaaaaaaaaa',
  siteKey: 'site-d',
  mode: 'full' as const,
  status: 'timeout' as const,
  startedAt: new Date(Date.now() - 200_000).toISOString(),
  finishedAt: null,
  message: '任务超时',
  itemCount: null,
}

const TASKS_RESULT = {
  data: [TASK_SUCCESS, TASK_FAILED, TASK_RUNNING, TASK_TIMEOUT],
  pagination: { total: 4, page: 1, limit: 50, hasNext: false },
}

const EMPTY_TASKS = { data: [], pagination: { total: 0, page: 1, limit: 50, hasNext: false } }

beforeEach(() => {
  getCrawlerRunByIdMock.mockReset()
  listCrawlerRunTasksMock.mockReset()
})

describe('CrawlerRunDetailView', () => {
  it('1. 渲染基础：data-crawler-run-detail', async () => {
    getCrawlerRunByIdMock.mockResolvedValueOnce(RUN_BASE)
    listCrawlerRunTasksMock.mockResolvedValueOnce(EMPTY_TASKS)
    const { container } = render(<CrawlerRunDetailView runId={RUN_ID} />)
    await waitFor(() => {
      expect(container.querySelector('[data-crawler-run-detail]')).not.toBeNull()
    })
  })

  it('2. 初次加载：state=loading', async () => {
    let resolveRun: (v: unknown) => void = () => {}
    getCrawlerRunByIdMock.mockReturnValueOnce(new Promise((resolve) => { resolveRun = resolve }))
    listCrawlerRunTasksMock.mockResolvedValue(EMPTY_TASKS)
    const { container } = render(<CrawlerRunDetailView runId={RUN_ID} />)
    expect(container.querySelector('[data-state="loading"]')).not.toBeNull()
    resolveRun(RUN_BASE)
    await waitFor(() => {
      expect(container.querySelector('[data-state="loaded"]')).not.toBeNull()
    })
  })

  it('3. run 加载失败 → state=error + ErrorState', async () => {
    getCrawlerRunByIdMock.mockRejectedValueOnce(new Error('run 500'))
    listCrawlerRunTasksMock.mockResolvedValue(EMPTY_TASKS)
    const { container } = render(<CrawlerRunDetailView runId={RUN_ID} />)
    await waitFor(() => {
      expect(container.querySelector('[data-state="error"]')).not.toBeNull()
      expect(screen.getAllByText(/批次加载失败|500/).length).toBeGreaterThan(0)
    })
  })

  it('4. 基础信息卡：状态 / 站点数 / 触发类型', async () => {
    getCrawlerRunByIdMock.mockResolvedValueOnce(RUN_BASE)
    listCrawlerRunTasksMock.mockResolvedValueOnce(EMPTY_TASKS)
    render(<CrawlerRunDetailView runId={RUN_ID} />)
    await waitFor(() => {
      expect(screen.getByTestId('run-detail-meta')).not.toBeNull()
      expect(screen.getByText('成功')).not.toBeNull()
      expect(screen.getByText(/已入队 4 \/ 请求 5 · 跳过 1/)).not.toBeNull()
      expect(screen.getByText(/触发 batch · 模式 incremental/)).not.toBeNull()
    })
  })

  it('5. tasks 子表：渲染 4 行 + status badge', async () => {
    getCrawlerRunByIdMock.mockResolvedValueOnce(RUN_BASE)
    listCrawlerRunTasksMock.mockResolvedValueOnce(TASKS_RESULT)
    const { container } = render(<CrawlerRunDetailView runId={RUN_ID} />)
    await waitFor(() => {
      expect(screen.getByTestId('run-detail-tasks-table')).not.toBeNull()
      expect(container.querySelectorAll('[data-task-status]').length).toBe(4)
    })
  })

  it('6. tasks 子表：status 4 类抽样可见', async () => {
    getCrawlerRunByIdMock.mockResolvedValueOnce(RUN_BASE)
    listCrawlerRunTasksMock.mockResolvedValueOnce(TASKS_RESULT)
    render(<CrawlerRunDetailView runId={RUN_ID} />)
    await waitFor(() => {
      // success label 同时出现在 run 基础信息和 task 行中
      expect(screen.getAllByText('成功').length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('失败')).not.toBeNull()
      expect(screen.getByText('运行中')).not.toBeNull()
      expect(screen.getByText('超时')).not.toBeNull()
    })
  })

  it('7. tasks 子表：empty state', async () => {
    getCrawlerRunByIdMock.mockResolvedValueOnce(RUN_BASE)
    listCrawlerRunTasksMock.mockResolvedValueOnce(EMPTY_TASKS)
    render(<CrawlerRunDetailView runId={RUN_ID} />)
    await waitFor(() => {
      expect(screen.getByText('暂无任务')).not.toBeNull()
    })
  })

  it('8. tasks 子表：错误状态独立 ErrorState（run 成功 + tasks 失败）', async () => {
    getCrawlerRunByIdMock.mockResolvedValueOnce(RUN_BASE)
    listCrawlerRunTasksMock.mockRejectedValueOnce(new Error('tasks 500'))
    const { container } = render(<CrawlerRunDetailView runId={RUN_ID} />)
    await waitFor(() => {
      // run 加载成功 → state=loaded
      expect(container.querySelector('[data-state="loaded"]')).not.toBeNull()
      expect(screen.getAllByText(/任务加载失败|500/).length).toBeGreaterThan(0)
    })
  })

  it('9. tasks 子表：itemCount + message 显示', async () => {
    getCrawlerRunByIdMock.mockResolvedValueOnce(RUN_BASE)
    listCrawlerRunTasksMock.mockResolvedValueOnce(TASKS_RESULT)
    const { container } = render(<CrawlerRunDetailView runId={RUN_ID} />)
    await waitFor(() => {
      expect(container.querySelector('[data-task-item-count]')?.textContent).toBe('42')
      expect(screen.getByText('解析失败: invalid JSON')).not.toBeNull()
    })
  })

  it('10. 刷新按钮：触发双重 fetch', async () => {
    getCrawlerRunByIdMock.mockResolvedValue(RUN_BASE)
    listCrawlerRunTasksMock.mockResolvedValue(EMPTY_TASKS)
    render(<CrawlerRunDetailView runId={RUN_ID} />)
    await waitFor(() => screen.getByTestId('run-detail-refresh'))
    expect(getCrawlerRunByIdMock).toHaveBeenCalledTimes(1)
    expect(listCrawlerRunTasksMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('run-detail-refresh'))
    await waitFor(() => {
      expect(getCrawlerRunByIdMock).toHaveBeenCalledTimes(2)
      expect(listCrawlerRunTasksMock).toHaveBeenCalledTimes(2)
    })
  })

  it('11. data-run-status / data-task-status 用于 e2e 选择器', async () => {
    getCrawlerRunByIdMock.mockResolvedValueOnce(RUN_BASE)
    listCrawlerRunTasksMock.mockResolvedValueOnce(TASKS_RESULT)
    const { container } = render(<CrawlerRunDetailView runId={RUN_ID} />)
    await waitFor(() => {
      expect(container.querySelector('[data-run-status="success"]')).not.toBeNull()
      expect(container.querySelector('[data-task-status="success"]')).not.toBeNull()
      expect(container.querySelector('[data-task-status="failed"]')).not.toBeNull()
      expect(container.querySelector('[data-task-status="running"]')).not.toBeNull()
      expect(container.querySelector('[data-task-status="timeout"]')).not.toBeNull()
    })
  })

  it('12. 默认 tasks page=1 limit=50 触发 API', async () => {
    getCrawlerRunByIdMock.mockResolvedValueOnce(RUN_BASE)
    listCrawlerRunTasksMock.mockResolvedValueOnce(EMPTY_TASKS)
    render(<CrawlerRunDetailView runId={RUN_ID} />)
    await waitFor(() => {
      expect(listCrawlerRunTasksMock).toHaveBeenCalledWith(RUN_ID, { page: 1, limit: 50 })
    })
  })
})
