/**
 * tests/e2e/search.spec.ts
 * BROWSE-01: 分类浏览页筛选→结果更新→URL变化→刷新恢复 E2E 测试
 * SEARCH-02: 搜索页完整流程（搜索→结果→MetaChip 点击→URL 同步）
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

// ═══════════════════════════════════════════════════════════════════
// SEARCH-02: 搜索页
// ═══════════════════════════════════════════════════════════════════

const MOCK_SEARCH_RESULTS = [
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
    highlight: { title: '测试<em>电影</em> 1' },
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
    highlight: null,
  },
]

async function mockSearchApiForSearchPage(
  page: Parameters<typeof test>[1] extends { page: infer P } ? P : never
) {
  await page.route(`${API_BASE}/search*`, (route) => {
    const url = route.request().url()
    const params = new URL(url).searchParams
    const type = params.get('type')

    const filtered = type
      ? MOCK_SEARCH_RESULTS.filter((v) => v.type === type)
      : MOCK_SEARCH_RESULTS

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: filtered,
        pagination: {
          total: filtered.length,
          page: 1,
          limit: 20,
          hasNext: false,
        },
      }),
    })
  })
}

test.describe('搜索页', () => {
  test.beforeEach(async ({ page }) => {
    await mockSearchApiForSearchPage(page)
  })

  test('搜索页正常加载，显示筛选栏', async ({ page }) => {
    await page.goto('/en/search')
    await expect(page.getByTestId('search-filter-bar')).toBeVisible()
    await expect(page.getByTestId('search-input')).toBeVisible()
  })

  test('有搜索词时自动触发搜索并显示结果', async ({ page }) => {
    await page.goto('/en/search?q=电影')
    await page.waitForTimeout(500)
    await expect(page.getByTestId('search-result-list')).toBeVisible()
    await expect(page.getByTestId('search-result-count')).toBeVisible()
  })

  test('输入搜索词点击搜索按钮后 URL 更新', async ({ page }) => {
    await page.goto('/en/search')
    await page.getByTestId('search-input').fill('进击的巨人')
    await page.getByTestId('search-submit').click()
    await expect(page).toHaveURL(/q=%E8%BF%9B%E5%87%BB%E7%9A%84%E5%B7%A8%E4%BA%BA|q=/)
  })

  test('筛选栏有类型选项', async ({ page }) => {
    await page.goto('/en/search')
    await expect(page.getByTestId('filter-type-all')).toBeVisible()
    await expect(page.getByTestId('filter-type-movie')).toBeVisible()
    await expect(page.getByTestId('filter-type-anime')).toBeVisible()
  })

  test('点击类型筛选后 URL 参数更新', async ({ page }) => {
    await page.goto('/en/search?q=test')
    await page.getByTestId('filter-type-movie').click()
    await expect(page).toHaveURL(/type=movie/)
  })

  test('有搜索词时显示激活筛选条', async ({ page }) => {
    await page.goto('/en/search?q=test&type=anime')
    await expect(page.getByTestId('active-filter-strip')).toBeVisible()
    await expect(page.getByTestId('active-filter-q')).toBeVisible()
    await expect(page.getByTestId('active-filter-type')).toBeVisible()
  })

  test('点击删除筛选标签后 URL 参数移除', async ({ page }) => {
    await page.goto('/en/search?q=test&type=anime')
    await page.getByTestId('remove-filter-type').click()
    await expect(page).not.toHaveURL(/type=/)
    await expect(page).toHaveURL(/q=test/)
  })

  test('点击清除全部后 URL 参数全部清空', async ({ page }) => {
    await page.goto('/en/search?q=test&type=movie')
    await page.getByTestId('clear-all-filters').click()
    await expect(page).not.toHaveURL(/q=/)
    await expect(page).not.toHaveURL(/type=/)
  })

  test('MetaChip 点击后跳转到对应搜索参数', async ({ page }) => {
    await page.goto('/en/search?q=test')
    await page.waitForTimeout(500)
    // 结果卡片中年份 MetaChip 存在，点击后 URL 更新
    const yearChip = page.getByTestId('meta-chip-year').first()
    if (await yearChip.isVisible()) {
      await yearChip.click()
      await expect(page).toHaveURL(/year=/)
    }
  })

  test('排序选项点击后 URL 更新', async ({ page }) => {
    await page.goto('/en/search?q=test')
    await page.getByTestId('sort-rating').click()
    await expect(page).toHaveURL(/sort=rating/)
  })

  test('点击结果卡片跳转到播放页', async ({ page }) => {
    await page.goto('/en/search?q=test')
    await page.waitForTimeout(500)
    const firstCard = page.getByTestId('result-card').first()
    if (await firstCard.isVisible()) {
      const href = await firstCard.getAttribute('href')
      expect(href).toMatch(/\/watch\//)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════
// SEARCH-05: FilterBar→结果渲染→点击进入详情页 完整链路
// ═══════════════════════════════════════════════════════════════════

test.describe('SEARCH-05: 搜索完整链路', () => {
  test.beforeEach(async ({ page }) => {
    await mockSearchApiForSearchPage(page)
  })

  test('输入关键词提交后结果列表渲染', async ({ page }) => {
    await page.goto('/en/search')
    await page.getByTestId('search-input').fill('测试')
    await page.getByTestId('search-submit').click()
    // URL 更新
    await expect(page).toHaveURL(/q=/)
    // 结果列表出现
    await expect(page.getByTestId('search-result-list')).toBeVisible()
  })

  test('结果卡片 href 指向详情页路由（/{type}/slug-shortId）', async ({ page }) => {
    await page.goto('/en/search?q=test')
    await page.waitForTimeout(500)
    const firstCard = page.getByTestId('result-card').first()
    if (await firstCard.isVisible()) {
      const href = await firstCard.getAttribute('href')
      // ResultCard 链接格式：/{type}/{slug}-{shortId} 或 /{type}/{shortId}
      expect(href).toMatch(/\/(movie|anime|series|tvshow)\//)
    }
  })

  test('年份 MetaChip 点击后 URL 更新 year 参数', async ({ page }) => {
    await page.goto('/en/search?q=test')
    // 等待结果加载
    await expect(page.getByTestId('search-result-list')).toBeVisible()
    const yearChip = page.getByTestId('meta-chip-year').first()
    await expect(yearChip).toBeVisible()
    await yearChip.click()
    await expect(page).toHaveURL(/year=/)
  })
})
