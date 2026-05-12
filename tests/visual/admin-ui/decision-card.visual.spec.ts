/**
 * DecisionCard visual baseline (CHG-SN-5-PRE-01-E-1 / ADR-116 §2.6)
 * 3 状态 baseline：pending / approved / rejected
 */
import { test, expect } from '@playwright/test'

const STATES = ['pending', 'approved', 'rejected'] as const

for (const state of STATES) {
  test(`decision-card — ${state}`, async ({ page }) => {
    await page.goto(`/admin/dev/visual/decision-card?state=${state}`)
    await page.waitForSelector('[data-visual-demo-area]')
    await expect(page.locator('[data-visual-demo-area]')).toHaveScreenshot(
      `decision-card-${state}.png`,
    )
  })
}
