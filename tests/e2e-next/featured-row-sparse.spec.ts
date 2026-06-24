/**
 * tests/e2e-next/featured-row-sparse.spec.ts
 * 首页 FeaturedRow 稀疏数据布局回归：真实卡 < 容量时单卡精确定宽 + 居中、不塌缩
 *
 * 背景（CARD-SIZE-FEATURED-NORMALIZE / ADR-214 D-214-8 + Amendment A2 D-214-A2-2/3）：FeaturedRow 已由
 * 1.6fr+3×1fr 异宽 + sparse-fill 空占位归一为 CardGrid global 精确定宽网格
 * （`repeat(auto-fit, min(var(--card-w),100%))` + `justify-content:center` + `.card-grid > * { min-width:0 }`）。
 * A2 精确定宽 + auto-fit 折叠尾部空轨道 → 卡少时单卡恒为 W(160px)、整排居中，结构上消除"空占位反推
 * 挤垮真实卡"问题（原 CHORE-FEATUREDGRID-SPARSE 缺陷）。
 * 本回归断言稀疏数据下单卡精确 = W、poster 维持 2:3、整排居中（左侧留白 > 0），不被挤垮。
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

  test('单卡（< 容量）精确定宽 = W + 整排居中 + poster 维持 2:3', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    const grid = page.locator('[data-testid="featured-grid"]')
    const card = grid.locator('[data-testid="video-card"]').first()
    const firstPoster = card.locator('div.group\\/poster').first()

    // 修复前：真实卡列被空占位反推 width 挤到 ~27px，poster 高度塌到 ~41px < 100 → poll 超时
    await expect
      .poll(async () => (await firstPoster.boundingBox())?.height ?? 0, { timeout: 5_000 })
      .toBeGreaterThan(100)

    // A2 精确定宽：单卡 border-box 宽精确 = 注入 --card-w（auto-fit 折叠空轨道、卡宽恒 W，不塌缩/不拉伸）
    const injected = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w')),
    )
    const cardBox = await card.boundingBox()
    expect(cardBox).not.toBeNull()
    if (!cardBox) return
    expect(Math.round(cardBox.width)).toBe(injected)

    // 整排居中（D-214-A2-3）：单卡远窄于容器 → 左侧留白 > 0（justify-content:center）
    const gridBox = await grid.boundingBox()
    expect(gridBox).not.toBeNull()
    if (!gridBox) return
    expect(cardBox.x - gridBox.x).toBeGreaterThan(0)

    // poster 维持 2:3（高 > 宽）
    const posterBox = await firstPoster.boundingBox()
    expect(posterBox).not.toBeNull()
    if (posterBox) expect(posterBox.height).toBeGreaterThan(posterBox.width)
  })
})
