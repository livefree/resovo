/**
 * tests/unit/components/admin/staging/StagingTable.test.tsx
 * CHG-396/397: StagingTable 筛选 UI 组件测试
 * 覆盖：readiness tab 渲染、tab 切换触发正确 API 参数、type/siteKey select
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StagingTable } from '@/components/admin/staging/StagingTable'

// ── Mocks ─────────────────────────────────────────────────────────

const getMock = vi.fn()
const postMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/components/admin/staging/StagingReadinessBadge', () => ({
  StagingReadinessBadge: () => <span>badge</span>,
  DoubanStatusBadge: () => <span>douban</span>,
  SourceHealthBadge: () => <span>health</span>,
}))

vi.mock('@/components/admin/shared/dropdown/AdminDropdown', () => ({
  AdminDropdown: () => <button type="button">操作</button>,
}))

vi.mock('@/components/admin/shared/batch/SelectionActionBar', () => ({
  SelectionActionBar: () => null,
}))

vi.mock('@/components/admin/PaginationV2', () => ({
  PaginationV2: () => null,
}))

// ── 测试数据 ───────────────────────────────────────────────────────

const MOCK_RULES = {
  minMetaScore: 40,
  requireDoubanMatched: false,
  requireCoverUrl: true,
  minActiveSourceCount: 1,
}

const MOCK_SUMMARY_WITH_SITES = {
  all: 10,
  ready: 4,
  warning: 5,
  blocked: 1,
  siteKeys: ['bilibili', 'youku'],
}

const MOCK_SUMMARY_NO_SITES = {
  ...MOCK_SUMMARY_WITH_SITES,
  siteKeys: [],
}

const MOCK_ROWS = [
  {
    id: 'vid-1',
    shortId: 'abc',
    slug: null,
    title: '测试视频',
    titleEn: null,
    coverUrl: null,
    type: 'movie',
    year: 2024,
    doubanStatus: 'matched',
    sourceCheckStatus: 'ok',
    metaScore: 80,
    activeSourceCount: 2,
    approvedAt: null,
    updatedAt: '2026-04-10T00:00:00Z',
    readiness: { ready: true, blockers: [] },
  },
]

function mockApiSuccess(summaryOverride = MOCK_SUMMARY_WITH_SITES) {
  getMock.mockResolvedValue({
    data: MOCK_ROWS,
    total: 10,
    rules: MOCK_RULES,
    summary: summaryOverride,
  })
}

// ── Tests ─────────────────────────────────────────────────────────

describe('StagingTable 筛选 UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiSuccess()
  })

  it('渲染 4 个 readiness tab（全部/就绪/警告/阻塞）', async () => {
    render(<StagingTable rules={MOCK_RULES} isAdmin={false} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    expect(screen.getByTestId('readiness-tab-all')).toBeTruthy()
    expect(screen.getByTestId('readiness-tab-ready')).toBeTruthy()
    expect(screen.getByTestId('readiness-tab-warning')).toBeTruthy()
    expect(screen.getByTestId('readiness-tab-blocked')).toBeTruthy()
  })

  it('初始请求不含 readiness 参数（全部 tab 默认）', async () => {
    render(<StagingTable rules={MOCK_RULES} isAdmin={false} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    const url = getMock.mock.calls[0]?.[0] as string
    expect(url).toContain('/admin/staging')
    expect(url).not.toContain('readiness=')
  })

  it('tab 上显示 summary 计数', async () => {
    render(<StagingTable rules={MOCK_RULES} isAdmin={false} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    expect(screen.getByTestId('readiness-tab-ready').textContent).toContain('4')
    expect(screen.getByTestId('readiness-tab-warning').textContent).toContain('5')
    expect(screen.getByTestId('readiness-tab-blocked').textContent).toContain('1')
  })

  it('点击"就绪" tab 后请求带 readiness=ready', async () => {
    render(<StagingTable rules={MOCK_RULES} isAdmin={false} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    getMock.mockClear()
    mockApiSuccess()

    fireEvent.click(screen.getByTestId('readiness-tab-ready'))

    await waitFor(() => expect(getMock).toHaveBeenCalled())
    const url = getMock.mock.calls[0]?.[0] as string
    expect(url).toContain('readiness=ready')
    expect(url).toContain('page=1')
  })

  it('点击"阻塞" tab 后请求带 readiness=blocked', async () => {
    render(<StagingTable rules={MOCK_RULES} isAdmin={false} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    getMock.mockClear()
    mockApiSuccess()

    fireEvent.click(screen.getByTestId('readiness-tab-blocked'))

    await waitFor(() => expect(getMock).toHaveBeenCalled())
    const url = getMock.mock.calls[0]?.[0] as string
    expect(url).toContain('readiness=blocked')
  })

  it('点击"全部" tab 后请求不含 readiness 参数', async () => {
    render(<StagingTable rules={MOCK_RULES} isAdmin={false} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    // 先切换到 ready
    getMock.mockClear()
    mockApiSuccess()
    fireEvent.click(screen.getByTestId('readiness-tab-ready'))
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    // 再切回全部
    getMock.mockClear()
    mockApiSuccess()
    fireEvent.click(screen.getByTestId('readiness-tab-all'))
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    const url = getMock.mock.calls[0]?.[0] as string
    expect(url).not.toContain('readiness=')
  })

  it('type select 包含所有视频类型选项', async () => {
    render(<StagingTable rules={MOCK_RULES} isAdmin={false} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    const select = screen.getByTestId('type-filter-select') as HTMLSelectElement
    const values = Array.from(select.options).map((o) => o.value)
    expect(values).toContain('')        // 全部类型
    expect(values).toContain('movie')
    expect(values).toContain('series')
    expect(values).toContain('anime')
    expect(values).toContain('documentary')
  })

  it('切换 type 筛选后请求带 type 参数', async () => {
    render(<StagingTable rules={MOCK_RULES} isAdmin={false} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    getMock.mockClear()
    mockApiSuccess()

    fireEvent.change(screen.getByTestId('type-filter-select'), { target: { value: 'movie' } })

    await waitFor(() => expect(getMock).toHaveBeenCalled())
    const url = getMock.mock.calls[0]?.[0] as string
    expect(url).toContain('type=movie')
    expect(url).toContain('page=1')
  })

  it('summary.siteKeys 非空时渲染站点 select 并含对应选项', async () => {
    render(<StagingTable rules={MOCK_RULES} isAdmin={false} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    const siteSelect = screen.getByTestId('site-key-filter-select') as HTMLSelectElement
    expect(siteSelect).toBeTruthy()
    const values = Array.from(siteSelect.options).map((o) => o.value)
    expect(values).toContain('bilibili')
    expect(values).toContain('youku')
  })

  it('summary.siteKeys 为空时不渲染站点 select', async () => {
    getMock.mockResolvedValue({
      data: [],
      total: 0,
      rules: MOCK_RULES,
      summary: MOCK_SUMMARY_NO_SITES,
    })

    render(<StagingTable rules={MOCK_RULES} isAdmin={false} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    expect(screen.queryByTestId('site-key-filter-select')).toBeNull()
  })

  it('切换站点筛选后请求带 siteKey 参数', async () => {
    render(<StagingTable rules={MOCK_RULES} isAdmin={false} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    getMock.mockClear()
    mockApiSuccess()

    fireEvent.change(screen.getByTestId('site-key-filter-select'), { target: { value: 'bilibili' } })

    await waitFor(() => expect(getMock).toHaveBeenCalled())
    const url = getMock.mock.calls[0]?.[0] as string
    expect(url).toContain('siteKey=bilibili')
    expect(url).toContain('page=1')
  })

  it('isAdmin=true 显示批量发布按钮', async () => {
    render(<StagingTable rules={MOCK_RULES} isAdmin={true} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    expect(screen.getByTestId('batch-publish-btn')).toBeTruthy()
  })

  it('isAdmin=false 不显示批量发布按钮', async () => {
    render(<StagingTable rules={MOCK_RULES} isAdmin={false} />)
    await waitFor(() => expect(getMock).toHaveBeenCalled())

    expect(screen.queryByTestId('batch-publish-btn')).toBeNull()
  })
})
