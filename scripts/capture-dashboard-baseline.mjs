#!/usr/bin/env node
/**
 * capture-dashboard-baseline.mjs — CHG-DESIGN-07 7D-2 visual baseline 截图脚本
 *
 * 启动一次性 Playwright headless chromium，复刻 tests/e2e/admin/dashboard.spec.ts
 * 的 200 完整路径 mock，截图入库 tests/visual/dashboard/。
 *
 * 用法：
 *   1. 确保 server-next:3003 已启动（npm run dev）
 *   2. node scripts/capture-dashboard-baseline.mjs
 *
 * 输出：tests/visual/dashboard/*.png（≥ 8 张）
 *   - dashboard-full.png（完整页面）
 *   - row1.png / row2.png / row3.png（三行布局）
 *   - attention-card.png / workflow-card.png（row1 单卡）
 *   - metric-kpi--{default,is-warn,is-ok,is-danger}.png（row2 4 张）
 *   - recent-activity-card.png / site-health-card.png（row3 单卡）
 */

import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '..', 'tests', 'visual', 'dashboard')
const BASE = 'http://localhost:3003'
const API_BASE = 'http://localhost:4000/v1'

async function captureCard(page, selector, filename) {
  const el = await page.locator(selector).first()
  await el.scrollIntoViewIfNeeded()
  await el.screenshot({ path: path.join(OUT, filename), animations: 'disabled' })
  console.log('✓', filename)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  })

  // 注入 admin cookie（与 dashboard.spec.ts setAdminCookies 一致）
  await context.addCookies([
    { name: 'refresh_token', value: 'mock-admin-rt', domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Strict' },
    { name: 'user_role', value: 'admin', domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Strict' },
  ])

  const page = await context.newPage()

  // mock /admin/videos/moderation-stats（200 完整路径）
  await page.route(`${API_BASE}/admin/videos/moderation-stats`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: { pendingCount: 484, todayReviewedCount: 67, interceptRate: 12.3 },
      }),
    })
  })

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })

  // 等待 dashboard 渲染
  await page.waitForSelector('[data-testid="dashboard-page"]', { timeout: 10_000 })
  await page.waitForSelector('[data-dashboard-row="1"]')
  await page.waitForSelector('[data-dashboard-row="2"]')
  await page.waitForSelector('[data-dashboard-row="3"]')
  // 多等 200ms 让 spark 渲染稳定
  await page.waitForTimeout(300)

  // 整页截图
  await page.screenshot({
    path: path.join(OUT, 'dashboard-full.png'),
    fullPage: true,
    animations: 'disabled',
  })
  console.log('✓ dashboard-full.png')

  // 3 行布局
  await captureCard(page, '[data-dashboard-row="1"]', 'row1.png')
  await captureCard(page, '[data-dashboard-row="2"]', 'row2.png')
  await captureCard(page, '[data-dashboard-row="3"]', 'row3.png')

  // row1 单卡
  await captureCard(page, '[data-card="attention"]', 'attention-card.png')
  await captureCard(page, '[data-card="workflow"]', 'workflow-card.png')

  // row2 4 张 KPI（按 variant）
  await captureCard(page, '[data-kpi-card][data-variant="default"]', 'metric-kpi--default.png')
  await captureCard(page, '[data-kpi-card][data-variant="is-warn"]', 'metric-kpi--is-warn.png')
  await captureCard(page, '[data-kpi-card][data-variant="is-ok"]', 'metric-kpi--is-ok.png')
  await captureCard(page, '[data-kpi-card][data-variant="is-danger"]', 'metric-kpi--is-danger.png')

  // row3 单卡
  await captureCard(page, '[data-card="recent-activity"]', 'recent-activity-card.png')
  await captureCard(page, '[data-card="site-health"]', 'site-health-card.png')

  await browser.close()
  console.log('\n[capture-dashboard-baseline] 11 张 baseline 入库 →', OUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
