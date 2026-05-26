/**
 * RunInlinePanel.test.tsx — ADR-155 D-155-1 / EP-1A
 *
 * 覆盖（4 case）：
 *   1. 独立挂载：data-run-inline-panel 渲染 + data-state 转换
 *   2. meta grid 9 字段：状态 / 控制状态 / 触发·模式 / 站点数 / 时间 / 创建者
 *   3. tasks 子表：DataTable 渲染 + status badge
 *   4. 不渲染 PageHeader（行内展开场景无外层标题）
 *
 * 完整业务行为（cancel / batch / TaskLogsDrawer / sort）在 CrawlerRunDetailView.test.tsx
 * 通过 mount CrawlerRunDetailView → RunInlinePanel 间接覆盖（避免双重测试）。
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const getCrawlerRunByIdMock = vi.fn()
const listCrawlerRunTasksMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/crawler/api', () => ({
  getCrawlerRunById: (...args: unknown[]) => getCrawlerRunByIdMock(...args),
  listCrawlerRunTasks: (...args: unknown[]) => listCrawlerRunTasksMock(...args),
  cancelCrawlerTask: vi.fn(() => new Promise(() => {})),
  batchCancelCrawlerTasks: vi.fn(() => new Promise(() => {})),
  getCrawlerTaskDetail: vi.fn(() => new Promise(() => {})),
  listCrawlerTaskLogs: vi.fn(() => new Promise(() => {})),
}))

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {
    readonly code?: string
    constructor(message: string, public readonly status?: number, code?: string) {
      super(message)
      this.code = code
    }
  },
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

import { RunInlinePanel } from '../../../../../../apps/server-next/src/app/admin/crawler/runs/[id]/_client/RunInlinePanel'

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

const TASKS_RESULT = {
  data: [TASK_SUCCESS],
  pagination: { total: 1, page: 1, limit: 50, hasNext: false },
}
const EMPTY_TASKS = { data: [], pagination: { total: 0, page: 1, limit: 50, hasNext: false } }

beforeEach(() => {
  getCrawlerRunByIdMock.mockReset()
  listCrawlerRunTasksMock.mockReset()
})

describe('RunInlinePanel (ADR-155 D-155-1 / EP-1A)', () => {
  it('1. 独立挂载 → data-run-inline-panel + data-state="loaded"', async () => {
    getCrawlerRunByIdMock.mockResolvedValueOnce(RUN_BASE)
    listCrawlerRunTasksMock.mockResolvedValueOnce(EMPTY_TASKS)
    const { container } = render(<RunInlinePanel runId={RUN_ID} />)
    await waitFor(() => {
      expect(container.querySelector('[data-run-inline-panel]')).not.toBeNull()
      expect(container.querySelector('[data-state="loaded"]')).not.toBeNull()
    })
  })

  it('2. meta grid 渲染 status / 站点数 / 触发·模式', async () => {
    getCrawlerRunByIdMock.mockResolvedValueOnce(RUN_BASE)
    listCrawlerRunTasksMock.mockResolvedValueOnce(EMPTY_TASKS)
    render(<RunInlinePanel runId={RUN_ID} />)
    await waitFor(() => {
      expect(screen.getByTestId('run-detail-meta')).not.toBeNull()
      // EP-1A 后 "触发·模式" 字段在 meta card 内（不再在 PageHeader subtitle）
      expect(screen.getByText(/触发 batch · 模式 incremental/)).not.toBeNull()
      expect(screen.getByText(/已入队 4 \/ 请求 5 · 跳过 1/)).not.toBeNull()
    })
  })

  it('3. tasks 子表渲染 + status badge', async () => {
    getCrawlerRunByIdMock.mockResolvedValueOnce(RUN_BASE)
    listCrawlerRunTasksMock.mockResolvedValueOnce(TASKS_RESULT)
    const { container } = render(<RunInlinePanel runId={RUN_ID} />)
    await waitFor(() => {
      expect(screen.getByTestId('run-detail-tasks-table')).not.toBeNull()
      expect(container.querySelectorAll('[data-task-status]').length).toBe(1)
    })
  })

  it('4. 不渲染 PageHeader（行内展开场景由外层 CrawlerRunsView 或 CrawlerRunDetailView 提供）', async () => {
    getCrawlerRunByIdMock.mockResolvedValueOnce(RUN_BASE)
    listCrawlerRunTasksMock.mockResolvedValueOnce(EMPTY_TASKS)
    const { container } = render(<RunInlinePanel runId={RUN_ID} />)
    await waitFor(() => {
      expect(container.querySelector('[data-run-inline-panel]')).not.toBeNull()
    })
    // RunInlinePanel 不应包含 PageHeader 主标题（"批次 aaaaaaaa…"）
    expect(screen.queryByText(/^批次 [a-f0-9]+…$/)).toBeNull()
  })
})
