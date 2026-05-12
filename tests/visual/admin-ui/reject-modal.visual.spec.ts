/**
 * RejectModal visual baseline (CHG-SN-5-PRE-01-E-1 / ADR-116 §2.6)
 * 1 状态 baseline：标签单选 + 备注
 *
 * 注：Modal 受 open=true 控制，registry 强制 open，无需点击触发。
 * 整页截图（fullPage）才能完整覆盖 Modal overlay。
 */
import { test, expect } from '@playwright/test'

test('reject-modal — default', async ({ page }) => {
  await page.goto('/admin/dev/visual/reject-modal?state=default')
  await page.waitForSelector('[data-visual-demo-area]')
  await expect(page).toHaveScreenshot('reject-modal-default.png', { fullPage: true })
})
