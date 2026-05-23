/**
 * crawler.visual.spec.ts
 * CHG-SN-7-MISC-VISUAL-BATCH（REDO-01-J 软门收尾 / 2026-05-23）
 *
 * 涵盖 CHG-SN-7-REDO-01 系列 A→J 闭合后的 Crawler 控制台 7 张关键视觉 baseline：
 *   1. crawler-kpi-row          — REDO-01-C KpiRow（5 张 KpiCard 横排：站点/运行中/失败/本批/平均时长）
 *   2. crawler-timeline-card    — REDO-01-C TimelineCard（15s auto-refresh / status pill / pause toggle）
 *   3. crawler-site-list        — REDO-01-C SiteList（DataTable 9 列骨架 / search toolbar）
 *   4. crawler-site-row-expanded — REDO-01-E CrawlerSiteExpand（行展开 sub-table / 6 列路由明细）
 *   5. crawler-advanced-menu    — REDO-01-G AdminDropdown（4 items + run_all_full danger / scheduler / reindex / stop_all / freeze）
 *   6. crawler-runs-list        — REDO-01-H 独立路由 /admin/crawler/runs（filters + table）
 *   7. crawler-page-header      — REDO-01-C PageHeader（导出 / + 新增 / 全站增量 / advanced）
 *
 * 运行方式（PLAYWRIGHT_VISUAL=1 env gate 保护，默认不参与 test:e2e）：
 *   npm run test:visual:update -- tests/visual/crawler/crawler.visual.spec.ts
 *
 * 前置（baseline 首次 capture）：
 *   1. 起 server-next dev server（:3003）+ apps/api dev server（:3001）
 *   2. 登录态：tests/visual/.auth/admin.json（已存）
 *   3. dev 数据库需有 ≥ 2 个 crawler_sites + 至少 1 个 run 历史 + sources 含 ≥ 1 active 路由
 *   4. 首跑产出 baseline PNG 后入库（PR 内人工 review）
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/visual/.auth/admin.json' })

// ── 辅助：等待 crawler 页加载 ─────────────────────────────────────────────

async function waitForCrawlerPage(page: import('@playwright/test').Page) {
  await page.goto('/admin/crawler')
  await page.waitForSelector('[data-crawler-client]', { timeout: 15000 })
  await page.waitForSelector('[data-testid="crawler-site-table"]', { timeout: 10000 }).catch(() => {})
  // 等 KPI + Timeline 首屏加载稳定
  await page.waitForTimeout(800)
}

// ── 1: KpiRow（5 张 KpiCard 横排）────────────────────────────────────────

test('crawler — kpi row', async ({ page }) => {
  await waitForCrawlerPage(page)
  await expect(page.locator('[data-crawler-kpi-row]')).toHaveScreenshot('crawler-kpi-row.png')
})

// ── 2: TimelineCard（最近 24h 时间轴 + status pill + pause toggle）───────

test('crawler — timeline card', async ({ page }) => {
  await waitForCrawlerPage(page)
  await page.waitForSelector('[data-testid="crawler-timeline-card"]', { timeout: 5000 })
  // 让 timeline grid / empty 状态稳定再截图
  await page.waitForTimeout(500)
  await expect(page.locator('[data-testid="crawler-timeline-card"]')).toHaveScreenshot('crawler-timeline-card.png')
})

// ── 3: SiteList（DataTable + search toolbar）────────────────────────────

test('crawler — site list', async ({ page }) => {
  await waitForCrawlerPage(page)
  await expect(page.locator('[data-testid="crawler-site-list"]')).toHaveScreenshot('crawler-site-list.png')
})

// ── 4: CrawlerSiteExpand（首行展开 sub-table 6 列）──────────────────────

test('crawler — site row expanded', async ({ page }) => {
  await waitForCrawlerPage(page)
  // 点击第一行 expand chevron（按 testid prefix `crawler-row-expand-`）
  const firstExpand = page.locator('[data-testid^="crawler-row-expand-"]').first()
  await firstExpand.click({ timeout: 5000 }).catch(() => {})
  // 等 expand 内容加载（routes by-site 端点）
  await page
    .locator('[data-testid^="crawler-expand-"]')
    .first()
    .waitFor({ timeout: 8000 })
    .catch(() => {})
  await page.waitForTimeout(600)
  await expect(page.locator('[data-testid^="crawler-expand-"]').first()).toHaveScreenshot(
    'crawler-site-row-expanded.png',
  )
})

// ── 5: AdvancedMenu dropdown（5 items：run_all_full / scheduler / reindex / stop_all / freeze）─

test('crawler — advanced menu dropdown', async ({ page }) => {
  await waitForCrawlerPage(page)
  await page.locator('[data-testid="crawler-advanced-trigger"]').click({ timeout: 5000 })
  await page
    .locator('[data-testid="crawler-advanced-dropdown"]')
    .waitFor({ timeout: 3000 })
    .catch(() => {})
  await page.waitForTimeout(300) // dropdown 动画
  await expect(page.locator('[data-testid="crawler-advanced-dropdown"]')).toHaveScreenshot(
    'crawler-advanced-menu.png',
  )
})

// ── 6: Runs 列表（独立路由 /admin/crawler/runs）──────────────────────────

test('crawler — runs list', async ({ page }) => {
  await page.goto('/admin/crawler/runs')
  await page.waitForSelector('[data-testid="crawler-runs-table"]', { timeout: 15000 })
  // 等过滤器 + 表格首屏稳定
  await page.waitForTimeout(800)
  await expect(page.locator('[data-testid="crawler-runs-table"]')).toHaveScreenshot(
    'crawler-runs-list.png',
  )
})

// ── 7: PageHeader（导出 / + 新增 / 全站增量 / advanced 4 actions）───────

test('crawler — page header', async ({ page }) => {
  await waitForCrawlerPage(page)
  await expect(page.locator('[data-testid="crawler-page-header"]')).toHaveScreenshot(
    'crawler-page-header.png',
  )
})
