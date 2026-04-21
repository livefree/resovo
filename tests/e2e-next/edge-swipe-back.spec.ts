import { test, expect } from '@playwright/test'

/**
 * RouteStack 边缘返回手势 — E2E（移动端模拟）
 *
 * 测试需要真实的多页面导航路径（首页 → 详情页）。
 * 详情页消费者由 M5-PAGE-DETAIL-01 提供；届时移除 test.skip。
 *
 * TODO: M5-PAGE-DETAIL-01 完成后取消 skip 并补全导航断言。
 */

const MOBILE = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
}

test.describe('边缘返回手势（TODO: 等待 M5-PAGE-DETAIL-01）', () => {
  test.skip('左边缘右滑 > 30% 屏宽 → router.back()', async ({ browser }) => {
    const ctx = await browser.newContext({
      ...MOBILE,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    })
    const page = await ctx.newPage()

    // Navigate to a page inside RouteStack (detail page once available)
    await page.goto('/movie/demo-slug')
    await page.waitForLoadState('networkidle')

    const url0 = page.url()

    // Simulate left-edge swipe: start x=10, end x=160 (> 30% of 390=117px)
    await page.touchscreen.tap(10, 400)
    await page
      .locator('body')
      .dispatchEvent('touchstart', {
        touches: [{ clientX: 10, clientY: 400, identifier: 0 }],
      })
    await page.locator('body').dispatchEvent('touchmove', {
      touches: [{ clientX: 160, clientY: 400, identifier: 0 }],
    })
    await page.locator('body').dispatchEvent('touchend', { touches: [] })

    // Should navigate back
    await page.waitForURL((url) => url.toString() !== url0, { timeout: 2000 })
    expect(page.url()).not.toBe(url0)
    await ctx.close()
  })

  test.skip('左边缘右滑 < 阈值 → 不触发返回', async ({ browser }) => {
    const ctx = await browser.newContext(MOBILE)
    const page = await ctx.newPage()
    await page.goto('/movie/demo-slug')
    const url0 = page.url()

    await page.locator('body').dispatchEvent('touchstart', {
      touches: [{ clientX: 10, clientY: 400, identifier: 0 }],
    })
    await page.locator('body').dispatchEvent('touchmove', {
      touches: [{ clientX: 60, clientY: 400, identifier: 0 }],
    })
    await page.locator('body').dispatchEvent('touchend', { touches: [] })

    await page.waitForTimeout(300)
    expect(page.url()).toBe(url0)
    await ctx.close()
  })

  test.skip('非边缘区域（startX > 20px）不触发手势', async ({ browser }) => {
    const ctx = await browser.newContext(MOBILE)
    const page = await ctx.newPage()
    await page.goto('/movie/demo-slug')
    const url0 = page.url()

    await page.locator('body').dispatchEvent('touchstart', {
      touches: [{ clientX: 50, clientY: 400, identifier: 0 }],
    })
    await page.locator('body').dispatchEvent('touchmove', {
      touches: [{ clientX: 250, clientY: 400, identifier: 0 }],
    })
    await page.locator('body').dispatchEvent('touchend', { touches: [] })

    await page.waitForTimeout(300)
    expect(page.url()).toBe(url0)
    await ctx.close()
  })

  test.skip('桌面端（hover:hover）不触发手势', async ({ page }) => {
    // Default desktop context: no touch, hover:hover
    await page.goto('/movie/demo-slug')
    const url0 = page.url()

    await page.locator('body').dispatchEvent('touchstart', {
      touches: [{ clientX: 10, clientY: 400, identifier: 0 }],
    })
    await page.locator('body').dispatchEvent('touchmove', {
      touches: [{ clientX: 200, clientY: 400, identifier: 0 }],
    })
    await page.locator('body').dispatchEvent('touchend', { touches: [] })

    await page.waitForTimeout(300)
    expect(page.url()).toBe(url0)
  })

  test.skip('reduced-motion: 瞬移返回，无 transform 动画', async ({ browser }) => {
    const ctx = await browser.newContext({
      ...MOBILE,
      reducedMotion: 'reduce',
    })
    const page = await ctx.newPage()
    await page.goto('/movie/demo-slug')

    await page.locator('body').dispatchEvent('touchstart', {
      touches: [{ clientX: 10, clientY: 400, identifier: 0 }],
    })
    await page.locator('body').dispatchEvent('touchmove', {
      touches: [{ clientX: 200, clientY: 400, identifier: 0 }],
    })
    await page.locator('body').dispatchEvent('touchend', { touches: [] })

    // No transform animation on RouteStack container
    const hasTransform = await page.evaluate(() => {
      const el = document.querySelector('[data-routestack-container]')
      if (!el) return false
      return el.getAnimations().some((a) => {
        const kf = a.effect?.getKeyframes?.()
        return kf?.some((k) => typeof k['transform'] === 'string')
      })
    })
    expect(hasTransform).toBe(false)
    await ctx.close()
  })
})
