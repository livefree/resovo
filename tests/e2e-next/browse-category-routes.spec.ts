/**
 * tests/e2e-next/browse-category-routes.spec.ts
 * M5-CLEANUP-11 ↔ BLOCKER #2 固化：分类页路由全部可达
 *
 * 覆盖缺陷：`/movie` `/series` `/anime` `/tvshow` 路由 404（CLEANUP-05 修复：
 * CategoryPageContent 命名导出 + 独立 page.tsx + rewrite-allowlist 放行）。
 *
 * 断言：4 类 type 路由均返回 200 + 至少 1 张 browse-card 渲染（BrowseGrid → /videos?type=）。
 * （short/clip 未在 CLEANUP-05 范围内，本轮不固化。）
 * E2E-AUDIT-FIX-20260620 P2：随 HANDOFF-15 分类页重构同步——端点 /videos/trending→/videos，
 * 卡 testid video-card→browse-card（BrowseCard）。
 */

import { test, expect } from './_fixtures'

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
    test(`/${type} 返回 200 且渲染至少 1 张 browse-card`, async ({ page }) => {
      // 兜底 404：未 mock 端点（facets / 图片 CDN 等）返回 404，避免真实 CDN 图阻塞 load
      // （先注册 = 最低优先级；homepage.spec 同范式）。
      await page.route(`${API_BASE}/**`, (route) =>
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'not mocked', status: 404 } }),
        }),
      )
      // CategoryPageContent → BrowseGrid 客户端请求 GET /videos?type=<videoType>&... 驱动列表
      // （HANDOFF-15 重构：VideoGrid + /videos/trending + video-card → BrowseGrid + /videos + browse-card）。
      await page.route(/\/videos\?/, (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: makeMockVideos(type),
            pagination: { total: 6, page: 1, limit: 40, hasNext: false },
          }),
        })
      })

      const response = await page.goto(`/en/${type}`)
      expect(response?.status(), `/en/${type} should return 200`).toBeLessThan(400)

      const found = await page
        .locator('[data-testid="browse-card"]')
        .first()
        .waitFor({ state: 'attached', timeout: 10_000 })
        .then(() => true)
        .catch(() => false)

      expect(found, `/en/${type} should render at least one browse-card`).toBe(true)
    })
  }
})
