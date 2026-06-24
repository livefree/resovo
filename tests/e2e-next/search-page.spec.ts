/**
 * tests/e2e-next/search-page.spec.ts
 * M5-PAGE-SEARCH-01: 搜索页 E2E
 * 覆盖：搜索输入、URL 同步、结果展示、空态、清除
 */

import { test, expect } from './_fixtures'

const MOCK_RESULTS = [
  {
    id: 'uuid-s1',
    shortId: 'sA1bC2d3',
    slug: 'search-result-movie-sA1bC2d3',
    title: '搜索结果电影',
    titleEn: 'Search Result Movie',
    type: 'movie',
    coverUrl: null,
    posterBlurhash: null,
    posterStatus: null,
    rating: 7.5,
    year: 2024,
    sourceCount: 1,
    episodeCount: 1,
    status: 'completed',
    subtitleLangs: ['zh-CN'],
  },
  {
    id: 'uuid-s2',
    shortId: 'eF4gH5i6',
    slug: 'search-result-anime-eF4gH5i6',
    title: '搜索结果动漫',
    titleEn: 'Search Result Anime',
    type: 'anime',
    coverUrl: null,
    posterBlurhash: null,
    posterStatus: null,
    rating: 8.0,
    year: 2023,
    sourceCount: 2,
    episodeCount: 12,
    status: 'ongoing',
    subtitleLangs: ['zh-CN'],
  },
]

// SearchPage 服务端分页（PAGE_SIZE=20）：实际请求 /search?q=…&limit=20&page=N[&type=X]。
// 用 URL predicate 按 pathname + q 匹配，避免对 limit/page/type 参数硬编码漂移；
// response 含 ApiListResponse 的 pagination（SearchPage 读 res.pagination.total）。
async function mockSearchApi(
  page: import('@playwright/test').Page,
  query: string,
  results: typeof MOCK_RESULTS
) {
  await page.route(
    // 精确匹配 API path /v1/search（排除页面路由 /{locale}/search）
    (url) => url.pathname === '/v1/search' && url.searchParams.get('q') === query,
    (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: results,
          pagination: { total: results.length, page: 1, limit: 20, hasNext: false },
        }),
      })
    },
  )
}

async function mockSearchApiEmpty(
  page: import('@playwright/test').Page,
) {
  await page.route(
    // 精确匹配 API path /v1/search（排除页面路由 /{locale}/search）
    (url) => url.pathname === '/v1/search',
    (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          pagination: { total: 0, page: 1, limit: 20, hasNext: false },
        }),
      })
    },
  )
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

  test('渲染统一筛选区 + 排序条（已移除 type tab，与分类页一致，HANDOFF-40B）', async ({ page }) => {
    await page.goto('/en/search')
    await expect(page.getByTestId('filter-area')).toBeVisible()
    for (const dim of ['type', 'genre', 'country', 'lang', 'year']) {
      await expect(page.getByTestId(`filter-${dim}`)).toBeVisible()
    }
    await expect(page.getByTestId('grid-sort-bar')).toBeVisible()
    // 旧 type tab 已移除（统一为 FilterArea type 行）
    await expect(page.getByTestId('search-tab-all')).toHaveCount(0)
  })
})

// ── 搜索结果 ─────────────────────────────────────────────────────────────

test.describe('搜索结果展示', () => {
  test.beforeEach(async ({ page }) => {
    await mockSearchApi(page, '测试', MOCK_RESULTS)
    await page.goto('/en/search?q=测试')
  })

  test('搜索有结果时显示结果网格', async ({ page }) => {
    await expect(page.getByTestId('search-results-list')).toBeVisible()
  })

  test('结果数量正确', async ({ page }) => {
    await expect(page.getByTestId('search-results-list').getByTestId('search-result-row')).toHaveCount(2)
  })
})

// ── 搜索输入行为 ──────────────────────────────────────────────────────────

test.describe('搜索输入行为', () => {
  test('清除按钮清空输入并重置结果', async ({ page }) => {
    await mockSearchApi(page, '测试', MOCK_RESULTS)
    await page.goto('/en/search?q=测试')
    await expect(page.getByTestId('search-results-list')).toBeVisible()

    // 测试在 /en locale，清除按钮 aria-label = en「Clear search」（非中文）
    await page.getByLabel('Clear search').click()
    await expect(page.getByTestId('search-input')).toHaveValue('')
    await expect(page.getByTestId('search-results-list')).not.toBeVisible()
  })

  test('无结果时显示空态（有关键词）', async ({ page }) => {
    await mockSearchApiEmpty(page)
    await page.goto('/en/search?q=不存在的内容xyzabc')
    await expect(page.getByTestId('search-empty-state')).toBeVisible()
  })
})

// ── BLOCKER #8 固化：q 参数透传到 API + 结果反映 q ─────────────────────────

test.describe('搜索 q 参数透传（BLOCKER #8 固化）', () => {
  test('/search?q=abc → API 收到 q=abc 且结果包含 abc', async ({ page }) => {
    const MOCK_ABC = [
      {
        ...MOCK_RESULTS[0],
        title: 'abc 搜索命中电影',
        slug: 'search-abc-hit-A1b2C3d4',
        shortId: 'A1b2C3d4',
      },
    ]
    let queryReceived: string | null = null
    await mockSearchApi(page, 'abc', MOCK_ABC)
    page.on('request', (req) => {
      if (req.url().includes('/v1/search?q=')) {
        const u = new URL(req.url())
        queryReceived = u.searchParams.get('q')
      }
    })
    await page.goto('/en/search?q=abc')
    await expect(page.getByText('abc 搜索命中电影').first()).toBeVisible({ timeout: 8_000 })
    expect(queryReceived).toBe('abc')
  })

  test('q 从 abc 变为 xyz → 结果刷新', async ({ page }) => {
    await mockSearchApi(page, 'abc', [
      {
        ...MOCK_RESULTS[0],
        title: 'abc 命中',
        slug: 'abc-hit-A1b2C3d4',
        shortId: 'A1b2C3d4',
      },
    ])
    await mockSearchApi(page, 'xyz', [
      {
        ...MOCK_RESULTS[1],
        title: 'xyz 命中',
        slug: 'xyz-hit-X1y2Z3w4',
        shortId: 'X1y2Z3w4',
      },
    ])
    await page.goto('/en/search?q=abc')
    await expect(page.getByText('abc 命中').first()).toBeVisible({ timeout: 8_000 })

    await page.goto('/en/search?q=xyz')
    await expect(page.getByText('xyz 命中').first()).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('abc 命中')).toHaveCount(0)
  })
})
