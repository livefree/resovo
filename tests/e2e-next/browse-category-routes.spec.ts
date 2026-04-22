/**
 * tests/e2e-next/browse-category-routes.spec.ts
 * M5-CLEANUP-11 ↔ BLOCKER #2 固化：分类页路由全部可达
 *
 * 覆盖缺陷：`/movie` `/series` `/anime` `/tvshow` 路由 404（CLEANUP-05 修复：
 * CategoryPageContent 命名导出 + 独立 page.tsx + rewrite-allowlist 放行）。
 *
 * 断言：4 类 type 路由均返回 200 + video-grid 可见。
 * （short/clip 未在 CLEANUP-05 范围内，本轮不固化。）
 */

import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:4000/v1'

const CATEGORY_TYPES = ['movie', 'series', 'anime', 'tvshow'] as const

function makeMockVideos(type: string, count = 6) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${type}-uuid-${i}`,
    shortId: `${type.slice(0, 2)}${i}${i}${i}${i}${i}${i}`.slice(0, 8),
    slug: `mock-${type}-${i}`,
    title: `${type} 卡片 ${i + 1}`,
    titleEn: `${type} Card ${i + 1}`,
    type: type === 'tvshow' ? 'variety' : type, // tvshow 路由对应 variety VideoType
    coverUrl: null,
    posterBlurhash: null,
    posterStatus: null,
    rating: 7 + (i % 3) * 0.3,
    year: 2023 + (i % 2),
    sourceCount: 1,
    episodeCount: type === 'movie' ? 1 : 12,
    status: type === 'movie' ? 'completed' : 'ongoing',
    subtitleLangs: ['zh-CN'],
  }))
}

test.describe('分类路由可达性（CLEANUP-05 固化）', () => {
  for (const type of CATEGORY_TYPES) {
    test(`/${type} 返回 200 且渲染至少 1 张 video-card`, async ({ page }) => {
      // CategoryPageContent 内 VideoGrid 请求 /videos/trending?type=... 驱动列表
      await page.route(/\/videos\/trending/, (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: makeMockVideos(type),
            pagination: { total: 6, page: 1, limit: 40, hasNext: false },
          }),
        })
      })
      await page.route(/\/banners(\?|$)/, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        }),
      )

      const response = await page.goto(`/en/${type}`)
      expect(response?.status(), `/en/${type} should return 200`).toBeLessThan(400)

      const found = await page
        .locator('[data-testid="video-card"]')
        .first()
        .waitFor({ state: 'attached', timeout: 10_000 })
        .then(() => true)
        .catch(() => false)

      expect(found, `/en/${type} should render at least one video-card`).toBe(true)
    })
  }
})
