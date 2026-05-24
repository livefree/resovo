/**
 * moderation.visual.spec.ts
 * SEQ-20260502-01 FIX-CLOSE：审核台视觉 baseline（9 张截图）
 *
 * 涵盖 FIX-B/-C/-D/-F 关键 UI 状态：
 *   1. lines-panel-collapsed        — LinesPanel 聚合后折叠态（FIX-B）
 *   2. lines-panel-expanded         — LinesPanel 聚合后展开集数（FIX-B）
 *   3. right-pane-detail            — 右栏详情 Tab（FIX-C）
 *   4. right-pane-history           — 右栏历史 Tab（FIX-C）
 *   5. right-pane-similar           — 右栏类似 Tab 占位（FIX-C）
 *   6. filter-preset-popover        — 筛选预设 Popover（FIX-F）
 *   7. player-idle                  — AdminPlayer idle 占位（FIX-D）
 *   8. player-loaded                — AdminPlayer ready 状态（FIX-D，选中线路后）
 *   9. edit-drawer-open             — VideoEditDrawer 打开（FIX-A）
 *
 * 运行方式（PLAYWRIGHT_VISUAL=1 env gate 保护，默认不参与 test:e2e）：
 *   npm run test:visual:update -- tests/visual/moderation/moderation.visual.spec.ts
 *
 * 前置：
 *   1. 生成登录态：npx playwright codegen --save-storage tests/visual/.auth/admin.json http://localhost:3003/login
 *   2. dev 数据库需有 pending 视频且有多线路 sources（含活跃源）
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/visual/.auth/admin.json' })

// ── 辅助：等待审核台加载 ─────────────────────────────────────────────────

async function waitForConsole(page: import('@playwright/test').Page) {
  await page.goto('/admin/moderation?tab=pending')
  await page.waitForSelector('[data-testid="moderation-split"]', { timeout: 15000 })
  await page.waitForSelector('[data-mod-list-row]', { timeout: 10000 }).catch(() => {})
}

async function selectFirstVideo(page: import('@playwright/test').Page) {
  const row = page.locator('[data-mod-list-row]').first()
  await row.click({ timeout: 8000 }).catch(() => {})
  await page.waitForSelector('[data-right-pane]', { timeout: 5000 }).catch(() => {})
}

// ── 1: LinesPanel 折叠态 ─────────────────────────────────────────────────

test('lines-panel — collapsed', async ({ page }) => {
  await waitForConsole(page)
  await selectFirstVideo(page)
  await page.waitForSelector('[data-line-row]', { timeout: 8000 }).catch(() => {})
  await expect(page.locator('[data-lines-panel]')).toHaveScreenshot('lines-panel-collapsed.png')
})

// ── 2: LinesPanel 展开集数态 ─────────────────────────────────────────────

test('lines-panel — expanded episodes', async ({ page }) => {
  await waitForConsole(page)
  await selectFirstVideo(page)
  await page.waitForSelector('[data-line-row]', { timeout: 8000 }).catch(() => {})
  // 点击第一个线路行的展开按钮
  await page.locator('[data-line-row]').first().locator('button').first().click()
  await page.waitForSelector('[data-episode-row]', { timeout: 3000 }).catch(() => {})
  await expect(page.locator('[data-lines-panel]')).toHaveScreenshot('lines-panel-expanded.png')
})

// ── 3: 右栏详情 Tab ──────────────────────────────────────────────────────

test('right-pane — detail tab', async ({ page }) => {
  await waitForConsole(page)
  await selectFirstVideo(page)
  const tablist = page.getByRole('tablist', { name: '详情/历史/类似' })
  await tablist.waitFor({ timeout: 5000 })
  await tablist.getByRole('tab', { name: '详情' }).click()
  await expect(page.locator('[data-right-pane]')).toHaveScreenshot('right-pane-detail.png')
})

// ── 4: 右栏历史 Tab ──────────────────────────────────────────────────────

test('right-pane — history tab', async ({ page }) => {
  await waitForConsole(page)
  await selectFirstVideo(page)
  const tablist = page.getByRole('tablist', { name: '详情/历史/类似' })
  await tablist.waitFor({ timeout: 5000 })
  await tablist.getByRole('tab', { name: '历史' }).click()
  // 等 audit log 加载
  await page.waitForTimeout(1000)
  await expect(page.locator('[data-right-pane]')).toHaveScreenshot('right-pane-history.png')
})

// ── 5: 右栏类似 Tab ──────────────────────────────────────────────────────

test('right-pane — similar tab placeholder', async ({ page }) => {
  await waitForConsole(page)
  await selectFirstVideo(page)
  const tablist = page.getByRole('tablist', { name: '详情/历史/类似' })
  await tablist.waitFor({ timeout: 5000 })
  await tablist.getByRole('tab', { name: '类似' }).click()
  await expect(page.locator('[data-right-pane]')).toHaveScreenshot('right-pane-similar.png')
})

// ── 6: 筛选预设 Popover ──────────────────────────────────────────────────

test('filter-preset — popover open', async ({ page }) => {
  await waitForConsole(page)
  await page.getByRole('button', { name: /筛选预设/ }).click()
  await page.waitForTimeout(300)  // popover 动画
  await expect(page.locator('[data-filter-preset-trigger]')).toHaveScreenshot('filter-preset-popover.png', {
    // 截取 popover 锚点区域，使用 clip 展示 popover 全貌
  })
})

// ── 7: AdminPlayer idle 状态 ─────────────────────────────────────────────

test('player — idle placeholder', async ({ page }) => {
  await waitForConsole(page)
  await selectFirstVideo(page)
  await page
    .locator('[data-admin-player]')
    .waitFor({ timeout: 8000 })
    .catch(() => {})
  await page.waitForTimeout(800)
  // CHG-SN-7-MISC-VISUAL-FOLLOWUP-BATCH 实测：LinesPanel useEffect line 75-84 auto-select
  // 第一条 active line + 首个 active episode → AdminPlayer 默认 state=ready 而非 idle。
  // 触发 idle 需：(a) dev DB seed 无活跃线路视频 或 (b) LinesPanel 移除 auto-select 默认行为。
  // 当前 dev DB pending 视频全有活跃线路，spec conditional skip 直到上述任一条件成立。
  const state = await page.locator('[data-admin-player]').first().getAttribute('data-state')
  if (state !== 'idle') {
    test.skip(true, `AdminPlayer state="${state}"（非 idle）；LinesPanel auto-select 阻止 idle baseline / 需 dev DB seed 无活跃线路视频 或 重构 LinesPanel`)
  }
  await expect(page.locator('[data-admin-player][data-state="idle"]')).toHaveScreenshot(
    'player-idle.png',
  )
})

// ── 8: AdminPlayer ready 状态（选中活跃线路后）───────────────────────────

test('player — loaded after line selection', async ({ page }) => {
  await waitForConsole(page)
  await selectFirstVideo(page)
  await page.waitForSelector('[data-line-row]', { timeout: 8000 }).catch(() => {})
  // 点击第一条线路
  await page.locator('[data-line-row]').first().click()
  await page.locator('[data-admin-player][data-state="ready"]').waitFor({ timeout: 5000 }).catch(() => {})
  await expect(page.locator('[data-admin-player]')).toHaveScreenshot('player-loaded.png')
})

// ── 9: VideoEditDrawer 打开 ──────────────────────────────────────────────

test('edit-drawer — open state', async ({ page }) => {
  await waitForConsole(page)
  await selectFirstVideo(page)
  await page.getByRole('button', { name: '打开视频编辑' }).first().click()
  await page.waitForSelector('[data-testid="data-video-edit-drawer"]', { timeout: 5000 }).catch(() => {})
  await expect(page.locator('[data-testid="data-video-edit-drawer"]')).toHaveScreenshot('edit-drawer-open.png')
})
