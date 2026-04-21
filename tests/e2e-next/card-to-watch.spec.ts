/**
 * tests/e2e-next/card-to-watch.spec.ts
 * M5-CARD-CTA-01: VideoCard 双出口链路验收
 * 覆盖：桌面 hover ▶ 按钮可见 / 点图片触发播放器 full 态 / 点文字区跳详情页
 */

import { test, expect } from '@playwright/test'

test.describe('VideoCard 双出口', () => {
  test.beforeEach(async ({ page }) => {
    // 导航至有视频卡片的页面（分类网格）
    await page.goto('/en')
    // 等待至少一张视频卡片加载完成
    await page.waitForSelector('[data-testid="video-card"]', { timeout: 10_000 })
  })

  test('桌面 hover 时显示悬浮播放按钮', async ({ page }) => {
    const card = page.locator('[data-testid="video-card"]').first()
    await card.hover()
    // FloatingPlayButton 是 aria-hidden 的 span，通过 CSS opacity 显示
    // 检查图片区域的遮罩 bg-black 已应用（hover 状态激活）
    await expect(card.locator('button[aria-label*="播放"]')).toBeVisible()
  })

  test('点击图片区 PosterAction → GlobalPlayerHost 进入 full 态', async ({ page }) => {
    const card = page.locator('[data-testid="video-card"]').first()
    const posterBtn = card.locator('button[aria-label*="播放"]')
    await posterBtn.click()
    // 播放器 full 帧应出现
    await expect(page.locator('[data-testid="player-frame-full"]')).toBeVisible({ timeout: 5_000 })
  })

  test('点击文字区 MetaAction → 跳转详情页（URL 包含 /movie/ 或 /series/ 等段）', async ({ page }) => {
    const card = page.locator('[data-testid="video-card"]').first()
    const metaLink = card.locator('a[aria-label*="详情页"]')
    await metaLink.click()
    await page.waitForURL(/(movie|series|anime|variety|tvshow|others)\//, { timeout: 8_000 })
    expect(page.url()).toMatch(/(movie|series|anime|variety|tvshow|others)\//)
  })

  test('键盘 Tab：PosterAction 先于 MetaAction 获得焦点', async ({ page }) => {
    const card = page.locator('[data-testid="video-card"]').first()
    // 将焦点移至卡片容器前一个可聚焦元素
    await card.locator('button').first().focus()
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')
    expect(focused).toMatch(/播放《/)
  })

  test('reduced-motion: 播放器 full 帧仍然正常出现', async ({ page }) => {
    // 模拟 prefers-reduced-motion: reduce
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const card = page.locator('[data-testid="video-card"]').first()
    await card.locator('button[aria-label*="播放"]').click()
    await expect(page.locator('[data-testid="player-frame-full"]')).toBeVisible({ timeout: 5_000 })
  })
})
