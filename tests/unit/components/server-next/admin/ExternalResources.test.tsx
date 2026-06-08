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
const mockFetchCollections = vi.fn()
const mockSearchResources = vi.fn()

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
    fetchCollections: (...a: unknown[]) => mockFetchCollections(...a),
    searchResources: (...a: unknown[]) => mockSearchResources(...a),
  }
})

import { ExternalResourcesClient } from '@/app/admin/external-resources/_client/ExternalResourcesClient'
import { OverviewTab } from '@/app/admin/external-resources/_client/OverviewTab'
import { ActivityTab } from '@/app/admin/external-resources/_client/ActivityTab'
import { CollectionsTab } from '@/app/admin/external-resources/_client/CollectionsTab'
import { SearchTab } from '@/app/admin/external-resources/_client/SearchTab'
import { calendarWeekday, thisWeekDateOf } from '@/lib/external-resources/api'

const fmt = (n: number) => n.toLocaleString('zh-CN')

const DOUBAN_SCALE = [
  { key: 'collectionItems', label: '热门合集条目', value: 1294 },
  { key: 'doubanEntries', label: '离线 dump 条目', value: 140502 },
]

const PROVIDERS = [
  { key: 'douban', label: '豆瓣', acquisition: ['offline', 'scrape'], capabilities: ['detail', 'search'], status: 'active', dataScale: DOUBAN_SCALE },
  { key: 'bangumi', label: 'Bangumi', acquisition: ['api'], capabilities: ['detail', 'search', 'celebrity', 'collection', 'schedule'], status: 'active', dataScale: [{ key: 'collectionItems', label: '派生合集条目', value: 50 }, { key: 'dumpEntries', label: '离线 dump 条目', value: 9000 }] },
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
  dataScale: DOUBAN_SCALE,
}

const ACTIVITY_ROWS = [
  { id: '1', provider: 'douban', operation: 'detail', method: 'scrape', status: 'ok', source: 'enrich_worker', target: 'db123', itemCount: 1, durationMs: 530, error: null, createdAt: '2026-06-07T10:00:00Z' },
  { id: '2', provider: 'douban', operation: 'search', method: 'scrape', status: 'fail', source: 'admin_search', target: '流浪地球', itemCount: 0, durationMs: 1200, error: 'timeout', createdAt: '2026-06-07T09:00:00Z' },
]

const COLLECTIONS = {
  items: [
    { collection: 'movie_hot_gaia', domain: 'movie', category: 'trending', externalId: '1', rank: 0, title: '诺曼底72小时', subtitle: null, year: 2026, rating: 8.2, coverUrl: null, airWeekday: null },
  ],
  total: 345,
  summary: [
    { collection: 'movie_hot_gaia', domain: 'movie', category: 'trending', count: 345 },
    { collection: 'tv_hot', domain: 'tv', category: 'trending', count: 247 },
  ],
}

const SEARCH = {
  rows: [{ source: 'offline' as const, externalId: '26266893', title: '流浪地球', year: 2019, rating: 7.9 }],
  total: 1,
}

