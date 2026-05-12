/**
 * Moderation 整页 visual baseline (CHG-SN-5-PRE-01-E-1 / ADR-116 §2.7)
 * 7 张截图：替换 tests/visual/moderation/*.png 现有 69-byte 占位 PNG（DEBT-SN-4-07-A）
 *
 * 前置数据协议（ADR-116 §2.7 Y-2 修订）：
 *   1. storageState（admin 已登录）：首次跑前用户手动生成
 *      `npx playwright codegen --save-storage tests/visual/.auth/admin.json http://localhost:3003/login`
 *      该路径已加 .gitignore，不入库
 *   2. seed 数据：dev 环境数据库需有 pending / rejected / staging 各 1+ 条测试视频
 *      （后续若需稳定 seed，独立卡 scripts/seed-moderation-visual-test-data.ts）
 *   3. modal/drawer 截图：spec 含 page.click + waitForSelector 才能截到打开状态
 *
 * 用户跑法（PRE-01-F，CHG-SN-5-PRE-01-E-1-followup-3 修订）：
 *   `npm run test:visual:update -- tests/visual/admin-moderation.visual.spec.ts`
 *   （PLAYWRIGHT_VISUAL=1 env gate + --update-snapshots=all 已在 npm script 中带；
 *   用 positional 路径过滤，避免 --update-snapshots 后跟 positional 被误识为 mode）
 *
 * 注：fixture data 隔离 — visual spec 只读不 mutate；reject 操作放 test.afterEach 清理
 *      或在隔离测试数据集外操作。
 */
import { test, expect } from '@playwright/test'

// 加载 admin storageState（首次需 codegen 生成；详见上述协议）
test.use({ storageState: 'tests/visual/.auth/admin.json' })

test('moderation — pending-list', async ({ page }) => {
  await page.goto('/admin/moderation?tab=pending')
  // 等待列表渲染（具体 selector 由 PRE-01-F 实施时按 moderation 页面 DOM 调整）
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('moderation-pending-list.png', { fullPage: true })
})

test('moderation — pending-detail', async ({ page }) => {
  await page.goto('/admin/moderation?tab=pending')
  await page.waitForLoadState('networkidle')
  // 点击第一条进入详情；selector 在 PRE-01-F 实施时定位
  const firstRow = page.locator('[data-row]').first()
  await firstRow.click()
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('moderation-pending-detail.png', { fullPage: true })
})

test('moderation — lines-panel', async ({ page }) => {
  await page.goto('/admin/moderation?tab=pending')
  await page.waitForLoadState('networkidle')
  // PRE-01-F 实施时调整 selector / 操作链
  await expect(page).toHaveScreenshot('moderation-lines-panel.png', { fullPage: true })
})

test('moderation — rejected', async ({ page }) => {
  await page.goto('/admin/moderation?tab=rejected')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('moderation-rejected.png', { fullPage: true })
})

test('moderation — staging', async ({ page }) => {
  await page.goto('/admin/moderation?tab=staging')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('moderation-staging.png', { fullPage: true })
})

test('moderation — reject-modal', async ({ page }) => {
  await page.goto('/admin/moderation?tab=pending')
  await page.waitForLoadState('networkidle')
  // 点击拒绝按钮 → 打开 Modal；selector 在 PRE-01-F 实施时定位
  // 例：await page.click('[data-reject-button]')
  //    await page.waitForSelector('[data-reject-modal]')
  await expect(page).toHaveScreenshot('moderation-reject-modal.png', { fullPage: true })
})

test('moderation — line-health-drawer', async ({ page }) => {
  await page.goto('/admin/moderation?tab=pending')
  await page.waitForLoadState('networkidle')
  // 点击线路健康指示器 → 打开 Drawer；selector 在 PRE-01-F 实施时定位
  await expect(page).toHaveScreenshot('moderation-line-health-drawer.png', { fullPage: true })
})
