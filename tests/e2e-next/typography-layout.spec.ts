/**
 * tests/e2e-next/typography-layout.spec.ts
 * M5-CLEANUP-11 ↔ BLOCKER #7 固化：排版 / 字体 / 布局不堆叠
 *
 * CLEANUP-08 修复：body 启用 font-sans antialiased（系统字体链）；
 * VideoGrid / SearchPage gap-4 lg:gap-6 节流；VideoCard 文字区不与 tag-layer 重叠。
 *
 * ⚠️ BLOCKER-FONT 待决：design_system_plan 未定具体字体族，
 *    本 spec 只断言命中"无 serif 默认"即可（不锁定具体字体）。
 */

import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:4000/v1'

const MOCK_ITEM = {
  id: 'uuid-typo',
  shortId: 'TypoTst1',
  slug: 'typography-test-movie',
  title: '排版测试电影标题比较长确保 line-clamp 生效',
  titleEn: 'Typography Test Movie',
  coverUrl: null,
  posterBlurhash: null,
  posterStatus: null,
  type: 'movie',
  rating: 8.5,
  year: 2024,
  status: 'ongoing',
  episodeCount: 1,
  sourceCount: 2,
  subtitleLangs: ['zh-CN'],
}

async function mockHomeRoutes(page: import('@playwright/test').Page) {
  await page.route(/\/banners(\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  )
  await page.route(/\/videos\/trending/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [MOCK_ITEM],
        pagination: { total: 1, page: 1, limit: 10, hasNext: false },
      }),
    }),
  )
}

test.describe('排版 / 字体 / 布局（BLOCKER #7 固化）', () => {
  test.beforeEach(async ({ page }) => {
    await mockHomeRoutes(page)
    await page.goto('/en')
    await page.waitForSelector('[data-testid="video-card"]', { timeout: 10_000 })
  })

  test('body font-family 非 serif（已启用系统 sans 回退链）', async ({ page }) => {
    const bodyFont = await page.evaluate(() => window.getComputedStyle(document.body).fontFamily)
    const lower = bodyFont.toLowerCase()
    expect(lower).not.toMatch(/^\s*serif/)
    expect(lower).not.toMatch(/times new roman/)
    // 粗校验命中 system/ui-sans-serif / Apple / Segoe / PingFang / Noto 等任一
    expect(lower).toMatch(
      /(system-ui|ui-sans-serif|-apple-system|blinkmacsystemfont|segoe ui|pingfang|hiragino|noto|roboto|sans-serif)/,
    )
  })

  test('VideoGrid gap ≥ 16px', async ({ page }) => {
    // 找到页面中第一个含真实 video-card 的 grid 容器（排除 skeleton）
    const grid = page
      .locator(
        'div.grid:has([data-testid="video-card"]):not(:has([data-testid="video-card-skeleton"]))',
      )
      .first()
    const gridCount = await grid.count()
    test.skip(gridCount === 0, '首页暂无包含真实 video-card 的 grid 容器')
    const gap = await grid.evaluate((el) => window.getComputedStyle(el).gap)
    // gap 可能是 "16px" 或 "16px 16px" 或 "24px"（lg:gap-6）
    const gapPx = parseFloat(gap.split(' ')[0])
    expect(gapPx).toBeGreaterThanOrEqual(16)
  })

  test('VideoCard title 位于 tag-layer-top-left 下方（垂直分离）', async ({
    page,
  }) => {
    const cardWithTag = page
      .locator('[data-testid="video-card"]', {
        has: page.locator('[data-testid="tag-layer-top-left"]'),
      })
      .first()

    const tagCount = await cardWithTag.count()
    test.skip(tagCount === 0, '首页无带 lifecycle/trending 标签的卡片')

    // 等待 StackedPosterFrame 的 2:3 aspect-ratio 应用（poster 高度 ≥ 100px 才算 layout 就位）
    await expect
      .poll(
        async () => {
          const box = await cardWithTag.locator('div.group\\/poster').first().boundingBox()
          return box?.height ?? 0
        },
        { timeout: 5_000 },
      )
      .toBeGreaterThan(100)

    const tagBox = await cardWithTag
      .locator('[data-testid="tag-layer-top-left"]')
      .boundingBox()
    const titleBox = await cardWithTag.locator('p.line-clamp-1').first().boundingBox()

    expect(tagBox).not.toBeNull()
    expect(titleBox).not.toBeNull()
    if (!tagBox || !titleBox) return

    // tag 位于 title 上方或同一行起始：tag.y ≤ title.y（结构顺序：tag 在 poster，title 在下方或同层）
    expect(tagBox.y).toBeLessThanOrEqual(titleBox.y)
  })
})
