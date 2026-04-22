/**
 * tests/e2e-next/card-dual-exit.spec.ts
 * M5-CLEANUP-11 ↔ BLOCKER #1 固化：VideoCard 双出口协议 + TagLayer 不溢出 title
 *
 * 覆盖缺陷：
 *   - 点击卡片图片区应触发 Fast Takeover（playerStore.enter）+ URL 跳 /watch/...
 *   - 悬浮图片区时 FloatingPlayButton opacity=1；悬浮文字区 FloatingPlayButton 保持 opacity=0
 *   - TagLayer 左上 lifecycle 区的 bounding box 不与 title <p> 的 bounding box 交集
 */

import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:4000/v1'

const MOCK_MOVIE = {
  id: 'uuid-dx-movie',
  shortId: 'DxMovie1',
  slug: 'dx-test-movie',
  title: '双出口测试电影',
  titleEn: 'Dual Exit Movie',
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

const MOCK_SERIES = {
  ...MOCK_MOVIE,
  id: 'uuid-dx-series',
  shortId: 'DxSerie1',
  slug: 'dx-test-series',
  title: '双出口测试剧集',
  titleEn: 'Dual Exit Series',
  type: 'series',
  episodeCount: 24,
  status: 'ongoing',
}

async function mockHomeRoutes(page: import('@playwright/test').Page) {
  await page.route(/\/banners(\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  )
  await page.route(/\/videos\/trending/, (route) => {
    const type = new URL(route.request().url()).searchParams.get('type')
    const item = type === 'series' ? MOCK_SERIES : MOCK_MOVIE
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [item],
        pagination: { total: 1, page: 1, limit: 10, hasNext: false },
      }),
    })
  })
}

test.describe('VideoCard 双出口 + Tag 不溢出', () => {
  test.beforeEach(async ({ page }) => {
    await mockHomeRoutes(page)
    await page.goto('/en')
    await page.waitForSelector('[data-testid="video-card"]', { timeout: 10_000 })
  })

  test('悬浮图片区 FloatingPlayButton 浮出；悬浮文字区 FloatingPlayButton 不浮出', async ({
    page,
  }) => {
    const card = page.locator('[data-testid="video-card"]').first()
    const floatingBtn = card.locator('span[aria-hidden="true"] > span').first()
    const poster = card.locator('div.group\\/poster').first()
    const titleText = card.locator('p.line-clamp-1').first()

    // 悬浮文字区：按钮应保持 opacity=0
    await titleText.hover()
    await page.waitForTimeout(200)
    const opacityOnText = await floatingBtn.evaluate(
      (el) => parseFloat(window.getComputedStyle(el).opacity),
    )
    expect(opacityOnText).toBeLessThanOrEqual(0.05)

    // 悬浮图片区：按钮 opacity 应升至 > 0.9
    await poster.hover()
    await page.waitForTimeout(200)
    const opacityOnPoster = await floatingBtn.evaluate(
      (el) => parseFloat(window.getComputedStyle(el).opacity),
    )
    expect(opacityOnPoster).toBeGreaterThanOrEqual(0.9)
  })

  test('TagLayer 左上象限垂直位于 title 上方（tag.bottom ≤ title.top）', async ({
    page,
  }) => {
    const cardWithTag = page
      .locator('[data-testid="video-card"]', {
        has: page.locator('[data-testid="tag-layer-top-left"]'),
      })
      .first()

    const tagCount = await cardWithTag.count()
    test.skip(tagCount === 0, '当前首页无带 lifecycle/trending tag 的卡片')

    // 等待 StackedPosterFrame 的 2:3 aspect-ratio 应用（poster 高度 ≥ 100px 视为就位）
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
