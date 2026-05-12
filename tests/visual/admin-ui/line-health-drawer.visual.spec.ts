/**
 * LineHealthDrawer visual baseline (CHG-SN-5-PRE-01-E-1 / ADR-116 §2.6)
 * 1 状态 baseline：events 时间线 + 头部 BarSignal
 *
 * 注：Drawer 受 open=true 控制，registry 强制 open，无需点击触发。
 * 整页截图（fullPage）才能完整覆盖 Drawer overlay。
 */
import { test, expect } from '@playwright/test'

test('line-health-drawer — default', async ({ page }) => {
  await page.goto('/admin/dev/visual/line-health-drawer?state=default')
  await page.waitForSelector('[data-visual-demo-area]')
  // Drawer 是 portal 到 body，整页截图覆盖
  await expect(page).toHaveScreenshot('line-health-drawer-default.png', { fullPage: true })
})
