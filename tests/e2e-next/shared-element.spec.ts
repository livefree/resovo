import { test, expect } from '@playwright/test'

/**
 * SharedElement FLIP 集成测试
 *
 * 这些测试依赖真实页面（首页 + 详情页）消费 SharedElement.Source / Target。
 * 当前生产路径中暂无消费者；接入点将由 M5-PAGE-DETAIL-01 提供。
 *
 * TODO: 在 M5-PAGE-DETAIL-01 完成后移除 test.skip 并补全断言。
 */

test.describe('SharedElement FLIP — 列表 → 详情（TODO: 等待 M5-PAGE-DETAIL-01）', () => {
  test.skip('点击卡片后详情页 hero 有 FLIP 动画', async ({ page }) => {
    // Precondition: homepage must render <SharedElement.Source id="movie:X:cover">
    // and detail page must render <SharedElement.Target id="movie:X:cover">
    await page.goto('/')
    const source = page.locator('[data-shared-element-id][data-shared-element-role="source"]').first()
    await expect(source).toBeVisible()
    const id = await source.getAttribute('data-shared-element-id')
    await source.click()
    await page.waitForURL(/\/(movie|anime|series|tvshow)\//)
    const target = page.locator(`[data-shared-element-id="${id}"][data-shared-element-role="target"]`)
    await expect(target).toBeVisible()
  })

  test.skip('reduced-motion: 过渡仅 opacity 淡入，duration ≤ 120ms', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const source = page.locator('[data-shared-element-role="source"]').first()
    await source.click()
    await page.waitForURL(/\/(movie|anime|series|tvshow)\//)
    const target = page.locator('[data-shared-element-role="target"]').first()
    const anims = await target.evaluate((el) =>
      el.getAnimations().map((a) => a.effect?.getComputedTiming().duration),
    )
    for (const d of anims) expect(Number(d)).toBeLessThanOrEqual(120)
  })

  test.skip('详情页 → 播放器: hero → poster FLIP 链路', async ({ page }) => {
    await page.goto('/')
    const source = page.locator('[data-shared-element-role="source"]').first()
    await source.click()
    await page.waitForURL(/\/(movie|anime|series|tvshow)\//)
    await page.locator('[aria-label*="播放"]').first().click()
    await page.waitForURL(/\/watch\//)
    await expect(page.locator('[data-testid="player-frame-full"]')).toBeVisible({ timeout: 3000 })
  })
})

test.describe('SharedElement Registry — snapshot 生命周期（TODO: 等待 M5-PAGE-DETAIL-01）', () => {
  test.skip('导航后 Registry 不超过 64 条记录', async ({ page }) => {
    await page.goto('/')
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('End')
      await page.waitForTimeout(100)
      await page.keyboard.press('Home')
    }
    const mapSize = await page.evaluate(() => {
      const w = window as Window & { __resovoSharedElementMap?: Map<string, unknown> }
      return w.__resovoSharedElementMap?.size ?? 0
    })
    expect(mapSize).toBeLessThanOrEqual(64)
  })
})
