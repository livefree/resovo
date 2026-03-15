/**
 * tests/e2e/search.spec.ts
 * BROWSE-01: 分类浏览页筛选→结果更新→URL变化→刷新恢复 E2E 测试
 * SEARCH-02: 搜索流程（将在 SEARCH-02 任务中补充）
 * 使用 page.route() 拦截 API 请求，不依赖真实后端
 */

import { test, expect } from '@playwright/test'

// ── Mock 数据 ───────────────────────────────────────────────────────

const API_BASE = 'http://localhost:4000/v1'

const MOCK_VIDEOS = [
  {
    id: 'uuid-1',
    shortId: 'aB3kR9x1',
    slug: 'test-movie-aB3kR9x1',
    title: '测试电影 1',
    titleEn: 'Test Movie 1',
    coverUrl: null,
    type: 'movie',
    rating: 8.5,
    year: 2024,
    status: 'completed',
    episodeCount: 1,
    sourceCount: 2,
  },
  {
    id: 'uuid-2',
    shortId: 'bC4lS0y2',
    slug: 'test-anime-bC4lS0y2',
    title: '测试动漫 1',
    titleEn: 'Test Anime 1',
    coverUrl: null,
    type: 'anime',
    rating: 9.0,
    year: 2024,
    status: 'ongoing',
    episodeCount: 12,
    sourceCount: 1,
  },
]

async function mockSearchApi(page: Parameters<typeof test>[1] extends { page: infer P } ? P : never) {
  await page.route(`${API_BASE}/search*`, (route) => {
    const url = route.request().url()
    const params = new URL(url).searchParams
    const type = params.get('type')

    const filtered = type ? MOCK_VIDEOS.filter((v) => v.type === type) : MOCK_VIDEOS

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: filtered,
        pagination: {
          total: filtered.length,
          page: 1,
          limit: 24,
          hasNext: false,
        },
      }),
    })
  })
}

// ═══════════════════════════════════════════════════════════════════
// BROWSE-01: 分类浏览页
// ═══════════════════════════════════════════════════════════════════

test.describe('分类浏览页', () => {
  test.beforeEach(async ({ page }) => {
    await mockSearchApi(page)
    await page.goto('/en/browse')
  })

  test('浏览页正常加载，显示筛选区域', async ({ page }) => {
    await expect(page.getByTestId('filter-area')).toBeVisible()
    await expect(page.getByTestId('browse-grid')).toBeVisible()
  })

  test('筛选区有类型选项', async ({ page }) => {
    await expect(page.getByTestId('filter-type-all')).toBeVisible()
    await expect(page.getByTestId('filter-type-movie')).toBeVisible()
    await expect(page.getByTestId('filter-type-anime')).toBeVisible()
  })

  test('点击类型筛选后 URL 参数更新', async ({ page }) => {
    await page.getByTestId('filter-type-movie').click()
    await expect(page).toHaveURL(/type=movie/)
  })

  test('点击类型筛选后结果更新（只显示该类型）', async ({ page }) => {
    await page.getByTestId('filter-type-anime').click()
    // 等待网格重新加载
    await page.waitForTimeout(500)
    // 结果计数变化
    const countText = await page.getByTestId('result-count').textContent()
    expect(countText).toContain('1')
  })

  test('刷新页面后筛选状态从 URL 恢复', async ({ page }) => {
    // 先选择 anime 类型
    await page.getByTestId('filter-type-anime').click()
    await expect(page).toHaveURL(/type=anime/)

    // 刷新页面
    await page.reload()

    // 检查 URL 参数仍然保留
    await expect(page).toHaveURL(/type=anime/)
    // 筛选区仍然存在
    await expect(page.getByTestId('filter-area')).toBeVisible()
  })

  test('点击展开按钮显示更多筛选行', async ({ page }) => {
    await expect(page.getByTestId('filter-year-all')).not.toBeVisible()
    await page.getByTestId('filter-expand').click()
    await expect(page.getByTestId('filter-year-all')).toBeVisible()
  })

  test('点击排序选项后 URL 参数更新', async ({ page }) => {
    await page.getByTestId('sort-rating').click()
    await expect(page).toHaveURL(/sort=rating/)
  })

  test('排序条显示结果总数', async ({ page }) => {
    await page.waitForTimeout(500) // 等待数据加载
    await expect(page.getByTestId('result-count')).toBeVisible()
  })
})
