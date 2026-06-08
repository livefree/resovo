/**
 * ExternalResources.test.tsx — CHG-EXT-RES-UI-A（ADR-188 D-188-1）外部资源治理页视图单测
 *
 * 覆盖：
 *  ExternalResourcesClient
 *   1. 默认 douban active → 渲染 provider Segment（4 provider）+ tab Segment + 概览面板
 *   2. planned provider（?provider=bangumi）→「待接入」占位 + 获取方式 Pill(API)，无 tab Segment / 不拉 overview
 *   3. 切 tab → router.push 带 ?tab=activity
 *   4. 切 provider（Bangumi）→ router.push 带 ?provider=bangumi（清 tab）
 *   5. providers 加载失败 → ErrorState
 *  OverviewTab
 *   6. 4 张 KpiCard（数据规模 ×2 / 采集次数 / 富集匹配）数值正确
 *   7. 采集明细按内容类型 → operation 中文标签（视频基础信息）
 *   8. 采集明细按方式 → method 中文标签（页面抓取）
 *   9. 合集新鲜度 → collection key + 条数
 *  10. fetchOverview 失败 → ErrorState
 *  11. data=null → EmptyState
 *  ActivityTab
 *  12. 渲染 3 过滤器 + 流水行（operation/status 中文 + 耗时）
 *  13. 空流水 → EmptyState
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockFetchProviders = vi.fn()
const mockFetchOverview = vi.fn()
const mockFetchActivity = vi.fn()

let currentParams = new URLSearchParams()
const pushMock = vi.fn()
const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  useSearchParams: () => currentParams,
  useRouter: () => ({ push: pushMock, replace: replaceMock, back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/admin/external-resources',
}))

vi.mock('@/lib/external-resources/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/external-resources/api')>('@/lib/external-resources/api')
  return {
    ...actual,
    fetchProviders: (...a: unknown[]) => mockFetchProviders(...a),
    fetchOverview: (...a: unknown[]) => mockFetchOverview(...a),
    fetchActivity: (...a: unknown[]) => mockFetchActivity(...a),
  }
})

import { ExternalResourcesClient } from '@/app/admin/external-resources/_client/ExternalResourcesClient'
import { OverviewTab } from '@/app/admin/external-resources/_client/OverviewTab'
import { ActivityTab } from '@/app/admin/external-resources/_client/ActivityTab'

const fmt = (n: number) => n.toLocaleString('zh-CN')

const PROVIDERS = [
  { key: 'douban', label: '豆瓣', acquisition: ['offline', 'scrape'], capabilities: ['detail', 'search'], status: 'active', dataScale: { collectionItems: 1294, doubanEntries: 140502 } },
  { key: 'bangumi', label: 'Bangumi', acquisition: ['api'], capabilities: [], status: 'planned', dataScale: null },
  { key: 'imdb', label: 'IMDB', acquisition: ['api'], capabilities: [], status: 'planned', dataScale: null },
  { key: 'tmdb', label: 'TMDb', acquisition: ['api'], capabilities: [], status: 'planned', dataScale: null },
]

const OVERVIEW = {
  fetchStats: {
    total: 212, ok: 196, fail: 12, timeout: 4, avgDurationMs: 540,
    byOperation: [
      { key: 'detail', total: 120, ok: 110, fail: 8, timeout: 2 },
      { key: 'search', total: 92, ok: 86, fail: 4, timeout: 2 },
    ],
    byMethod: [{ key: 'scrape', total: 212, ok: 196, fail: 12, timeout: 4 }],
  },
  enrichStats: {
    total: 480,
    byStatus: [{ key: 'auto_matched', count: 400 }],
    byMethod: [{ key: 'title', count: 300 }, { key: 'network', count: 180 }],
  },
  collectionFreshness: [
    { collection: 'movie_hot_gaia', lastAttemptAt: '2026-06-07T10:00:00Z', lastSuccessAt: '2026-06-07T10:00:00Z', lastStatus: 'ok', lastError: null, itemCount: 345 },
  ],
  dataScale: { collectionItems: 1294, doubanEntries: 140502 },
}

const ACTIVITY_ROWS = [
  { id: '1', provider: 'douban', operation: 'detail', method: 'scrape', status: 'ok', source: 'enrich_worker', target: 'db123', itemCount: 1, durationMs: 530, error: null, createdAt: '2026-06-07T10:00:00Z' },
  { id: '2', provider: 'douban', operation: 'search', method: 'scrape', status: 'fail', source: 'admin_search', target: '流浪地球', itemCount: 0, durationMs: 1200, error: 'timeout', createdAt: '2026-06-07T09:00:00Z' },
]

beforeEach(() => {
  currentParams = new URLSearchParams()
  pushMock.mockClear()
  replaceMock.mockClear()
  mockFetchProviders.mockReset().mockResolvedValue(PROVIDERS)
  mockFetchOverview.mockReset().mockResolvedValue(OVERVIEW)
  mockFetchActivity.mockReset().mockResolvedValue({ rows: ACTIVITY_ROWS, total: 2 })
})

afterEach(() => cleanup())

// ── ExternalResourcesClient ───────────────────────────────────────

describe('ExternalResourcesClient', () => {
  it('默认 douban active → provider Segment + tab Segment + 概览面板', async () => {
    render(<ExternalResourcesClient />)
    expect(await screen.findByTestId('ext-provider-segment')).not.toBeNull()
    expect(screen.getByRole('tab', { name: '豆瓣' })).not.toBeNull()
    expect(screen.getByRole('tab', { name: 'Bangumi' })).not.toBeNull()
    expect(screen.getByTestId('ext-tab-segment')).not.toBeNull()
    // 概览面板渲染 → KpiCard 标签出现
    expect(await screen.findByText('热门合集条目')).not.toBeNull()
  })

  it('planned provider（bangumi）→ 待接入占位 + 获取方式 Pill，无 tab Segment / 不拉 overview', async () => {
    currentParams = new URLSearchParams('provider=bangumi')
    render(<ExternalResourcesClient />)
    expect(await screen.findByTestId('ext-planned-placeholder')).not.toBeNull()
    expect(screen.getByText('Bangumi · 待接入')).not.toBeNull()
    expect(screen.getByText('API')).not.toBeNull()
    expect(screen.queryByTestId('ext-tab-segment')).toBeNull()
    expect(mockFetchOverview).not.toHaveBeenCalled()
  })

  it('切 tab → router.push 带 ?tab=activity', async () => {
    render(<ExternalResourcesClient />)
    const tab = await screen.findByRole('tab', { name: '采集与富集记录' })
    fireEvent.click(tab)
    await waitFor(() => expect(pushMock).toHaveBeenCalled())
    expect(pushMock.mock.calls.some((c) => String(c[0]).includes('tab=activity'))).toBe(true)
  })

  it('切 provider（Bangumi）→ router.push 带 ?provider=bangumi', async () => {
    render(<ExternalResourcesClient />)
    const seg = await screen.findByRole('tab', { name: 'Bangumi' })
    fireEvent.click(seg)
    await waitFor(() => expect(pushMock).toHaveBeenCalled())
    expect(pushMock.mock.calls.some((c) => String(c[0]).includes('provider=bangumi'))).toBe(true)
  })

  it('providers 加载失败 → ErrorState', async () => {
    mockFetchProviders.mockReset().mockRejectedValue(new Error('boom'))
    render(<ExternalResourcesClient />)
    expect(await screen.findByText('加载失败')).not.toBeNull()
  })
})

// ── OverviewTab ───────────────────────────────────────────────────

describe('OverviewTab', () => {
  it('4 张 KpiCard 数值正确', async () => {
    render(<OverviewTab provider="douban" />)
    expect((await screen.findByTestId('ext-kpi-collection-items')).textContent).toContain(fmt(1294))
    expect(screen.getByTestId('ext-kpi-douban-entries').textContent).toContain(fmt(140502))
    expect(screen.getByTestId('ext-kpi-fetch-total').textContent).toContain(fmt(212))
    expect(screen.getByTestId('ext-kpi-enrich-total').textContent).toContain(fmt(480))
  })

  it('采集明细按内容类型 → operation 中文标签', async () => {
    render(<OverviewTab provider="douban" />)
    expect(await screen.findByText('视频基础信息')).not.toBeNull()
    expect(screen.getByText('搜索')).not.toBeNull()
  })

  it('采集明细按方式 → method 中文标签', async () => {
    render(<OverviewTab provider="douban" />)
    expect(await screen.findByText('页面抓取')).not.toBeNull()
  })

  it('合集新鲜度 → collection key + 条数', async () => {
    render(<OverviewTab provider="douban" />)
    expect(await screen.findByText('movie_hot_gaia')).not.toBeNull()
    expect(screen.getByText('345 条')).not.toBeNull()
  })

  it('fetchOverview 失败 → ErrorState', async () => {
    mockFetchOverview.mockReset().mockRejectedValue(new Error('boom'))
    render(<OverviewTab provider="douban" />)
    expect(await screen.findByText('加载失败')).not.toBeNull()
  })

  it('data=null → EmptyState', async () => {
    mockFetchOverview.mockReset().mockResolvedValue(null)
    render(<OverviewTab provider="douban" />)
    expect(await screen.findByText('暂无概览数据')).not.toBeNull()
  })
})

// ── ActivityTab ───────────────────────────────────────────────────

describe('ActivityTab', () => {
  it('渲染 3 过滤器 + 流水行（中文标签 + 耗时）', async () => {
    render(<ActivityTab provider="douban" />)
    expect(await screen.findByTestId('ext-activity-filter-operation')).not.toBeNull()
    expect(screen.getByTestId('ext-activity-filter-method')).not.toBeNull()
    expect(screen.getByTestId('ext-activity-filter-status')).not.toBeNull()
    // 行：operation 中文 + status 中文 + 耗时
    expect(await screen.findByText('视频基础信息')).not.toBeNull()
    expect(screen.getByText('530ms')).not.toBeNull()
    expect(mockFetchActivity).toHaveBeenCalled()
  })

  it('空流水 → EmptyState', async () => {
    mockFetchActivity.mockReset().mockResolvedValue({ rows: [], total: 0 })
    render(<ActivityTab provider="douban" />)
    expect(await screen.findByText('暂无采集记录')).not.toBeNull()
  })
})
