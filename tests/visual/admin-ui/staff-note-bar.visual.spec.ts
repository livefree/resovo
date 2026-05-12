/**
 * StaffNoteBar visual baseline (CHG-SN-5-PRE-01-E-1 / ADR-116 §2.6)
 * 2 变体 baseline：display / edit
 */
import { test, expect } from '@playwright/test'

const VARIANTS = ['display', 'edit'] as const

for (const variant of VARIANTS) {
  test(`staff-note-bar — ${variant}`, async ({ page }) => {
    await page.goto(`/admin/dev/visual/staff-note-bar?state=${variant}`)
    await page.waitForSelector('[data-visual-demo-area]')
    await expect(page.locator('[data-visual-demo-area]')).toHaveScreenshot(
      `staff-note-bar-${variant}.png`,
    )
  })
}
