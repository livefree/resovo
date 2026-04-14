/**
 * OrphanVideoTable.test.tsx — 孤岛视频列表组件测试（ADMIN-12）
 * 覆盖：加载/空态/列表渲染、触发补源、标记已处理、进入暂存
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OrphanVideoTable } from '@/components/admin/sources/OrphanVideoTable'

// ── Mocks ──────────────────────────────────────────────────────────

const getMock = vi.fn()
const postMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}))

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

const notifySuccess = vi.fn()
const notifyError = vi.fn()

vi.mock('@/components/admin/shared/toast/useAdminToast', () => ({
  notify: {
    success: (...args: unknown[]) => notifySuccess(...args),
    error: (...args: unknown[]) => notifyError(...args),
  },
}))

// ── 测试数据 ──────────────────────────────────────────────────────

const MOCK_ROWS = [
  {
    id: 'vid-001',
    title: '孤岛视频 A',
    siteKey: 'site-a',
    sourceCheckStatus: 'all_dead',
    lastEventOrigin: 'auto_refetch_failed',
    lastEventAt: '2026-04-10T08:00:00Z',
  },
  {
    id: 'vid-002',
    title: '孤岛视频 B',
    siteKey: null,
    sourceCheckStatus: 'all_dead',
    lastEventOrigin: 'auto_refetch_failed',
    lastEventAt: '2026-04-11T12:30:00Z',
  },
]

// ── 辅助 ─────────────────────────────────────────────────────────

function renderTable() {
  return render(<OrphanVideoTable />)
}

// ── 测试 ─────────────────────────────────────────────────────────

describe('OrphanVideoTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── 加载态 ────────────────────────────────────────────────────

  it('初始渲染时显示加载指示器', () => {
    getMock.mockReturnValue(new Promise(() => {})) // 永不 resolve
    renderTable()
    expect(screen.getByTestId('orphan-table-loading')).toBeDefined()
  })

  // ── 空态 ─────────────────────────────────────────────────────

  it('无孤岛视频时显示空态文本', async () => {
    getMock.mockResolvedValue({ data: [], total: 0 })
    renderTable()
    await waitFor(() => {
      expect(screen.getByTestId('orphan-table-empty')).toBeDefined()
    })
  })

  // ── 列表渲染 ─────────────────────────────────────────────────

  it('加载成功后渲染孤岛视频列表', async () => {
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: 2 })
    renderTable()
    await waitFor(() => {
      expect(screen.getByTestId('orphan-video-table')).toBeDefined()
    })
    expect(screen.getByText('孤岛视频 A')).toBeDefined()
    expect(screen.getByText('孤岛视频 B')).toBeDefined()
  })

  it('每行渲染三个操作按钮', async () => {
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: 2 })
    renderTable()
    await waitFor(() => {
      expect(screen.getByTestId(`orphan-refetch-${MOCK_ROWS[0].id}`)).toBeDefined()
    })
    expect(screen.getByTestId(`orphan-staging-${MOCK_ROWS[0].id}`)).toBeDefined()
    expect(screen.getByTestId(`orphan-resolve-${MOCK_ROWS[0].id}`)).toBeDefined()
  })

  it('站点为 null 时显示破折号', async () => {
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: 2 })
    renderTable()
    await waitFor(() => {
      expect(screen.getByTestId('orphan-video-table')).toBeDefined()
    })
    // vid-002 的 siteKey 为 null，应渲染 —
    expect(screen.getByText('—')).toBeDefined()
  })

  it('显示总条数文本', async () => {
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: 2 })
    renderTable()
    await waitFor(() => {
      expect(screen.getByText(/共/)).toBeDefined()
    })
    expect(screen.getByText('2')).toBeDefined()
  })

  // ── 触发补源 ─────────────────────────────────────────────────

  it('点击触发补源后调用 refetch API 并刷新列表', async () => {
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: 2 })
    postMock.mockResolvedValue({})
    renderTable()
    await waitFor(() => {
      expect(screen.getByTestId(`orphan-refetch-${MOCK_ROWS[0].id}`)).toBeDefined()
    })

    // reset getMock so we can track second call
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: 2 })
    fireEvent.click(screen.getByTestId(`orphan-refetch-${MOCK_ROWS[0].id}`))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        `/admin/videos/${MOCK_ROWS[0].id}/refetch-sources`,
        {},
      )
    })
    expect(notifySuccess).toHaveBeenCalledWith('补源采集已触发')
  })

  it('触发补源失败时显示错误通知', async () => {
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: 2 })
    postMock.mockRejectedValue(new Error('网络错误'))
    renderTable()
    await waitFor(() => {
      expect(screen.getByTestId(`orphan-refetch-${MOCK_ROWS[0].id}`)).toBeDefined()
    })

    fireEvent.click(screen.getByTestId(`orphan-refetch-${MOCK_ROWS[0].id}`))

    await waitFor(() => {
      expect(notifyError).toHaveBeenCalledWith('网络错误')
    })
  })

  // ── 标记已处理 ──────────────────────────────────────────────

  it('点击标记已处理后调用 resolve API 并从列表移除该行', async () => {
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: 2 })
    postMock.mockResolvedValue({})
    renderTable()
    await waitFor(() => {
      expect(screen.getByTestId(`orphan-resolve-${MOCK_ROWS[0].id}`)).toBeDefined()
    })

    fireEvent.click(screen.getByTestId(`orphan-resolve-${MOCK_ROWS[0].id}`))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        `/admin/sources/orphan-videos/${MOCK_ROWS[0].id}/resolve`,
        {},
      )
    })
    expect(notifySuccess).toHaveBeenCalledWith('已标记为已处理')
    // 该行应从列表移除
    await waitFor(() => {
      expect(screen.queryByTestId(`orphan-row-${MOCK_ROWS[0].id}`)).toBeNull()
    })
  })

  it('标记已处理失败时显示错误通知', async () => {
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: 2 })
    postMock.mockRejectedValue(new Error('标记失败'))
    renderTable()
    await waitFor(() => {
      expect(screen.getByTestId(`orphan-resolve-${MOCK_ROWS[0].id}`)).toBeDefined()
    })

    fireEvent.click(screen.getByTestId(`orphan-resolve-${MOCK_ROWS[0].id}`))

    await waitFor(() => {
      expect(notifyError).toHaveBeenCalledWith('标记失败')
    })
  })

  // ── 进入暂存队列 ────────────────────────────────────────────

  it('点击进入暂存后跳转到暂存队列页面', async () => {
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: 2 })
    renderTable()
    await waitFor(() => {
      expect(screen.getByTestId(`orphan-staging-${MOCK_ROWS[0].id}`)).toBeDefined()
    })

    fireEvent.click(screen.getByTestId(`orphan-staging-${MOCK_ROWS[0].id}`))

    expect(pushMock).toHaveBeenCalledWith(`/admin/staging?videoId=${MOCK_ROWS[0].id}`)
  })

  // ── 刷新按钮 ────────────────────────────────────────────────

  it('点击刷新按钮重新请求数据', async () => {
    getMock.mockResolvedValue({ data: MOCK_ROWS, total: 2 })
    renderTable()
    await waitFor(() => {
      expect(screen.getByTestId('orphan-video-table')).toBeDefined()
    })

    const callCountBefore = getMock.mock.calls.length
    fireEvent.click(screen.getByText('刷新'))

    await waitFor(() => {
      expect(getMock.mock.calls.length).toBeGreaterThan(callCountBefore)
    })
  })
})
