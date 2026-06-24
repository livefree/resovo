/**
 * tests/e2e-next/browse-tvshow.spec.ts
 * M2-E2E-01: variety→tvshow URL 改名覆盖
 * - /tvshow/* 详情页可访问
 * - /variety/* → /tvshow/* 308 重定向
 * - 视频卡片 href 为 /tvshow/...（variety 类型）
 * - 浏览页 ?type=tvshow 请求发送 type=variety 给 API
 */

import { test, expect } from './_fixtures'

const API_BASE = 'http://localhost:4000/v1'

const MOCK_TVSHOW = {
  id: 'uuid-tvshow-1',
  shortId: 'tV1sHoW1',
  slug: 'test-tvshow-tV1sHoW1',
  title: '测试综艺',
  titleEn: 'Test TV Show',
  coverUrl: null,
  // CARD-SIZE-BROWSE-MIGRATE：BrowseGrid 卡改渲 VideoCard navigate（StackedPosterFrame/TagLayer），
  // 需 posterStatus/posterBlurhash/subtitleLangs（读 subtitleLangs.length）；对齐 BrowseGrid.test fixture。
  posterStatus: null,
  posterBlurhash: null,
  subtitleLangs: ['zh-CN'],
  type: 'variety',
  rating: 7.5,
  year: 2024,
  status: 'ongoing',
  episodeCount: 12,
  sourceCount: 1,
}

// ═══════════════════════════════════════════════════════════════════
// 重定向：/variety/* → /tvshow/*
// ═══════════════════════════════════════════════════════════════════

test.describe('variety → tvshow 308 重定向', () => {
  test('/variety/xxx 永久重定向（308）到 /tvshow/xxx', async ({ page }) => {
    const slug = 'test-tvshow-tV1sHoW1'

    // 详情页为 SSR（fetchVideoDetail 直连 API，404 即 notFound），client 侧 page.route 对落地页取数
    // 无效；本用例只校验「variety→tvshow 308 重定向契约」本身，不依赖伪 slug 的 SSR 落地渲染。
    const response = await page.goto(`/en/variety/${slug}`)

    // 终态 URL 落在 /tvshow/，已脱离 /variety/
    expect(page.url()).toContain('/tvshow/')
    expect(page.url()).not.toContain('/variety/')

    // 重定向为 308 永久（ADR-048/042 D6）：从 /variety/ 请求 308 跳到 /tvshow/
    const redirectedFrom = response?.request().redirectedFrom()
    expect(redirectedFrom, '应存在来自 /variety/ 的重定向请求').not.toBeNull()
    expect(redirectedFrom!.url()).toContain('/variety/')
    const redirectResponse = await redirectedFrom!.response()
    expect(redirectResponse?.status()).toBe(308)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 分类卡片 href：variety 类型 → /tvshow/...
// E2E-AUDIT-FIX-20260620 P2：随 HANDOFF-15 重构改测当前 mockable 的分类页（/tvshow →
// BrowseGrid 客户端 /videos? → BrowseCard，href=getVideoDetailHref，variety→/tvshow/）。
// 首页卡走 SSR /home/shelf 聚合（容器 movie-grid/series-grid），非本契约的稳定校验点。
// ═══════════════════════════════════════════════════════════════════

test.describe('分类卡片 href 使用 /tvshow/ 前缀', () => {
  test('variety 视频卡片链接包含 /tvshow/（不含 /variety/）', async ({ page }) => {
    await page.route(`${API_BASE}/**`, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'not mocked', status: 404 } }),
      }),
    )
    await page.route(/\/videos\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [MOCK_TVSHOW],
          pagination: { total: 1, page: 1, limit: 10, hasNext: false },
        }),
      })
    })

    await page.goto('/en/tvshow')
    // CARD-SIZE-BROWSE-MIGRATE：VideoCard navigate 分支根 <Link>(<a>) 挂 data-testid="video-card"
    const card = page.getByTestId('video-card').first()
    await expect(card).toBeVisible({ timeout: 10000 })

    const href = await card.getAttribute('href')
    expect(href).toMatch(/\/tvshow\//)
    expect(href).not.toMatch(/\/variety\//)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 分类页 /tvshow → API 接收 type=variety（ALL_CATEGORIES SSOT 映射）
// ═══════════════════════════════════════════════════════════════════

test.describe('分类页 /tvshow 别名映射', () => {
  test('/tvshow 分类页 BrowseGrid 请求发送 type=variety', async ({ page }) => {
    await page.route(`${API_BASE}/**`, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'not mocked', status: 404 } }),
      }),
    )
    await page.route(/\/videos\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [MOCK_TVSHOW],
          pagination: { total: 1, page: 1, limit: 10, hasNext: false },
        }),
      })
    })

    // 捕获 BrowseGrid 客户端首次 /videos? 请求（initialType=variety 强制覆盖）
    const videosReqPromise = page.waitForRequest(/\/videos\?/)
    await page.goto('/en/tvshow')
    const videosReq = await videosReqPromise

    expect(videosReq.url()).toContain('type=variety')
    expect(videosReq.url()).not.toContain('type=tvshow')

    // 统一筛选区 type 行高亮 variety（activeType 经 pathname tvshow→variety 映射，HANDOFF-40B）
    await expect(page.getByTestId('filter-type-variety')).toHaveAttribute('aria-checked', 'true')
  })
})
