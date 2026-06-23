/**
 * tests/e2e-next/featured-row-sparse.spec.ts
 * 首页 FeaturedRow 稀疏数据布局回归：真实卡 < 列数时单卡不塌缩
 *
 * 背景（CARD-SIZE-FEATURED-NORMALIZE / ADR-214 D-214-8）：FeaturedRow 已由 1.6fr+3×1fr 异宽 +
 * sparse-fill 空占位归一为 CardGrid standard 等宽网格（repeat(var(--card-cols-standard-desktop),
 * minmax(0,1fr)) + `.card-grid > * { min-width:0 }`）。等宽 + min-width:0 结构上消除"空占位反推
 * 挤垮真实卡"问题（原 CHORE-FEATUREDGRID-SPARSE 缺陷），占位逻辑随归一删除。
 * 本回归断言稀疏数据下单卡占 1 列等宽（远宽于旧塌缩值）、poster 维持 2:3，不被挤垮。
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
