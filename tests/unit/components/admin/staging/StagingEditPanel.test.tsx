/**
 * StagingEditPanel.test.tsx — 暂存侧滑编辑面板组件测试（ADMIN-10）
 * 覆盖：面板显示/隐藏、元数据保存、豆瓣搜索、豆瓣确认
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StagingEditPanel } from '@/components/admin/staging/StagingEditPanel'

// ── Mocks ──────────────────────────────────────────────────────────

const getMock = vi.fn()
const postMock = vi.fn()
const patchMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
  },
}))

vi.mock('@/components/admin/staging/StagingReadinessBadge', () => ({
  DoubanStatusBadge: ({ status }: { status: string }) => <span data-testid="douban-badge">{status}</span>,
  SourceHealthBadge: ({ status }: { status: string }) => <span data-testid="source-badge">{status}</span>,
}))

const notifySuccess = vi.fn()
const notifyError = vi.fn()
const notifyInfo = vi.fn()

vi.mock('@/components/admin/shared/toast/useAdminToast', () => ({
  notify: {
    success: (...args: unknown[]) => notifySuccess(...args),
    error: (...args: unknown[]) => notifyError(...args),
    info: (...args: unknown[]) => notifyInfo(...args),
  },
}))

// ── 测试数据 ───────────────────────────────────────────────────────

const MOCK_VIDEO = {
  id: 'vid-1',
  title: '测试视频',
  titleEn: null,
  type: 'movie',
  year: 2024,
  genres: ['动作', '科幻'],
  coverUrl: null,
  doubanStatus: 'pending',
  doubanSubjectId: null,
  sourceCheckStatus: 'ok',
  activeSourceCount: 2,
  metaScore: 75,
}

function mockApiSuccess() {
  getMock.mockResolvedValue({ data: [MOCK_VIDEO], total: 1 })
}

// ── Tests ──────────────────────────────────────────────────────────

describe('StagingEditPanel 面板显示', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiSuccess()
  })

  it('videoId=null 时面板平移到屏幕外（translate-x-full）', () => {
    render(
      <StagingEditPanel videoId={null} onClose={vi.fn()} onUpdated={vi.fn()} />
    )
    const panel = screen.getByTestId('staging-edit-panel')
    expect(panel.className).toContain('translate-x-full')
  })

  it('传入 videoId 时面板显示（translate-x-0）', async () => {
    render(
      <StagingEditPanel videoId="vid-1" onClose={vi.fn()} onUpdated={vi.fn()} />
    )
    const panel = screen.getByTestId('staging-edit-panel')
    expect(panel.className).toContain('translate-x-0')
  })

  it('传入 videoId 后加载视频数据并渲染标题', async () => {
    render(
      <StagingEditPanel videoId="vid-1" onClose={vi.fn()} onUpdated={vi.fn()} />
    )
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    // 标题 input 和豆瓣搜索 input 均初始化为视频标题，取第一个
    const titleInputs = screen.getAllByDisplayValue('测试视频')
    expect(titleInputs.length).toBeGreaterThan(0)
  })

  it('点击关闭按钮调用 onClose', async () => {
    const onClose = vi.fn()
    render(
      <StagingEditPanel videoId="vid-1" onClose={onClose} onUpdated={vi.fn()} />
    )
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    fireEvent.click(screen.getByTestId('staging-edit-panel-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点击遮罩调用 onClose', () => {
    const onClose = vi.fn()
    render(
      <StagingEditPanel videoId="vid-1" onClose={onClose} onUpdated={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('staging-edit-panel-overlay'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('StagingEditPanel 元数据保存', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiSuccess()
    patchMock.mockResolvedValue({ data: { id: 'vid-1', updated: true } })
  })

  it('修改标题后点击保存，调用 PATCH /admin/staging/:id/meta', async () => {
    render(
      <StagingEditPanel videoId="vid-1" onClose={vi.fn()} onUpdated={vi.fn()} />
    )
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    // 标题 input 是第一个 displayValue='测试视频' 的 input
    const titleInput = screen.getAllByDisplayValue('测试视频')[0]
    fireEvent.change(titleInput, { target: { value: '新标题' } })
    fireEvent.click(screen.getByTestId('staging-edit-save-btn'))

    await waitFor(() => expect(patchMock).toHaveBeenCalledWith(
      '/admin/staging/vid-1/meta',
      expect.objectContaining({ title: '新标题' }),
    ))
    expect(notifySuccess).toHaveBeenCalledWith('元数据已保存')
  })

  it('没有变更时点击保存调用 notify.info', async () => {
    render(
      <StagingEditPanel videoId="vid-1" onClose={vi.fn()} onUpdated={vi.fn()} />
    )
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    fireEvent.click(screen.getByTestId('staging-edit-save-btn'))

    await waitFor(() => expect(notifyInfo).toHaveBeenCalledWith('没有变更'))
    expect(patchMock).not.toHaveBeenCalled()
  })

  it('保存失败时调用 notify.error', async () => {
    patchMock.mockRejectedValue(new Error('保存错误'))
    render(
      <StagingEditPanel videoId="vid-1" onClose={vi.fn()} onUpdated={vi.fn()} />
    )
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    const titleInput = screen.getAllByDisplayValue('测试视频')[0]
    fireEvent.change(titleInput, { target: { value: '新标题' } })
    fireEvent.click(screen.getByTestId('staging-edit-save-btn'))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('保存错误'))
  })

  it('保存成功后调用 onUpdated', async () => {
    const onUpdated = vi.fn()
    render(
      <StagingEditPanel videoId="vid-1" onClose={vi.fn()} onUpdated={onUpdated} />
    )
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    const titleInput = screen.getAllByDisplayValue('测试视频')[0]
    fireEvent.change(titleInput, { target: { value: '新标题' } })
    fireEvent.click(screen.getByTestId('staging-edit-save-btn'))

    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1))
  })
})

describe('StagingEditPanel 豆瓣搜索', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiSuccess()
  })

  it('输入关键词后点击搜索，调用 POST douban-search', async () => {
    postMock.mockResolvedValue({ data: { candidates: [] } })
    render(
      <StagingEditPanel videoId="vid-1" onClose={vi.fn()} onUpdated={vi.fn()} />
    )
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    const input = screen.getByTestId('staging-douban-keyword-input')
    fireEvent.change(input, { target: { value: '测试电影' } })
    fireEvent.click(screen.getByTestId('staging-douban-search-btn'))

    await waitFor(() => expect(postMock).toHaveBeenCalledWith(
      '/admin/staging/vid-1/douban-search',
      { keyword: '测试电影' },
    ))
  })

  it('搜索返回候选列表时渲染 confirm 按钮', async () => {
    postMock.mockResolvedValue({
      data: {
        candidates: [
          { subjectId: 'db-1', title: '豆瓣电影', year: 2023, coverUrl: null, rating: 8.5, type: 'movie' },
        ],
      },
    })
    render(
      <StagingEditPanel videoId="vid-1" onClose={vi.fn()} onUpdated={vi.fn()} />
    )
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    fireEvent.click(screen.getByTestId('staging-douban-search-btn'))
    await waitFor(() => expect(screen.getByText('豆瓣电影')).toBeTruthy())
    expect(screen.getAllByText('确认').length).toBeGreaterThan(0)
  })
})

describe('StagingEditPanel 豆瓣确认', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiSuccess()
    postMock.mockImplementation((url: string) => {
      if (url.includes('douban-search')) {
        return Promise.resolve({
          data: {
            candidates: [
              { subjectId: 'db-1', title: '豆瓣电影', year: 2023, coverUrl: null, rating: 8.5, type: 'movie' },
            ],
          },
        })
      }
      if (url.includes('douban-confirm')) {
        return Promise.resolve({ data: { id: 'vid-1', confirmed: true } })
      }
      return Promise.resolve({})
    })
  })

  it('点击确认后调用 POST douban-confirm 并通知成功', async () => {
    const onUpdated = vi.fn()
    render(
      <StagingEditPanel videoId="vid-1" onClose={vi.fn()} onUpdated={onUpdated} />
    )
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    fireEvent.click(screen.getByTestId('staging-douban-search-btn'))
    await waitFor(() => expect(screen.getByText('豆瓣电影')).toBeTruthy())

    fireEvent.click(screen.getAllByText('确认')[0])
    await waitFor(() => expect(postMock).toHaveBeenCalledWith(
      '/admin/staging/vid-1/douban-confirm',
      { subjectId: 'db-1' },
    ))
    expect(notifySuccess).toHaveBeenCalledWith('豆瓣条目已确认')
    expect(onUpdated).toHaveBeenCalledTimes(1)
  })
})
