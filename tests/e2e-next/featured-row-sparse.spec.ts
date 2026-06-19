/**
 * tests/e2e-next/featured-row-sparse.spec.ts
 * CHORE-FEATUREDGRID-SPARSE 回归：首页 FeaturedRow 真实卡 < 4 时布局不塌缩
 *
 * 背景：FeaturedGrid（1.6fr+3×1fr）真实卡 < MIN_SLOTS(4) 时用 aspectRatio:'2/3' 空占位填剩余列。
 * 缺陷（修复前）：grid item 默认 min-width:auto，空占位 aspect-ratio 从被拉伸的 grid row height
 * 反推出过大 width(~416px) 挤压真实 VideoCard 列到 min-content(~27px)，poster 塌到 ~41px 高。
 * 修复：FeaturedGrid 直接子加 min-width:0，阻止空占位反推撑宽。
 */

import { test, expect } from './_fixtures'

const MOCK_ITEM = {
  id: 'uuid-fg-1',
  shortId: 'FgCard1',
  slug: 'fg-test',
  title: 'FeaturedGrid 稀疏测试',
  titleEn: 'Sparse',
  coverUrl: null,
  posterBlurhash: null,
  posterStatus: null,
  type: 'movie',
  rating: 8.0,
  year: 2024,
  status: 'ongoing',
  episodeCount: 1,
  sourceCount: 1,
  subtitleLangs: ['zh-CN'],
}

test.describe('FeaturedGrid 稀疏数据布局', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\/banners(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      }),
    )
    // 仅返回 1 张趋势卡（< MIN_SLOTS=4）→ 触发 FeaturedGrid 空占位填充路径
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
    await page.goto('/en')
    await page.waitForSelector('[data-testid="featured-grid"]', { timeout: 10_000 })
  })

  test('真实卡 <4 时 featured 区真实卡 poster 不被空占位挤垮', async ({ page }) => {
    const grid = page.locator('[data-testid="featured-grid"]')
    const firstPoster = grid.locator('[data-testid="video-card"] div.group\\/poster').first()

    // 修复前：真实卡列被空占位反推 width 挤到 ~27px，poster 高度塌到 ~41px < 100 → poll 超时
    await expect
      .poll(async () => (await firstPoster.boundingBox())?.height ?? 0, { timeout: 5_000 })
      .toBeGreaterThan(100)

    const box = await firstPoster.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return
    // 真实卡所在 1.6fr 列应远宽于 27px 塌缩值（保守 > 100px）
    expect(box.width).toBeGreaterThan(100)
    // poster 维持 2:3（高 > 宽）
    expect(box.height).toBeGreaterThan(box.width)
  })
})
