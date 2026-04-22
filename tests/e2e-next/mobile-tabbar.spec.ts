import { test, expect } from './_fixtures'

/**
 * MobileTabBar E2E — 移动端 Tab Bar 交互
 *
 * 测试需要真实页面加载和移动端视口。
 * Tab Bar 通过 CSS `@media (hover: none)` 显示，E2E 需要真实移动 UA。
 * 详细导航流由 M5-PAGE-DETAIL-01 / M5-PAGE-SEARCH-01 提供；届时移除 test.skip。
 *
 * TODO: M5-PAGE-DETAIL-01 完成后取消 skip 并补全导航断言。
 */

const MOBILE = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
}

test.describe('MobileTabBar（TODO: 等待 M5-PAGE-SEARCH-01）', () => {
  test.skip('移动端首页显示 Tab Bar', async ({ browser }) => {
    const ctx = await browser.newContext({
      ...MOBILE,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    })
    const page = await ctx.newPage()
    await page.goto('/en')
    await expect(page.getByTestId('mobile-tabbar')).toBeVisible()
    await ctx.close()
  })

  test.skip('home tab 在首页具有 aria-current="page"', async ({ browser }) => {
    const ctx = await browser.newContext({ ...MOBILE })
    const page = await ctx.newPage()
    await page.goto('/en')
    const homeTab = page.getByTestId('tabbar-home')
    await expect(homeTab).toHaveAttribute('aria-current', 'page')
    await ctx.close()
  })

  test.skip('点击 browse tab 跳转到 /browse', async ({ browser }) => {
    const ctx = await browser.newContext({ ...MOBILE })
    const page = await ctx.newPage()
    await page.goto('/en')
    await page.getByTestId('tabbar-browse').tap()
    await expect(page).toHaveURL(/\/browse/)
    const browseTab = page.getByTestId('tabbar-browse')
    await expect(browseTab).toHaveAttribute('aria-current', 'page')
    await ctx.close()
  })

  test.skip('点击 search tab 跳转到 /search', async ({ browser }) => {
    const ctx = await browser.newContext({ ...MOBILE })
    const page = await ctx.newPage()
    await page.goto('/en')
    await page.getByTestId('tabbar-search').tap()
    await expect(page).toHaveURL(/\/search/)
    await ctx.close()
  })

  test.skip('MiniPlayer 在移动端位于 Tab Bar 上方', async ({ browser }) => {
    const ctx = await browser.newContext({ ...MOBILE })
    const page = await ctx.newPage()
    await page.goto('/en/watch/test-slug')
    const miniPlayer = page.getByTestId('mini-player')
    const tabBar = page.getByTestId('mobile-tabbar')
    const mpBox = await miniPlayer.boundingBox()
    const tbBox = await tabBar.boundingBox()
    if (mpBox && tbBox) {
      expect(mpBox.y + mpBox.height).toBeLessThanOrEqual(tbBox.y)
    }
    await ctx.close()
  })
})
