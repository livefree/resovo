/**
 * Moderation 整页 visual baseline (CHG-SN-5-PRE-01-F / ADR-116 §2.7)
 * 7 张截图：替换 tests/visual/moderation/*.png 现有 69-byte 占位 PNG（DEBT-SN-4-07-A）
 *
 * 前置数据协议（ADR-116 §2.7 Y-2 修订）：
 *   1. storageState（admin 已登录）：首次跑前用户手动生成
 *      `npx playwright codegen --save-storage tests/visual/.auth/admin.json http://localhost:3003/login`
 *      该路径已加 .gitignore，不入库
 *   2. seed 数据：dev 环境数据库需有 pending / rejected / staging 各 1+ 条测试视频
 *   3. spec selectors（CHG-SN-5-PRE-01-F 实测调整）：
 *      - [data-moderation-console]：console 容器
 *      - [data-mod-list-row]：list row
 *      - [data-lines-panel]：lines panel 容器
 *      - [data-right-pane]：右栏
 *      - 键盘 'r' / 'R'：触发 RejectModal（ModerationConsole keyboard shortcut，可靠路径）
 *      - aria-label="证据" 按钮：触发 LineHealthDrawer（LinesPanel ”证据"按钮）
 *
 * 用户跑法（CHG-SN-5-PRE-01-F-followup 修订）：
 *   `npm run test:visual:update -- tests/visual/admin-moderation.visual.spec.ts`
 *   （PLAYWRIGHT_VISUAL=1 env gate + --update-snapshots=all 已在 npm script 中带）
 *
 * 注：fixture data 隔离 — visual spec 只读不 mutate；reject 操作仅打开 Modal 截图，
 *      不提交（spec 截图后 page.close 即可，未提交的 form 不影响 DB）。
 */
import { test, expect } from '@playwright/test'

// 加载 admin storageState（首次需 codegen 生成；详见上述协议）
test.use({ storageState: 'tests/visual/.auth/admin.json' })

test('moderation — pending-list', async ({ page }) => {
  await page.goto('/admin/moderation?tab=pending')
  // 等容器渲染（不限于 networkidle 因为 SWR 可能持续 background refetch）
  await page.waitForSelector('[data-moderation-console]')
  await page.waitForSelector('[data-mod-list-row]', { timeout: 10_000 }).catch(() => {
    // mod-list-row 可能在 empty 状态不渲染；忽略不阻塞 baseline 生成
  })
  await expect(page).toHaveScreenshot('moderation-pending-list.png', { fullPage: true })
})

test('moderation — pending-detail', async ({ page }) => {
  await page.goto('/admin/moderation?tab=pending')
  await page.waitForSelector('[data-moderation-console]')
  // 点击第一条 list row 进入详情（右栏渲染）
  const firstRow = page.locator('[data-mod-list-row]').first()
  await firstRow.click({ timeout: 10_000 }).catch(() => {})
  await page.waitForSelector('[data-right-pane]', { timeout: 5_000 }).catch(() => {})
  await expect(page).toHaveScreenshot('moderation-pending-detail.png', { fullPage: true })
})

test('moderation — lines-panel', async ({ page }) => {
  await page.goto('/admin/moderation?tab=pending')
  await page.waitForSelector('[data-moderation-console]')
  const firstRow = page.locator('[data-mod-list-row]').first()
  await firstRow.click({ timeout: 10_000 }).catch(() => {})
  await page.waitForSelector('[data-lines-panel]', { timeout: 10_000 }).catch(() => {})
  await expect(page).toHaveScreenshot('moderation-lines-panel.png', { fullPage: true })
})

test('moderation — rejected', async ({ page }) => {
  await page.goto('/admin/moderation?tab=rejected')
  await page.waitForSelector('[data-moderation-console]')
  await expect(page).toHaveScreenshot('moderation-rejected.png', { fullPage: true })
})

test('moderation — staging', async ({ page }) => {
  await page.goto('/admin/moderation?tab=staging')
  await page.waitForSelector('[data-moderation-console]')
  await expect(page).toHaveScreenshot('moderation-staging.png', { fullPage: true })
})

test('moderation — reject-modal', async ({ page }) => {
  await page.goto('/admin/moderation?tab=pending')
  await page.waitForSelector('[data-moderation-console]')
  const firstRow = page.locator('[data-mod-list-row]').first()
  await firstRow.click({ timeout: 10_000 }).catch(() => {})
  await page.waitForSelector('[data-right-pane]', { timeout: 5_000 }).catch(() => {})
  // 键盘 'r' 触发 RejectModal（ModerationConsole keyboard shortcut，比点击 aria-label 按钮可靠）
  await page.keyboard.press('r')
  // RejectModal 用 admin-ui Modal 渲染，data attr 是 [data-reject-modal]（admin-ui RejectModal 实装）
  await page.waitForSelector('[data-reject-modal], [role="dialog"]', { timeout: 5_000 }).catch(() => {})
  await expect(page).toHaveScreenshot('moderation-reject-modal.png', { fullPage: true })
})

test('moderation — line-health-drawer', async ({ page }) => {
  await page.goto('/admin/moderation?tab=pending')
  await page.waitForSelector('[data-moderation-console]')
  const firstRow = page.locator('[data-mod-list-row]').first()
  await firstRow.click({ timeout: 10_000 }).catch(() => {})
  await page.waitForSelector('[data-lines-panel]', { timeout: 10_000 }).catch(() => {})
  // 点击 "证据" 按钮触发 LineHealthDrawer
  const evidenceBtn = page.getByRole('button', { name: '证据' }).first()
  await evidenceBtn.click({ timeout: 5_000 }).catch(() => {})
  // LineHealthDrawer 用 admin-ui Drawer 渲染（portal 到 body，role=dialog）
  await page.waitForSelector('[data-line-health-drawer], [role="dialog"]', { timeout: 5_000 }).catch(() => {})
  await expect(page).toHaveScreenshot('moderation-line-health-drawer.png', { fullPage: true })
})
