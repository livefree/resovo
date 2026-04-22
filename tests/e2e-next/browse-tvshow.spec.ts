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
  test('/variety/xxx 重定向到 /tvshow/xxx', async ({ page }) => {
    const slug = 'test-tvshow-tV1sHoW1'
    let interceptedUrl = ''

    await page.route(`${API_BASE}/videos/**`, (route) => {
      interceptedUrl = route.request().url()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: MOCK_TVSHOW,
          episodes: [],
        }),
      })
    })

    const response = await page.goto(`/en/variety/${slug}`, { waitUntil: 'commit' })
    // 308 重定向后最终 URL 应为 /tvshow/...
    expect(page.url()).toContain('/tvshow/')
    expect(page.url()).not.toContain('/variety/')
    // HTTP 状态码：最终落地页（跟随重定向后）为 200
    expect(response?.status()).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 视频卡片 href：variety 类型 → /tvshow/...
// ═══════════════════════════════════════════════════════════════════

test.describe('VideoCard href 使用 /tvshow/ 前缀', () => {
  test('首页 variety 视频卡片链接包含 /tvshow/', async ({ page }) => {
    await page.route(`${API_BASE}/videos/trending*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [MOCK_TVSHOW],
          pagination: { total: 1, page: 1, limit: 10, hasNext: false },
        }),
      })
    })

    await page.goto('/en')
    // 等待视频卡片出现
    const card = page.getByTestId('video-card').first()
    await expect(card).toBeVisible({ timeout: 10000 })

    const link = card.locator('a').first()
    const href = await link.getAttribute('href')
    expect(href).toMatch(/\/tvshow\//)
    expect(href).not.toMatch(/\/variety\//)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 浏览页 ?type=tvshow → API 接收 type=variety
// ═══════════════════════════════════════════════════════════════════

test.describe('BrowseGrid ?type=tvshow 别名映射', () => {
  test('URL 含 type=tvshow 时 API 请求发送 type=variety', async ({ page }) => {
    let capturedApiUrl = ''

    await page.route(`${API_BASE}/videos/trending*`, (route) => {
      capturedApiUrl = route.request().url()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [MOCK_TVSHOW],
          pagination: { total: 1, page: 1, limit: 10, hasNext: false },
        }),
      })
    })

    await page.goto('/en/browse?type=tvshow')
    // 等待至少一次 API 调用
    await page.waitForTimeout(1500)

    expect(capturedApiUrl).toContain('type=variety')
    expect(capturedApiUrl).not.toContain('type=tvshow')
  })
})
