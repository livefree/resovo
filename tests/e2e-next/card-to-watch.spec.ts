/**
 * tests/e2e-next/card-to-watch.spec.ts
 * M5-CARD-CTA-01: VideoCard 双出口链路验收
 * 覆盖：点图片触发播放器 full 态且 URL 更新至 /watch/；点文字区跳详情页；Tab 顺序
 */

import { test, expect } from '@playwright/test'

test.describe('VideoCard 双出口', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en')
    await page.waitForSelector('[data-testid="video-card"]', { timeout: 10_000 })
  })

  test('点击图片区 PosterAction → player-frame-full 出现 + URL 更新为 /watch/', async ({ page }) => {
    const card = page.locator('[data-testid="video-card"]').first()
    await card.locator('button[aria-label*="播放"]').click()

    // player overlay 应出现
    await expect(page.locator('[data-testid="player-frame-full"]')).toBeVisible({ timeout: 5_000 })

    // URL 必须更新到 /watch/... （ADR-042 + ADR-048 §2 契约）
    await expect(page).toHaveURL(/\/watch\//, { timeout: 5_000 })
    expect(page.url()).toMatch(/[?&]ep=1/)
  })

  test('点击文字区 MetaAction → 跳转详情页，URL 不含 /watch/', async ({ page }) => {
    const card = page.locator('[data-testid="video-card"]').first()
    await card.locator('a[aria-label*="详情页"]').click()
    await page.waitForURL(/(movie|series|anime|variety|tvshow|others)\//, { timeout: 8_000 })
    expect(page.url()).not.toMatch(/\/watch\//)
  })

  test('Tab 顺序：article 内 button(PosterAction) 先于 a(MetaAction)', async ({ page }) => {
    // 检查 DOM 中的焦点顺序而非依赖 Tab 键计数
    const tabOrder = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="video-card"]')
      if (!card) return []
      return Array.from(card.querySelectorAll('button, a')).map((el) => el.tagName)
    })
    expect(tabOrder[0]).toBe('BUTTON')
    expect(tabOrder[1]).toBe('A')
  })

  test('reduced-motion: 播放器仍出现且 URL 更新', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const card = page.locator('[data-testid="video-card"]').first()
    await card.locator('button[aria-label*="播放"]').click()
    await expect(page.locator('[data-testid="player-frame-full"]')).toBeVisible({ timeout: 5_000 })
    await expect(page).toHaveURL(/\/watch\//, { timeout: 5_000 })
  })
})
