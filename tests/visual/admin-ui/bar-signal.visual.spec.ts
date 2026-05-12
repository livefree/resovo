/**
 * BarSignal visual baseline (CHG-SN-5-PRE-01-E-1 / ADR-116 §2.6)
 *
 * 5 状态 baseline：ok / partial / dead / pending / unknown
 *
 * 跑法（用户在 PRE-01-E-2 执行）：
 *   1. 启 server-next dev: `NEXT_PUBLIC_ASSET_PREFIX="" npm --workspace @resovo/server-next run dev`
 *   2. 跑 update-snapshots: `npx playwright test --project=admin-visual --update-snapshots bar-signal`
 *   3. git add tests/visual/admin-ui/bar-signal.visual.spec.ts-snapshots/*.png
 *
 * 注：dev/visual 路由 dev-only，生产 notFound 双层守卫；ADR-116 §2.3。
 */
import { test, expect } from '@playwright/test'

const STATES = ['ok', 'partial', 'dead', 'pending', 'unknown'] as const

for (const state of STATES) {
  test(`bar-signal — ${state}`, async ({ page }) => {
    await page.goto(`/admin/dev/visual/bar-signal?state=${state}`)
    // 等组件渲染（BarSignal 自带 data-bar-signal 属性或子元素）
    await page.waitForSelector('[data-visual-demo-area]')
    await expect(page.locator('[data-visual-demo-area]')).toHaveScreenshot(
      `bar-signal-${state}.png`,
    )
  })
}
