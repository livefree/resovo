/**
 * tests/e2e/admin/external-resources/external-resources-smoke.spec.ts
 * CHG-EXT-RES-UI-B（ADR-188 D-188-1）外部资源治理页 admin 域 e2e smoke
 *
 * 覆盖：
 *   1. 概览：provider Segment（豆瓣）+ 4 tab + 4 张 KpiCard 数值非破折号
 *   2. 切「热门资源」→ 分类 chips + 条目表格 / 切「资源搜索」→ 输入回车 → 结果行
 *   3. planned provider（?provider=bangumi）→「待接入」占位（无 tab）
 *
 * API：page.route 拦截 5 个 /v1/admin/external-resources/* 端点（不依赖真实后端）；
 *      shell 级端点由 _shared/shell-mocks 基座拦截。
 * 认证：context.addCookies 注入 refresh_token + user_role=admin（同 dashboard.spec）。
 * 前提：apps/server-next 运行于 localhost:3003（admin-next-chromium project 注入 baseURL）。
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { installAdminShellMocks } from '../_shared/shell-mocks'

const API_BASE = 'http://localhost:4000/v1'
const EXT_BASE = `${API_BASE}/admin/external-resources`

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
    byOperation: [{ key: 'detail', total: 120, ok: 110, fail: 8, timeout: 2 }],
    byMethod: [{ key: 'scrape', total: 212, ok: 196, fail: 12, timeout: 4 }],
  },
  enrichStats: { total: 480, byStatus: [{ key: 'auto_matched', count: 400 }], byMethod: [{ key: 'title', count: 300 }] },
  collectionFreshness: [{ collection: 'movie_hot_gaia', lastAttemptAt: '2026-06-07T10:00:00Z', lastSuccessAt: '2026-06-07T10:00:00Z', lastStatus: 'ok', lastError: null, itemCount: 345 }],
  dataScale: DOUBAN_SCALE,
}

const COLLECTIONS = {
  data: [{ collection: 'movie_hot_gaia', domain: 'movie', category: 'trending', externalId: '1', rank: 0, title: '诺曼底72小时', subtitle: null, year: 2026, rating: 8.2, coverUrl: null, airWeekday: null }],
  total: 345,
  summary: [{ collection: 'movie_hot_gaia', domain: 'movie', category: 'trending', count: 345 }],
}

const SEARCH = { data: [{ source: 'offline', externalId: '26266893', title: '流浪地球', year: 2019, rating: 7.9 }], total: 1 }
const ACTIVITY = { data: [{ id: '1', provider: 'douban', operation: 'detail', method: 'scrape', status: 'ok', source: 'enrich_worker', target: 'db123', itemCount: 1, durationMs: 530, error: null, createdAt: '2026-06-07T10:00:00Z' }], total: 1 }

async function setAdminCookies(context: BrowserContext) {
  await context.addCookies([
    { name: 'refresh_token', value: 'mock-admin-rt', domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Strict' },
    { name: 'user_role', value: 'admin', domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Strict' },
  ])
}

function json(body: unknown) {
  return { contentType: 'application/json', body: JSON.stringify(body) }
}

async function installExtMocks(page: Page) {
  await installAdminShellMocks(page)
  await page.route(`${EXT_BASE}/providers`, (route) => route.fulfill(json({ data: PROVIDERS })))
  // provider 无关路由（douban + bangumi 均 active，复用同 fixture 做 smoke）
  await page.route(new RegExp('/admin/external-resources/[^/]+/overview'), (route) => route.fulfill(json({ data: OVERVIEW })))
  await page.route(new RegExp('/admin/external-resources/[^/]+/collections'), (route) => route.fulfill(json(COLLECTIONS)))
  await page.route(new RegExp('/admin/external-resources/[^/]+/search'), (route) => route.fulfill(json(SEARCH)))
  await page.route(new RegExp('/admin/external-resources/[^/]+/activity'), (route) => route.fulfill(json(ACTIVITY)))
}

test.describe('外部资源治理页 — admin smoke', () => {
  test('概览：provider Segment + 4 tab + 4 张 KPI 数值非破折号', async ({ context, page }) => {
    await setAdminCookies(context)
    await installExtMocks(page)

    await page.goto('/admin/external-resources')
    await expect(page.getByTestId('ext-provider-segment')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('tab', { name: '豆瓣' })).toBeVisible()

    // 4 个治理 tab
    await expect(page.getByRole('tab', { name: '概览' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '热门资源' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '资源搜索' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '采集与富集记录' })).toBeVisible()

    // 4 张 KpiCard 数值非破折号
    const kpiValues = await page.locator('[data-overview-kpis] [data-card-value]').allTextContents()
    expect(kpiValues.length).toBe(4)
    for (const text of kpiValues) {
      expect(text).not.toBe('—')
      expect(text.trim().length).toBeGreaterThan(0)
    }
  })

  test('热门资源 chips + 表格 / 资源搜索 输入回车 → 结果', async ({ context, page }) => {
    await setAdminCookies(context)
    await installExtMocks(page)

    await page.goto('/admin/external-resources')
    await expect(page.getByTestId('ext-provider-segment')).toBeVisible({ timeout: 10000 })

    // 切热门资源 → 分类 chip + 条目
    await page.getByRole('tab', { name: '热门资源' }).click()
    await expect(page.getByTestId('ext-collections-table')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('[data-collection-chip="movie_hot_gaia"]')).toBeVisible()
    await expect(page.getByText('诺曼底72小时')).toBeVisible()

    // 切资源搜索 → 输入回车 → 结果行
    await page.getByRole('tab', { name: '资源搜索' }).click()
    await expect(page.getByTestId('ext-search-input')).toBeVisible({ timeout: 8000 })
    await page.getByTestId('ext-search-input').fill('流浪地球')
    await page.getByTestId('ext-search-input').press('Enter')
    await expect(page.getByText('流浪地球')).toBeVisible({ timeout: 8000 })
  })

  test('planned provider（imdb）→ 待接入占位，无 tab', async ({ context, page }) => {
    await setAdminCookies(context)
    await installExtMocks(page)

    await page.goto('/admin/external-resources?provider=imdb')
    await expect(page.getByTestId('ext-planned-placeholder')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('IMDB · 待接入')).toBeVisible()
    expect(await page.getByTestId('ext-tab-segment').count()).toBe(0)
  })

  test('bangumi active（ADR-189）→ 4 tab + 概览官方入口卡', async ({ context, page }) => {
    await setAdminCookies(context)
    await installExtMocks(page)

    await page.goto('/admin/external-resources?provider=bangumi')
    await expect(page.getByTestId('ext-tab-segment')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('ext-planned-placeholder')).toHaveCount(0)
    // 概览官方入口卡（API/doc/dump 外链）
    await expect(page.getByTestId('ext-overview-official-links')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('[data-official-link="https://api.bgm.tv"]')).toBeVisible()
  })
})
