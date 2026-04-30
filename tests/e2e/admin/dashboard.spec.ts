/**
 * tests/e2e/admin/dashboard.spec.ts
 * CHG-DESIGN-07 7C 步骤 6：Dashboard 8 卡片浏览态 e2e smoke
 *
 * 防 CHG-SN-3-08 假完成模式（reference §5.1.4 教训直接落地）：
 *   - 三 stats 路径（200 完整 / 200 部分 / 500）守门
 *   - 200 完整路径强断言 4 张 KPI [data-card-value] 非破折号
 *   - 9 类卡片选择器全部 visible
 *
 * 断言收紧（避免误伤 page__head em-dash 文案）：
 *   - 仅在 [data-card-value] 节点上断言无破折号
 *   - 不在 [data-page-head] 上做破折号断言（合法 em dash）
 *
 * 前提：apps/server-next 运行于 localhost:3003（baseURL 由 admin-next-chromium project 注入）
 * API：page.route 拦截 /v1/admin/videos/moderation-stats，不依赖真实后端
 * 认证：context.addCookies 注入 refresh_token + user_role=admin
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test'

const API_BASE = 'http://localhost:4000/v1'

async function setAdminCookies(context: BrowserContext) {
  await context.addCookies([
    {
      name: 'refresh_token',
      value: 'mock-admin-rt',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    },
    {
      name: 'user_role',
      value: 'admin',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Strict',
    },
  ])
}

type StatsPath = 'full-200' | 'partial-200' | 'error-500'

async function installStatsMock(page: Page, path: StatsPath) {
  await page.route(`${API_BASE}/admin/videos/moderation-stats`, async (route) => {
    if (path === 'full-200') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: { pendingCount: 484, todayReviewedCount: 67, interceptRate: 0.12 },
        }),
      })
      return
    }
    if (path === 'partial-200') {
      // 仅 pendingCount；缺 todayReviewedCount + interceptRate
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { pendingCount: 50 } }),
      })
      return
    }
    // error-500
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' }),
    })
  })
}

test.describe('Dashboard 8 卡片浏览态 — 三 stats 路径 regression gate', () => {
  test('200 完整：4 行布局 + 9 类卡片 + 4 张 KPI 数值非破折号', async ({ context, page }) => {
    await setAdminCookies(context)
    await installStatsMock(page, 'full-200')

    await page.goto('/admin')
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 10000 })

    // 4 行布局
    await expect(page.locator('[data-page-head]')).toBeVisible()
    await expect(page.locator('[data-dashboard-row="1"]')).toBeVisible()
    await expect(page.locator('[data-dashboard-row="2"]')).toBeVisible()
    await expect(page.locator('[data-dashboard-row="3"]')).toBeVisible()

    // 5 类卡片（4 张 KPI 共用 metric-kpi 选择器，count=4）
    await expect(page.locator('[data-card="attention"]')).toBeVisible()
    await expect(page.locator('[data-card="workflow"]')).toBeVisible()
    expect(await page.locator('[data-kpi-card]').count()).toBe(4)
    await expect(page.locator('[data-card="recent-activity"]')).toBeVisible()
    await expect(page.locator('[data-card="site-health"]')).toBeVisible()

    // reference §5.1.4 守门：4 张 KPI [data-card-value] 全部非破折号
    const kpiValues = await page.locator('[data-kpi-card] [data-card-value]').allTextContents()
    expect(kpiValues.length).toBe(4)
    for (const text of kpiValues) {
      expect(text).not.toBe('—')
      expect(text.trim().length).toBeGreaterThan(0)
    }

    // 待审/暂存 KPI 使用 live pendingCount（dataSource="live"）
    const pendingKpi = page.locator('[data-testid="kpi-pendingStaging"]')
    await expect(pendingKpi).toHaveAttribute('data-source', 'live')
    await expect(pendingKpi.locator('[data-card-value]')).toHaveText('484 / 23')
  })

  test('200 部分字段缺失：fallback mock + data-source 标记 + 仍无破折号', async ({ context, page }) => {
    await setAdminCookies(context)
    await installStatsMock(page, 'partial-200')

    await page.goto('/admin')
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 10000 })

    // 4 行布局仍存在
    await expect(page.locator('[data-dashboard-row="1"]')).toBeVisible()
    await expect(page.locator('[data-dashboard-row="2"]')).toBeVisible()
    await expect(page.locator('[data-dashboard-row="3"]')).toBeVisible()

    // 4 张 KPI 仍渲染
    expect(await page.locator('[data-kpi-card]').count()).toBe(4)

    // 守门：4 张 KPI 数值仍非破折号（fallback mock 后）
    const kpiValues = await page.locator('[data-kpi-card] [data-card-value]').allTextContents()
    for (const text of kpiValues) {
      expect(text).not.toBe('—')
      expect(text.trim().length).toBeGreaterThan(0)
    }

    // mock fallback 节点存在（视频总量 / 源可达率 / 失效源 走 mock；待审/暂存仍 live）
    expect(await page.locator('[data-source="mock"]').count()).toBeGreaterThanOrEqual(3)
    const pendingKpi = page.locator('[data-testid="kpi-pendingStaging"]')
    await expect(pendingKpi).toHaveAttribute('data-source', 'live')
  })

  test('500 接口失败：ErrorState 兜底，不破坏 page-head + tabs 结构', async ({ context, page }) => {
    await setAdminCookies(context)
    await installStatsMock(page, 'error-500')

    await page.goto('/admin')
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 10000 })

    // ErrorState 渲染
    await expect(page.locator('[data-error-state]')).toBeVisible({ timeout: 5000 })

    // page-head 仍渲染（顶部不被替代）
    await expect(page.locator('[data-page-head]')).toBeVisible()

    // tabs 仍可见
    await expect(page.locator('[data-tab="overview"]')).toBeVisible()
    await expect(page.locator('[data-tab="analytics"]')).toBeVisible()

    // 失败路径下 5 类卡片不渲染（避免 mock 数据冒充 live）
    expect(await page.locator('[data-card="attention"]').count()).toBe(0)
    expect(await page.locator('[data-kpi-card]').count()).toBe(0)
  })
})
