/**
 * TaskLogsDrawer.test.tsx — task 详情 + 日志 Drawer 单测（CHG-SN-6-18）
 *
 * 覆盖（≥ 9）：
 *   1. 关闭时 → 不渲染 / 不调 API
 *   2. 打开时 → 渲染 + 调 2 个 API
 *   3. 详情加载中 → LoadingState
 *   4. 详情错误 → ErrorState
 *   5. 详情卡：site/mode/status/itemCount + 站点细分 + 错误消息
 *   6. 详情卡：runContext（crawlMode/keyword/targetVideoId）
 *   7. 日志列表渲染：3 级 level + message + 时间
 *   8. 日志空 → EmptyState
 *   9. 日志错误 → 局部 ErrorState
 *  10. 日志 details 折叠 details/summary
 *  11. data-log-level / data-task-status 用于 e2e
 *  12. 刷新按钮 → 重新调 2 个 API
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getCrawlerTaskDetailMock = vi.fn()
const listCrawlerTaskLogsMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/crawler/api', () => ({
  getCrawlerTaskDetail: (...args: unknown[]) => getCrawlerTaskDetailMock(...args),
  listCrawlerTaskLogs: (...args: unknown[]) => listCrawlerTaskLogsMock(...args),
}))

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(message: string, public readonly status?: number) { super(message) }
  },
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

import { TaskLogsDrawer } from '../../../../../../apps/server-next/src/app/admin/crawler/runs/[id]/_client/TaskLogsDrawer'

const TASK_ID = '11111111-aaaa-bbbb-cccc-dddddddddddd'

const DETAIL_FAILED = {
  id: TASK_ID,
  siteKey: 'site-a',
  mode: 'incremental' as const,
  status: 'failed' as const,
  startedAt: new Date(Date.now() - 100_000).toISOString(),
  finishedAt: new Date(Date.now() - 80_000).toISOString(),
  message: '解析失败: invalid JSON',
  itemCount: null,
  siteBreakdown: {
    siteKey: 'site-a',
    videosUpserted: 3,
    sourcesUpserted: 5,
    sourcesKept: 2,
    sourcesRemoved: 1,
    errors: 4,
  },
  runContext: {
    crawlMode: 'normal',
    keyword: 'keyword-x',
    targetVideoId: 'video-y',
  },
}

const DETAIL_SUCCESS_NO_CTX = {
  ...DETAIL_FAILED,
  status: 'success' as const,
  message: null,
  itemCount: 42,
  siteBreakdown: {
    siteKey: 'site-a',
    videosUpserted: 10,
    sourcesUpserted: 20,
    sourcesKept: 5,
    sourcesRemoved: 0,
    errors: 0,
  },
  runContext: null,
}

const LOG_INFO = {
  id: 'log-1',
  taskId: TASK_ID,
  sourceSite: 'site-a',
  level: 'info' as const,
  stage: 'start',
  message: 'task started',
  details: null,
  createdAt: new Date(Date.now() - 95_000).toISOString(),
}

const LOG_WARN = {
  id: 'log-2',
  taskId: TASK_ID,
  sourceSite: 'site-a',
  level: 'warn' as const,
  stage: 'fetch',
  message: 'slow response',
  details: { latencyMs: 5000 },
  createdAt: new Date(Date.now() - 85_000).toISOString(),
}

const LOG_ERROR = {
  id: 'log-3',
  taskId: TASK_ID,
  sourceSite: 'site-a',
  level: 'error' as const,
  stage: 'parse',
  message: 'invalid JSON',
  details: { excerpt: '{"foo"' },
  createdAt: new Date(Date.now() - 80_000).toISOString(),
}

beforeEach(() => {
  getCrawlerTaskDetailMock.mockReset()
  listCrawlerTaskLogsMock.mockReset()
})

describe('TaskLogsDrawer', () => {
  it('1. 关闭时 → 不调 API', () => {
    render(<TaskLogsDrawer open={false} taskId={TASK_ID} onClose={() => {}} />)
    expect(getCrawlerTaskDetailMock).not.toHaveBeenCalled()
    expect(listCrawlerTaskLogsMock).not.toHaveBeenCalled()
  })

  it('2. 打开时 → 调 2 个 API（detail + logs）', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => {
      expect(getCrawlerTaskDetailMock).toHaveBeenCalledWith(TASK_ID)
      expect(listCrawlerTaskLogsMock).toHaveBeenCalledWith(TASK_ID, { limit: 200 })
    })
  })

  it('3. 详情加载中 → LoadingState 占位', () => {
    let _resolve: (v: unknown) => void = () => {}
    getCrawlerTaskDetailMock.mockReturnValueOnce(new Promise((r) => { _resolve = r }))
    listCrawlerTaskLogsMock.mockResolvedValue([])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    expect(document.querySelector('[data-task-detail-card]')).toBeNull()
    void _resolve
  })

  it('4. 详情错误 → ErrorState 渲染', async () => {
    getCrawlerTaskDetailMock.mockRejectedValueOnce(new Error('detail 500'))
    listCrawlerTaskLogsMock.mockResolvedValueOnce([])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getAllByText(/详情加载失败|500/).length).toBeGreaterThan(0)
    })
  })

  it('5. 详情卡：基础信息 + 站点细分 + 错误消息', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_FAILED)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('task-detail-card')).not.toBeNull()
      expect(screen.getByText('增量')).not.toBeNull()
      expect(document.querySelector('[data-task-site-breakdown]')).not.toBeNull()
      expect(document.querySelector('[data-task-error-message]')?.textContent).toContain('invalid JSON')
    })
  })

  it('6. 详情卡：runContext crawlMode/keyword/targetVideoId', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_FAILED)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => {
      expect(document.querySelector('[data-task-run-context]')).not.toBeNull()
      expect(screen.getByText('keyword-x')).not.toBeNull()
      expect(screen.getByText('video-y')).not.toBeNull()
    })
  })

  it('7. 日志列表：3 级 level + message + 标题计数', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([LOG_INFO, LOG_WARN, LOG_ERROR])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('task-logs-list')).not.toBeNull()
      expect(document.querySelector('[data-log-level="info"]')).not.toBeNull()
      expect(document.querySelector('[data-log-level="warn"]')).not.toBeNull()
      expect(document.querySelector('[data-log-level="error"]')).not.toBeNull()
      expect(screen.getByText('task started')).not.toBeNull()
      expect(screen.getByText('slow response')).not.toBeNull()
      expect(screen.getByText('invalid JSON')).not.toBeNull()
      expect(screen.getByText('日志（3）')).not.toBeNull()
    })
  })

  it('8. 日志空 → EmptyState', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText('暂无日志')).not.toBeNull()
    })
  })

  it('9. 日志错误 → 局部 ErrorState（不影响详情卡）', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockRejectedValueOnce(new Error('logs 500'))
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('task-detail-card')).not.toBeNull()
      expect(screen.getAllByText(/日志加载失败|500/).length).toBeGreaterThan(0)
    })
  })

  it('10. 日志 details 折叠：data-log-details 存在 + 含 pre', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([LOG_WARN])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => {
      const details = document.querySelector('[data-log-details]')
      expect(details).not.toBeNull()
      expect(details?.tagName.toLowerCase()).toBe('details')
      expect(document.querySelector('pre')?.textContent).toContain('latencyMs')
    })
  })

  it('11. data-task-status / data-log-level 用于 e2e 选择器', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_FAILED)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([LOG_INFO])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => {
      expect(document.querySelector('[data-task-status="failed"]')).not.toBeNull()
      expect(document.querySelector('[data-log-level="info"]')).not.toBeNull()
    })
  })

  it('12. 刷新按钮 → 重新调 2 个 API', async () => {
    getCrawlerTaskDetailMock.mockResolvedValue(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValue([])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => screen.getByTestId('task-detail-refresh'))
    expect(getCrawlerTaskDetailMock).toHaveBeenCalledTimes(1)
    expect(listCrawlerTaskLogsMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('task-detail-refresh'))
    await waitFor(() => {
      expect(getCrawlerTaskDetailMock).toHaveBeenCalledTimes(2)
      expect(listCrawlerTaskLogsMock).toHaveBeenCalledTimes(2)
    })
  })
})
