/**
 * tests/e2e-next/search-page.spec.ts
 * M5-PAGE-SEARCH-01: 搜索页 E2E
 * 覆盖：搜索输入、URL 同步、结果展示、空态、清除
 */

import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:4000/v1'

const MOCK_RESULTS = [
  {
    id: 'uuid-s1',
    shortId: 'sA1bC2d3',
    slug: 'search-result-movie-sA1bC2d3',
    title: '搜索结果电影',
    titleEn: 'Search Result Movie',
    type: 'movie',
    coverUrl: null,
    rating: 7.5,
    year: 2024,
    sourceCount: 1,
    episodeCount: 1,
    status: 'completed',
  },
  {
    id: 'uuid-s2',
    shortId: 'eF4gH5i6',
    slug: 'search-result-anime-eF4gH5i6',
    title: '搜索结果动漫',
    titleEn: 'Search Result Anime',
    type: 'anime',
    coverUrl: null,
    rating: 8.0,
    year: 2023,
    sourceCount: 2,
    episodeCount: 12,
    status: 'ongoing',
  },
]

async function mockSearchApi(
  page: Parameters<typeof test>[1] extends { page: infer P } ? P : never,
  query: string,
  results: typeof MOCK_RESULTS
) {
  await page.route(`${API_BASE}/search?q=${encodeURIComponent(query)}&limit=40`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: results }),
    })
  })
}

async function mockSearchApiEmpty(
  page: Parameters<typeof test>[1] extends { page: infer P } ? P : never,
) {
  await page.route(`${API_BASE}/search**`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })
}

// ── 搜索页基础 ───────────────────────────────────────────────────────────

test.describe('搜索页基础', () => {
  test('搜索页正常加载，显示搜索输入框', async ({ page }) => {
    await page.goto('/en/search')
    await expect(page.getByTestId('search-page')).toBeVisible()
    await expect(page.getByTestId('search-input')).toBeVisible()
  })

  test('无关键词时显示空态', async ({ page }) => {
    await page.goto('/en/search')
    await expect(page.getByTestId('search-empty-state')).toBeVisible()
  })

  test('URL 带 ?q= 时输入框预填关键词', async ({ page }) => {
    await mockSearchApiEmpty(page)
    await page.goto('/en/search?q=测试关键词')
    const input = page.getByTestId('search-input')
    await expect(input).toHaveValue('测试关键词')
  })
})

// ── 搜索结果 ─────────────────────────────────────────────────────────────

test.describe('搜索结果展示', () => {
  test.beforeEach(async ({ page }) => {
    await mockSearchApi(page, '测试', MOCK_RESULTS)
    await page.goto('/en/search?q=测试')
  })

  test('搜索有结果时显示结果网格', async ({ page }) => {
    await expect(page.getByTestId('search-results-grid')).toBeVisible()
  })

  test('结果数量正确', async ({ page }) => {
    await expect(page.getByTestId('search-results-grid').getByTestId('video-card')).toHaveCount(2)
  })
})

// ── 搜索输入行为 ──────────────────────────────────────────────────────────

test.describe('搜索输入行为', () => {
  test('清除按钮清空输入并重置结果', async ({ page }) => {
    await mockSearchApi(page, '测试', MOCK_RESULTS)
    await page.goto('/en/search?q=测试')
    await expect(page.getByTestId('search-results-grid')).toBeVisible()

    await page.getByLabel('清除搜索').click()
    await expect(page.getByTestId('search-input')).toHaveValue('')
    await expect(page.getByTestId('search-results-grid')).not.toBeVisible()
  })

  test('无结果时显示空态（有关键词）', async ({ page }) => {
    await mockSearchApiEmpty(page)
    await page.goto('/en/search?q=不存在的内容xyzabc')
    await expect(page.getByTestId('search-empty-state')).toBeVisible()
  })
})
