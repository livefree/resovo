/**
 * tests/e2e/admin/video-plays-analytics.spec.ts
 * 后台「视频播放」分析 tab e2e（ADR-217 / SEQ-20260624-02 STATS-07-B）
 *
 * 覆盖：
 *   1. /admin?tab=video-plays 直达 → 三视图渲染（overview 卡 + trend svg + top-videos 表）
 *   2. 从 overview tab 点「视频播放」tab → 切换可达
 *   3. period 7d→30d 切换 → 三端点重取带新 period + overview 数值更新（period-aware mock 反映）
 *
 * shell 级端点由 _shared/shell-mocks 基座拦截；3 个 /admin/analytics/video-plays/* + moderation-stats 业务 mock。
 * 认证：context.addCookies 注入 refresh_token + user_role=admin（同 dashboard.spec 范式）。
 *
 * 注：worktree 缺 .env.local → dev server 起不来，本 spec 实跑延后合并期（同 CARD-SIZE-E2E 先例）；
 *     可跑门禁 = `playwright test --project=admin-next-chromium --list <spec>` 收集本 spec。
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { installAdminShellMocks } from './_shared/shell-mocks'

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

async function setAdminCookies(context: BrowserContext) {
  await context.addCookies([
    { name: 'refresh_token', value: 'mock-admin-rt', domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Strict' },
    { name: 'user_role', value: 'admin', domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Strict' },
  ])
}

function periodOf(url: string): string {
  return new URL(url).searchParams.get('period') ?? '7d'
}

async function installVideoPlaysMocks(page: Page) {
  await installAdminShellMocks(page)

  // 概览 tab 挂载时 DashboardClient 会拉 moderation-stats（与本 tab 无关，给个 200 防噪声）
  await page.route(/\/admin\/videos\/moderation-stats/, async (route) => {
    await route.fulfill(json({ data: { pendingCount: 1, todayReviewedCount: 1, interceptRate: 1 } }))
  })

  // overview：period-aware totalPlays（7d=7000 / 30d=30000 / 90d=90000）
  await page.route(/\/admin\/analytics\/video-plays\/overview/, async (route) => {
    const period = periodOf(route.request().url())
    const totalPlays = period === '30d' ? 30000 : period === '90d' ? 90000 : 7000
    await route.fulfill(
      json({
        data: { period, totalPlays, totalWatchSeconds: totalPlays * 10, avgWatchSeconds: 10, anonPlays: totalPlays, loggedInPlays: 0 },
      }),
    )
  })

  // trend：period → N 点 zero-fill 数组
  await page.route(/\/admin\/analytics\/video-plays\/trend/, async (route) => {
    const period = periodOf(route.request().url())
    const n = period === '30d' ? 30 : period === '90d' ? 90 : 7
    const data = Array.from({ length: n }, (_, i) => ({
      date: `2026-06-${String((i % 28) + 1).padStart(2, '0')}`,
      plays: i,
      watchSeconds: i * 10,
      anonPlays: i,
      loggedInPlays: 0,
    }))
    await route.fulfill(json({ data }))
  })

  // top-videos：裸数组
  await page.route(/\/admin\/analytics\/video-plays\/top-videos/, async (route) => {
    await route.fulfill(json({ data: [{ shortId: 'abCD1234', title: 'E2E 热门视频', plays: 999, watchSeconds: 88000 }] }))
  })
}

test.describe('后台「视频播放」分析 tab', () => {
  test('1. /admin?tab=video-plays 直达 → 三视图渲染', async ({ context, page }) => {
    await setAdminCookies(context)
    await installVideoPlaysMocks(page)

    await page.goto('/admin?tab=video-plays')
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-tab="video-plays"]')).toBeVisible()

    await expect(page.locator('[data-video-plays-view]')).toBeVisible()
    await expect(page.locator('[data-video-plays-overview]')).toBeVisible()
    await expect(page.locator('[data-video-plays-trend-chart]')).toBeVisible()
    await expect(page.getByTestId('video-plays-top-videos-table')).toBeVisible()
    await expect(page.getByText('E2E 热门视频')).toBeVisible()
  })

  test('2. 从概览 tab 点「视频播放」tab → 切换可达', async ({ context, page }) => {
    await setAdminCookies(context)
    await installVideoPlaysMocks(page)

    await page.goto('/admin')
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 10000 })
    await page.locator('[data-tab="video-plays"]').click()

    await expect(page.locator('[data-video-plays-view]')).toBeVisible()
    await expect(page.locator('[data-video-plays-trend-chart]')).toBeVisible()
  })

  test('3. period 7d→30d 切换 → overview 数值更新（端点重取带新 period）', async ({ context, page }) => {
    await setAdminCookies(context)
    await installVideoPlaysMocks(page)

    await page.goto('/admin?tab=video-plays')
    await expect(page.locator('[data-video-plays-overview]')).toBeVisible()
    await expect(page.locator('[data-video-plays-overview]')).toContainText('7,000')

    await page.locator('[data-video-plays-period-select]').selectOption('30d')
    await expect(page.locator('[data-video-plays-overview]')).toContainText('30,000')
  })
})
