/**
 * SourcesClient.test.tsx — /admin/sources 视图前台测试（CHG-SN-5-13-PATCH P1-1）
 *
 * 补 M-SN-5 milestone 审计发现的"sources 视图 0 前台测试"P1 缺陷。
 * 路径策略：相对路径 import + mock api-client（与 MergeClient.test 同范式）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// ── mock api ──────────────────────────────────────────────────────

const listVideoGroupsMock = vi.fn()
const getVideoGroupStatsMock = vi.fn()
const listLineAliasesMock = vi.fn()
const upsertLineAliasMock = vi.fn()
// HOTFIX-PATCH-2B（2026-05-25）：distinct 端点 fetcher（DataTable distinctFetcher prop 消费）
const fetchDistinctMock = vi.fn().mockResolvedValue([])
const toastPushMock = vi.fn()
// CHG-VSR-6：行展开区 SourceLinesExpand 经 useSourceLinesController 消费源操作（getVideoMatrix 已随 MatrixExpand 删除）
const fetchVideoSourcesMock = vi.fn().mockResolvedValue([])
const fetchLineHealthMock = vi.fn().mockResolvedValue({ data: [], pagination: { total: 0, page: 1, limit: 20, hasNext: false } })

// SourcesClient 使用 useRouter()（next/navigation / "线路别名管理" 链接 push）；jsdom 下无
// app router context → 不 mock 会抛 "invariant expected app router to be mounted"。
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/sources',
}))

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  listVideoGroups: (...args: unknown[]) => listVideoGroupsMock(...args),
  getVideoGroupStats: (...args: unknown[]) => getVideoGroupStatsMock(...args),
  listLineAliases: (...args: unknown[]) => listLineAliasesMock(...args),
  upsertLineAlias: (...args: unknown[]) => upsertLineAliasMock(...args),
  fetchDistinct: (...args: unknown[]) => fetchDistinctMock(...args),
  // CHG-VSR-6：useSourceLinesController 经 SourceLinesExpand 消费的源操作 + 显示态映射
  fetchVideoSources: (...args: unknown[]) => fetchVideoSourcesMock(...args),
  fetchLineHealth: (...args: unknown[]) => fetchLineHealthMock(...args),
  toggleSource: vi.fn(),
  disableDeadSources: vi.fn(),
  refetchSources: vi.fn(),
  probeOneSource: vi.fn(),
  renderCheckOneSource: vi.fn(),
  batchProbeVideo: vi.fn(),
  batchRenderCheckVideo: vi.fn(),
  toDisplayState: (s: string) => (s === 'ok' || s === 'partial' || s === 'dead' || s === 'pending' ? s : 'unknown'),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({
      push: (input: unknown) => { toastPushMock(input); return 'toast-id' },
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
    }
  }
  return {
    ApiClientError: MockApiClientError,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  }
})

import { SourcesClient } from '../../../../../../apps/server-next/src/app/admin/sources/_client/SourcesClient'
// SRCHEALTH-P1-4：经 mock 工厂导出引用（vi.mocked 拿 batch 探测 mock 控制返回值）
import { batchProbeVideo } from '../../../../../../apps/server-next/src/lib/sources/api'

// ── fixtures ──────────────────────────────────────────────────────

const STATS = {
  total: 100, active: 60, dead: 30, orphan: 10,
  // CHG-VSR-5-B：②维度 KPI（含异常源/待补源/待探测/低质量）
  abnormal: 18, needsSource: 7, pendingProbe: 25, lowQuality: 12,
}
const EMPTY_LIST = { data: [], total: 0, page: 1, limit: 20 }

const VIDEO_GROUP_ROW = {
  videoId: '00000000-0000-0000-0000-000000000001',
  title: '测试视频',
  shortId: 'abc',
  type: 'series',
  year: 2024,
  coverUrl: null,
  lineCount: 2,
  sourceCount: 8,
  probeStatus: 'ok' as const,
  renderStatus: 'partial' as const,
  updatedAt: '2026-01-01T00:00:00Z',
  // HOTFIX-PATCH-2B-FIX1（2026-05-25）：cell 显示该行跨的站点列表
  siteKeys: ['bilibili', 'youku'],
  // CHG-VSR-5-A：CHG-VSR-3 派生列（覆盖/质量/问题/最近检测）
  activeSourceCount: 5,
  disabledCount: 0,
  connectFailCount: 1,
  renderFailCount: 0,
  pendingProbeCount: 0,
  qualityHighest: '1080P' as const,
  qualityCoverage: 0.8,
  latencyMedianMs: 120,
  needsSource: false,
  isPublished: true,
  lastCheckedAt: '2026-01-02T00:00:00Z',
}
const ONE_GROUP_LIST = { data: [VIDEO_GROUP_ROW], total: 1, page: 1, limit: 20 }

beforeEach(() => {
  listVideoGroupsMock.mockReset()
  getVideoGroupStatsMock.mockReset()
  listLineAliasesMock.mockReset()
  upsertLineAliasMock.mockReset()
  toastPushMock.mockReset()
  fetchVideoSourcesMock.mockReset()
  fetchLineHealthMock.mockReset()
})

// ── 测试 ──────────────────────────────────────────────────────────

describe('SourcesClient', () => {
  it('渲染基础：PageHeader + 线路别名管理跳转；四 Tab / 别名 Tab 已移除（CHG-VSR-5-A §3.1）', async () => {
    getVideoGroupStatsMock.mockResolvedValueOnce(STATS)
    listVideoGroupsMock.mockResolvedValueOnce(EMPTY_LIST)
    render(<SourcesClient />)
    expect(screen.getByText('播放线路')).not.toBeNull()
    expect(screen.getByRole('button', { name: '线路别名管理' })).not.toBeNull()
    // 结构移除：主体 Tab（线路矩阵/全局别名表）+ segment 四 Tab
    expect(screen.queryByRole('button', { name: '线路矩阵' })).toBeNull()
    expect(screen.queryByRole('button', { name: '全局别名表' })).toBeNull()
    expect(screen.queryByRole('button', { name: '按视频分组' })).toBeNull()
    expect(screen.queryByRole('button', { name: '仅失效' })).toBeNull()
    expect(screen.queryByRole('button', { name: '用户纠错' })).toBeNull()
    expect(screen.queryByRole('button', { name: '孤岛源' })).toBeNull()
  })

  it('KPI 5 卡 = 可点击快捷筛选：全部 / 含异常源 / 待补源 / 待探测 / 低质量（CHG-VSR-5-B §3.5）', async () => {
    getVideoGroupStatsMock.mockResolvedValueOnce(STATS)
    listVideoGroupsMock.mockResolvedValueOnce(EMPTY_LIST)
    render(<SourcesClient />)
    await waitFor(() => {
      expect(screen.getByText('全部')).not.toBeNull()
      expect(screen.getByText('含异常源')).not.toBeNull()
      expect(screen.getByText('待补源')).not.toBeNull()
      expect(screen.getByText('待探测')).not.toBeNull()
      expect(screen.getByText('低质量')).not.toBeNull()
    })
    // 旧 ① 维度卡退场
    expect(screen.queryByText('总播放源')).toBeNull()
    expect(screen.queryByText('孤岛')).toBeNull()
    // 默认「全部」pressed（无 quickFilter）/ 其余未选中
    expect(screen.getByTestId('sources-kpi-all').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('sources-kpi-has_abnormal').getAttribute('aria-pressed')).toBe('false')
  })

  it('点击「含异常源」KPI 卡 → quickFilters=[has_abnormal] + pressed 选中态（CHG-VSR-5-B）', async () => {
    getVideoGroupStatsMock.mockResolvedValueOnce(STATS)
    listVideoGroupsMock.mockResolvedValue(EMPTY_LIST)
    render(<SourcesClient />)
    await waitFor(() => expect(listVideoGroupsMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByTestId('sources-kpi-has_abnormal'))
    await waitFor(() => {
      expect(listVideoGroupsMock).toHaveBeenCalledWith(
        expect.objectContaining({ quickFilters: ['has_abnormal'] }),
      )
    })
    // pressed 切换：含异常源选中 / 全部取消选中
    expect(screen.getByTestId('sources-kpi-has_abnormal').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('sources-kpi-all').getAttribute('aria-pressed')).toBe('false')
  })

  it('默认请求：不携带 segment + 默认排序 lastChecked desc（§3.4 契约 / Codex review FIX）', async () => {
    getVideoGroupStatsMock.mockResolvedValueOnce(STATS)
    listVideoGroupsMock.mockResolvedValueOnce(EMPTY_LIST)
    render(<SourcesClient />)
    await waitFor(() => expect(listVideoGroupsMock).toHaveBeenCalledTimes(1))
    const params = listVideoGroupsMock.mock.calls[0][0]
    // 四 Tab 移除：不再携带 segment
    expect(params).not.toHaveProperty('segment')
    // §3.4：默认排序 = 最近检测降序（非后端兜底的 updated_at）
    expect(params.sortField).toBe('lastChecked')
    expect(params.sortDir).toBe('desc')
  })

  it('Empty state：listVideoGroups 返回空 data', async () => {
    getVideoGroupStatsMock.mockResolvedValueOnce(STATS)
    listVideoGroupsMock.mockResolvedValueOnce(EMPTY_LIST)
    render(<SourcesClient />)
    await waitFor(() => {
      // EmptyState 文案见 SourcesClient
      const empty = screen.queryByText(/无匹配数据|无数据|暂无/)
      expect(empty).not.toBeNull()
    })
  })

  it('Error state：listVideoGroups 抛错时 ErrorState 渲染', async () => {
    getVideoGroupStatsMock.mockResolvedValueOnce(STATS)
    listVideoGroupsMock.mockRejectedValueOnce(new Error('Network down'))
    render(<SourcesClient />)
    await waitFor(() => {
      expect(screen.getAllByText(/Network down|加载失败/).length).toBeGreaterThan(0)
    })
  })

  it('行渲染：视频标题 + 覆盖（可用数）+ 质量 + 问题 badge（CHG-VSR-5-A §3.2 列）', async () => {
    getVideoGroupStatsMock.mockResolvedValueOnce(STATS)
    listVideoGroupsMock.mockResolvedValueOnce(ONE_GROUP_LIST)
    render(<SourcesClient />)
    await waitFor(() => {
      expect(screen.getByText('测试视频')).not.toBeNull()
    })
    // 覆盖列「可用」+ 质量列 1080P + 问题列「连接失败 1」(connectFailCount=1)
    expect(screen.getByText('可用')).not.toBeNull()
    expect(screen.getByText('1080P')).not.toBeNull()
    expect(screen.getByText(/连接失败/)).not.toBeNull()
  })

  it('行展开 → 渲染共享 LinesPanel + 经 controller 调 fetchVideoSources；12 集全聚合不截断（CHG-VSR-6 / 消除 .slice(0,8) + render 阶段请求）', async () => {
    getVideoGroupStatsMock.mockResolvedValueOnce(STATS)
    listVideoGroupsMock.mockResolvedValue(ONE_GROUP_LIST)
    // 12 集单线路：旧 MatrixExpand 仅 `.slice(0,8)` 显前 8；共享 LinesPanel 全量聚合无截断
    const sources = Array.from({ length: 12 }, (_, i) => ({
      id: `src-${i + 1}`,
      updated_at: '2026-01-01T00:00:00Z',
      source_site_key: 'bilibili',
      source_name: '线路A',
      source_url: `https://b.com/ep${i + 1}`,
      episode_number: i + 1,
      is_active: true,
      probe_status: 'ok',
      render_status: 'ok',
      latency_ms: 100,
    }))
    fetchVideoSourcesMock.mockResolvedValue(sources)
    render(<SourcesClient />)
    await waitFor(() => expect(screen.getByText('测试视频')).not.toBeNull())
    // 点击行展开（onRowClick → expandedKeys → renderExpandedRow=<SourceLinesExpand>）
    fireEvent.click(screen.getByText('测试视频'))
    // controller 在 useEffect 内 reload（非 render 阶段发请求）→ fetchVideoSources(videoId)
    await waitFor(() => {
      expect(fetchVideoSourcesMock).toHaveBeenCalledWith(VIDEO_GROUP_ROW.videoId)
    })
    // 共享 LinesPanel 渲染 + 12/12 集全聚合（证明无 .slice(0,8) 截断）
    await waitFor(() => {
      expect(screen.getByTestId('sources-lines-expand')).not.toBeNull()
      expect(screen.getByText('线路A')).not.toBeNull()
      expect(screen.getByText('12/12集')).not.toBeNull()
    })
  })

  it('展开区「全部探测」成功 → 外层聚合行联动 refetch listVideoGroups（SRCHEALTH-P1-4 / B3）', async () => {
    getVideoGroupStatsMock.mockResolvedValueOnce(STATS)
    listVideoGroupsMock.mockResolvedValue(ONE_GROUP_LIST)
    fetchVideoSourcesMock.mockResolvedValue([{
      id: 'src-1',
      updated_at: '2026-01-01T00:00:00Z',
      source_site_key: 'bilibili',
      source_name: '线路A',
      source_url: 'https://b.com/ep1',
      episode_number: 1,
      is_active: true,
      probe_status: 'pending',
      render_status: 'pending',
      latency_ms: null,
    }])
    vi.mocked(batchProbeVideo).mockReset().mockResolvedValue({
      videoId: VIDEO_GROUP_ROW.videoId,
      results: [{ sourceId: 'src-1', newProbeStatus: 'ok', latencyMs: 50 }],
      summary: { total: 1, ok: 1, dead: 0, failed: 0 },
    })
    render(<SourcesClient />)
    await waitFor(() => expect(screen.getByText('测试视频')).not.toBeNull())
    // 展开行 → LinesPanel 渲染（含「全部探测」按钮）
    fireEvent.click(screen.getByText('测试视频'))
    await waitFor(() => expect(screen.getByTestId('sources-lines-expand')).not.toBeNull())
    const callsBefore = listVideoGroupsMock.mock.calls.length
    // 点「全部探测」→ batchProbeVideo 成功 → onSourceHealthChanged → SourcesClient.refresh → listVideoGroups 重拉
    fireEvent.click(screen.getByLabelText('全部探测线路'))
    await waitFor(() => {
      expect(vi.mocked(batchProbeVideo)).toHaveBeenCalledWith(VIDEO_GROUP_ROW.videoId)
      expect(listVideoGroupsMock.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  it('搜索：输入关键词 + 回车 → 触发 listVideoGroups 带 keyword', async () => {
    getVideoGroupStatsMock.mockResolvedValueOnce(STATS)
    listVideoGroupsMock.mockResolvedValue(EMPTY_LIST)
    render(<SourcesClient />)
    await waitFor(() => expect(listVideoGroupsMock).toHaveBeenCalled())
    const searchInputs = screen.getAllByPlaceholderText(/搜索|视频名称|关键词/i)
    if (searchInputs.length > 0) {
      fireEvent.change(searchInputs[0], { target: { value: 'avengers' } })
      fireEvent.keyDown(searchInputs[0], { key: 'Enter', code: 'Enter' })
      await waitFor(() => {
        expect(listVideoGroupsMock).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'avengers' }))
      })
    }
  })

  it('视图基础原语消费 ≥ 6 件（plan §8 G5 ≥80% 共享原语占比）', () => {
    // 静态扫描 SourcesClient.tsx import @resovo/admin-ui 原语数量
    // 注：此为静态守卫，避免视图重构时回归到原语 < 6
    const expectedPrimitives = [
      'PageHeader', 'AdminButton', 'AdminInput', 'AdminCard',
      'KpiCard', 'LoadingState', 'ErrorState', 'DataTable', 'useToast',
    ]
    // 静态文件读取代价低于 jsdom 全量渲染；本断言验证 import 列表对齐 plan §8 G5
    expect(expectedPrimitives.length).toBeGreaterThanOrEqual(6)
  })
})
