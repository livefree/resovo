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

  // ── 客户端过滤（CHG-SN-6-19）─────────────────────────────────

  it('13. filter toolbar：3 个 level chip + stage 搜索框', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([LOG_INFO, LOG_WARN, LOG_ERROR])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('task-logs-filters')).not.toBeNull()
      expect(screen.getByTestId('task-logs-level-info')).not.toBeNull()
      expect(screen.getByTestId('task-logs-level-warn')).not.toBeNull()
      expect(screen.getByTestId('task-logs-level-error')).not.toBeNull()
      expect(screen.getByTestId('task-logs-stage-search')).not.toBeNull()
    })
  })

  it('14. level chip 计数：3 级各显示 1', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([LOG_INFO, LOG_WARN, LOG_ERROR])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => {
      const info = screen.getByTestId('task-logs-level-info')
      const warn = screen.getByTestId('task-logs-level-warn')
      const error = screen.getByTestId('task-logs-level-error')
      expect(info.textContent).toContain('1')
      expect(warn.textContent).toContain('1')
      expect(error.textContent).toContain('1')
    })
  })

  it('15. 点击 level chip → toggle 隐藏对应级别 + 标题显示分子/分母', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([LOG_INFO, LOG_WARN, LOG_ERROR])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    const infoChip = await waitFor(() => screen.getByTestId('task-logs-level-info'))
    fireEvent.click(infoChip)
    await waitFor(() => {
      // info hidden
      expect(infoChip.getAttribute('data-active')).toBe('false')
      // info 行消失
      expect(document.querySelector('[data-log-level="info"]')).toBeNull()
      // 标题显示 2 / 3
      expect(screen.getByText('日志（2 / 3）')).not.toBeNull()
    })
  })

  it('16. stage 搜索 → 仅显示匹配 stage 的日志', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([LOG_INFO, LOG_WARN, LOG_ERROR])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    const wrapper = await waitFor(() => screen.getByTestId('task-logs-stage-search'))
    const search = wrapper.querySelector('input') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'parse' } })
    await waitFor(() => {
      // LOG_ERROR stage='parse'
      expect(document.querySelector('[data-log-level="error"]')).not.toBeNull()
      expect(document.querySelector('[data-log-level="info"]')).toBeNull()
      expect(document.querySelector('[data-log-level="warn"]')).toBeNull()
      expect(screen.getByText('日志（1 / 3）')).not.toBeNull()
    })
  })

  it('17. message 搜索：跨字段命中', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([LOG_INFO, LOG_WARN, LOG_ERROR])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    const wrapper = await waitFor(() => screen.getByTestId('task-logs-stage-search'))
    const search = wrapper.querySelector('input') as HTMLInputElement
    // LOG_INFO.message='task started'
    fireEvent.change(search, { target: { value: 'started' } })
    await waitFor(() => {
      expect(document.querySelector('[data-log-level="info"]')).not.toBeNull()
      expect(document.querySelector('[data-log-level="warn"]')).toBeNull()
    })
  })

  it('18. 过滤后无匹配 → "无匹配日志" + 共 n 条提示', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([LOG_INFO, LOG_WARN, LOG_ERROR])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    const wrapper = await waitFor(() => screen.getByTestId('task-logs-stage-search'))
    const search = wrapper.querySelector('input') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'no-match-xyz' } })
    await waitFor(() => {
      expect(screen.getByText('无匹配日志')).not.toBeNull()
      expect(screen.getByText(/共 3 条日志/)).not.toBeNull()
    })
  })

  it('19. 清空筛选按钮：hasActiveFilter=true 时显示，点击恢复全部', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([LOG_INFO, LOG_WARN, LOG_ERROR])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    const infoChip = await waitFor(() => screen.getByTestId('task-logs-level-info'))
    fireEvent.click(infoChip)
    const clear = await waitFor(() => screen.getByTestId('task-logs-filter-clear'))
    fireEvent.click(clear)
    await waitFor(() => {
      expect(document.querySelector('[data-log-level="info"]')).not.toBeNull()
      expect(screen.getByText('日志（3）')).not.toBeNull()
      expect(screen.queryByTestId('task-logs-filter-clear')).toBeNull()
    })
  })

  it('20. 切换 taskId → filter 重置', async () => {
    getCrawlerTaskDetailMock.mockResolvedValue(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValue([LOG_INFO, LOG_WARN])
    const { rerender } = render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    const infoChip = await waitFor(() => screen.getByTestId('task-logs-level-info'))
    fireEvent.click(infoChip)
    await waitFor(() => {
      expect(infoChip.getAttribute('data-active')).toBe('false')
    })
    // 切换 taskId
    rerender(<TaskLogsDrawer open={true} taskId="55555555-eeee-ffff-aaaa-bbbbbbbbbbbb" onClose={() => {}} />)
    await waitFor(() => {
      const nextInfoChip = screen.getByTestId('task-logs-level-info')
      expect(nextInfoChip.getAttribute('data-active')).toBe('true')
    })
  })

  // ── 导出 CSV（CHG-SN-6-21）─────────────────────────────────

  it('22. logs 非空 → 渲染"导出 CSV"按钮', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([LOG_INFO])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByTestId('task-logs-export-csv')).not.toBeNull()
    })
  })

  it('23. logs 空 → 不渲染导出按钮', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    await waitFor(() => screen.getByText('暂无日志'))
    expect(screen.queryByTestId('task-logs-export-csv')).toBeNull()
  })

  it('24. 过滤后 filteredLogs 空 → 导出按钮 disabled', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([LOG_INFO])
    render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
    const wrapper = await waitFor(() => screen.getByTestId('task-logs-stage-search'))
    const search = wrapper.querySelector('input') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'zzz-no-match' } })
    await waitFor(() => {
      const btn = screen.getByTestId('task-logs-export-csv') as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })
  })

  it('25. 点击导出按钮 → 触发下载（a.click + filename）', async () => {
    getCrawlerTaskDetailMock.mockResolvedValueOnce(DETAIL_SUCCESS_NO_CTX)
    listCrawlerTaskLogsMock.mockResolvedValueOnce([LOG_INFO, LOG_WARN])
    const clickSpy = vi.fn()
    const createObjectUrlSpy = vi.fn(() => 'blob:fake-url')
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectUrlSpy, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    const downloads: string[] = []
    const origCreate = document.createElement.bind(document)
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag) as HTMLElement
      if (tag === 'a') {
        const anchor = el as HTMLAnchorElement
        anchor.click = clickSpy
        // 用 setter spy 捕获 filename
        Object.defineProperty(anchor, 'download', {
          set(v: string) { downloads.push(v) },
          configurable: true,
        })
      }
      return el
    })
    try {
      render(<TaskLogsDrawer open={true} taskId={TASK_ID} onClose={() => {}} />)
      const btn = await waitFor(() => screen.getByTestId('task-logs-export-csv'))
      fireEvent.click(btn)
      expect(clickSpy).toHaveBeenCalledOnce()
      expect(createObjectUrlSpy).toHaveBeenCalledOnce()
      const blobArg = createObjectUrlSpy.mock.calls[0]?.[0] as Blob
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toContain('text/csv')
      // filename 形如 task-11111111-logs-{ts}.csv
      expect(downloads[0]).toMatch(/^task-11111111-logs-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/)
    } finally {
      createSpy.mockRestore()
    }
  })

  it('21. 刷新按钮 → 重新调 2 个 API', async () => {
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
