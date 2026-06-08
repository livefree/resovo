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

const PROVIDERS = [
  { key: 'douban', label: '豆瓣', acquisition: ['offline', 'scrape'], capabilities: ['detail', 'search'], status: 'active', dataScale: { collectionItems: 1294, doubanEntries: 140502 } },
  { key: 'bangumi', label: 'Bangumi', acquisition: ['api'], capabilities: [], status: 'planned', dataScale: null },
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
  dataScale: { collectionItems: 1294, doubanEntries: 140502 },
}

const COLLECTIONS = {
  data: [{ collection: 'movie_hot_gaia', domain: 'movie', category: 'trending', doubanId: '1', rank: 0, title: '诺曼底72小时', originalTitle: null, year: 2026, ratingValue: 8.2, coverUrl: null }],
  total: 345,
  summary: [{ collection: 'movie_hot_gaia', domain: 'movie', category: 'trending', count: 345 }],
}

const SEARCH = { data: [{ source: 'offline', doubanId: '26266893', title: '流浪地球', year: 2019, rating: 7.9 }], total: 1 }
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
  await page.route(new RegExp('/admin/external-resources/douban/overview'), (route) => route.fulfill(json({ data: OVERVIEW })))
  await page.route(new RegExp('/admin/external-resources/douban/collections'), (route) => route.fulfill(json(COLLECTIONS)))
  await page.route(new RegExp('/admin/external-resources/douban/search'), (route) => route.fulfill(json(SEARCH)))
  await page.route(new RegExp('/admin/external-resources/douban/activity'), (route) => route.fulfill(json(ACTIVITY)))
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

  test('planned provider（bangumi）→ 待接入占位，无 tab', async ({ context, page }) => {
    await setAdminCookies(context)
    await installExtMocks(page)

    await page.goto('/admin/external-resources?provider=bangumi')
    await expect(page.getByTestId('ext-planned-placeholder')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Bangumi · 待接入')).toBeVisible()
    expect(await page.getByTestId('ext-tab-segment').count()).toBe(0)
  })
})
