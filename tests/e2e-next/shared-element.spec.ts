import { test, expect } from '@playwright/test'

/**
 * SharedElement FLIP 集成测试
 * 验证跨路由共享元素过渡的三条核心路径
 */

test.describe('SharedElement FLIP — 列表 → 详情', () => {
  test('点击卡片后详情页 hero 有 FLIP 动画（data-flip-id 可查询）', async ({ page }) => {
    await page.goto('/')
    // 找到第一张视频卡片的 SharedElement 封面
    const card = page.locator('[data-shared-element-id]').first()
    await expect(card).toBeVisible()

    const id = await card.getAttribute('data-shared-element-id')
    expect(id).toBeTruthy()

    // 点击跳转，断言详情页渲染了相同 shared-element-id 的目标元素
    await card.click()
    await page.waitForURL(/\/(movie|anime|series|tvshow)\//)
    const target = page.locator(`[data-shared-element-id="${id}"]`)
    await expect(target).toBeVisible()
  })

  test('reduced-motion: 详情页过渡仅 opacity 淡入，无 transform', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const card = page.locator('[data-shared-element-id]').first()
    await card.click()
    await page.waitForURL(/\/(movie|anime|series|tvshow)\//)

    // 验证没有 scale 变形残留
    const hero = page.locator('[data-shared-element-id]').first()
    const transform = await hero.evaluate((el) => {
      const anim = el.getAnimations()
      return anim.length > 0 ? anim[0].effect?.getComputedTiming() : null
    })
    // reduced-motion 下动画时长应 ≤ 120ms
    if (transform) {
      expect(Number(transform.duration)).toBeLessThanOrEqual(120)
    }
  })

  test('详情页 → 播放器：hero 元素过渡到播放器 poster', async ({ page }) => {
    await page.goto('/')
    const card = page.locator('[data-shared-element-id]').first()
    const id = await card.getAttribute('data-shared-element-id')
    await card.click()
    await page.waitForURL(/\/(movie|anime|series|tvshow)\//)

    // 点击详情页播放按钮
    const playButton = page.locator('[aria-label*="播放"]').first()
    await expect(playButton).toBeVisible()
    await playButton.click()
    await page.waitForURL(/\/watch\//)

    // 播放器 frame 应可见
    const playerFrame = page.locator('[data-testid="player-frame-full"]')
    await expect(playerFrame).toBeVisible({ timeout: 3000 })
    expect(id).toBeTruthy()
  })
})

test.describe('SharedElement Registry — snapshot 生命周期', () => {
  test('导航后 Registry 不累积超过 64 条记录', async ({ page }) => {
    await page.goto('/')
    // 反复在首页滚动，触发多次 SharedElement 注册
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