beforeEach(() => {
  currentParams = new URLSearchParams()
  pushMock.mockClear()
  replaceMock.mockClear()
  mockFetchProviders.mockReset().mockResolvedValue(PROVIDERS)
  mockFetchOverview.mockReset().mockResolvedValue(OVERVIEW)
  mockFetchActivity.mockReset().mockResolvedValue({ rows: ACTIVITY_ROWS, total: 2 })
  mockFetchCollections.mockReset().mockResolvedValue(COLLECTIONS)
  mockSearchResources.mockReset().mockResolvedValue(SEARCH)
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

  it('planned provider（imdb）→ 待接入占位 + 获取方式 Pill，无 tab Segment / 不拉 overview', async () => {
    currentParams = new URLSearchParams('provider=imdb')
    render(<ExternalResourcesClient />)
    expect(await screen.findByTestId('ext-planned-placeholder')).not.toBeNull()
    expect(screen.getByText('IMDB · 待接入')).not.toBeNull()
    expect(screen.getByText('API')).not.toBeNull()
    expect(screen.queryByTestId('ext-tab-segment')).toBeNull()
    expect(mockFetchOverview).not.toHaveBeenCalled()
  })

  it('bangumi active → tab Segment + 概览面板（ADR-189）', async () => {
    currentParams = new URLSearchParams('provider=bangumi')
    render(<ExternalResourcesClient />)
    expect(await screen.findByTestId('ext-tab-segment')).not.toBeNull()
    expect(screen.queryByTestId('ext-planned-placeholder')).toBeNull()
  })

  it('active 渲染 4 个治理 tab（概览/热门资源/资源搜索/采集与富集记录）', async () => {
    render(<ExternalResourcesClient />)
    expect(await screen.findByRole('tab', { name: '概览' })).not.toBeNull()
    expect(screen.getByRole('tab', { name: '热门资源' })).not.toBeNull()
    expect(screen.getByRole('tab', { name: '资源搜索' })).not.toBeNull()
    expect(screen.getByRole('tab', { name: '采集与富集记录' })).not.toBeNull()
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
    expect((await screen.findByTestId('ext-kpi-collectionItems')).textContent).toContain(fmt(1294))
    expect(screen.getByTestId('ext-kpi-doubanEntries').textContent).toContain(fmt(140502))
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

  it('bangumi → 官方入口卡（API/doc/dump 外链，ADR-189 D-189-8）；douban 无入口卡', async () => {
    const { unmount } = render(<OverviewTab provider="bangumi" />)
    const links = await screen.findByTestId('ext-overview-official-links')
    expect(links).not.toBeNull()
    const anchors = links.querySelectorAll('a[data-official-link]')
    expect(anchors.length).toBe(3)
    expect(Array.from(anchors).some((a) => a.getAttribute('href') === 'https://api.bgm.tv')).toBe(true)
    unmount()
    // douban 无 PROVIDER_LINKS → 不渲染入口卡
    render(<OverviewTab provider="douban" />)
    await screen.findByTestId('ext-kpi-collectionItems')
    expect(screen.queryByTestId('ext-overview-official-links')).toBeNull()
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

// ── CollectionsTab ────────────────────────────────────────────────

describe('CollectionsTab', () => {
  it('渲染分类 chips（含计数）+ 条目（rank+1 / 评分）', async () => {
    render(<CollectionsTab provider="douban" />)
    expect(await screen.findByText('全部分类')).not.toBeNull()
    // chip：movie_hot_gaia 345 / tv_hot 247
    expect(screen.getByText('movie_hot_gaia')).not.toBeNull()
    expect(screen.getByText('247')).not.toBeNull()
    // 条目：标题 + rank 显示 1（rank 0 + 1）+ 评分 8.2
    expect(await screen.findByText('诺曼底72小时')).not.toBeNull()
    expect(screen.getByText('8.2')).not.toBeNull()
  })

  it('点击分类 chip → fetchCollections 带 collection 过滤', async () => {
    render(<CollectionsTab provider="douban" />)
    const chip = await screen.findByText('tv_hot')
    fireEvent.click(chip)
    await waitFor(() =>
      expect(mockFetchCollections.mock.calls.some((c) => (c[1] as { collection?: string })?.collection === 'tv_hot')).toBe(true),
    )
  })

  it('null（无条目）→ EmptyState', async () => {
    mockFetchCollections.mockReset().mockResolvedValue(null)
    render(<CollectionsTab provider="douban" />)
    expect(await screen.findByText('暂无热门资源')).not.toBeNull()
  })

  it('bangumi 每日放送 chip → 周几+本周真实日期 + 「N 部」（数量非日期，修复误读）', async () => {
    mockFetchCollections.mockReset().mockResolvedValue({
      items: [], total: 0,
      summary: [
        { collection: 'bgm_calendar_mon', category: 'calendar', domain: null, count: 9 },
        { collection: 'bgm_calendar_tue', category: 'calendar', domain: null, count: 9 },
      ],
    })
    const { container } = render(<CollectionsTab provider="bangumi" />)
    await screen.findByText('全部分类')
    const mon = container.querySelector('[data-collection-chip="bgm_calendar_mon"]')!
    const tue = container.querySelector('[data-collection-chip="bgm_calendar_tue"]')!
    // 标签含周几 + 本周真实日期 M/D（连续，可读）
    expect(mon.textContent).toMatch(/周一 \d+\/\d+/)
    expect(tue.textContent).toMatch(/周二 \d+\/\d+/)
    // 数量带「部」单位，与日期区分（不再被误读为日期）
    expect(mon.textContent).toContain('9 部')
    expect(tue.textContent).toContain('9 部')
  })
})

describe('每日放送 chip helpers', () => {
  it('calendarWeekday：bgm_calendar_X → 1-7；非 calendar → null', () => {
    expect(calendarWeekday('bgm_calendar_mon')).toBe(1)
    expect(calendarWeekday('bgm_calendar_sun')).toBe(7)
    expect(calendarWeekday('bgm_trending')).toBeNull()
    expect(calendarWeekday('movie_hot_gaia')).toBeNull()
  })

  it('thisWeekDateOf：周一..周日为同周 7 个连续日期 + 当日 weekday 返当日 M/D', () => {
    const now = new Date('2026-06-10T12:00:00')
    const dates = [1, 2, 3, 4, 5, 6, 7].map((w) => thisWeekDateOf(w, now))
    expect(new Set(dates).size).toBe(7) // 7 个不同日期（非重复随机）
    const todayWd = ((now.getDay() + 6) % 7) + 1
    expect(thisWeekDateOf(todayWd, now)).toBe(`${now.getMonth() + 1}/${now.getDate()}`)
    // 周一与周二相差 1 天（连续）
    const [m, d] = thisWeekDateOf(1, now).split('/').map(Number)
    const monDate = new Date(now.getFullYear(), m - 1, d)
    const [m2, d2] = thisWeekDateOf(2, now).split('/').map(Number)
    const tueDate = new Date(now.getFullYear(), m2 - 1, d2)
    expect((tueDate.getTime() - monDate.getTime()) / 86400000).toBe(1)
  })
})

// ── SearchTab ─────────────────────────────────────────────────────

describe('SearchTab', () => {
  it('初始无输入 → 提示 EmptyState，不调用 searchResources', async () => {
    render(<SearchTab provider="douban" />)
    expect(await screen.findByText('输入关键词搜索')).not.toBeNull()
    expect(mockSearchResources).not.toHaveBeenCalled()
  })

  it('输入并回车 → 调用 searchResources + 渲染结果（离线 Pill）', async () => {
    render(<SearchTab provider="douban" />)
    const input = await screen.findByTestId('ext-search-input')
    fireEvent.change(input, { target: { value: '流浪地球' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('流浪地球')).not.toBeNull()
    expect(screen.getByText('离线')).not.toBeNull()
    expect(mockSearchResources.mock.calls.some((c) => (c[1] as { q?: string })?.q === '流浪地球')).toBe(true)
  })

  it('开在线实时 + 搜索 → live:true 透传 + busy 降级横幅', async () => {
    mockSearchResources.mockReset().mockImplementation((_p: unknown, query: { live?: boolean }) =>
      Promise.resolve(query.live ? { ...SEARCH, liveError: 'busy' } : SEARCH),
    )
    render(<SearchTab provider="douban" />)
    fireEvent.click(await screen.findByTestId('ext-search-live-toggle'))
    const input = screen.getByTestId('ext-search-input')
    fireEvent.change(input, { target: { value: '流浪地球' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText(/在线搜索繁忙/)).not.toBeNull()
    expect(mockSearchResources.mock.calls.some((c) => (c[1] as { live?: boolean })?.live === true)).toBe(true)
  })
})
