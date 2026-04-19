/**
 * tests/e2e-next/homepage.spec.ts
 * M2: 首页加载、导航、主题切换、语言切换 E2E 测试
 * 使用 page.route() 拦截 API 请求，不依赖真实后端
 */

import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:4000/v1'

const MOCK_MOVIE = {
  id: 'uuid-movie-1',
  shortId: 'aB3kR9x1',
  slug: 'test-movie-aB3kR9x1',
  title: '测试电影',
  titleEn: 'Test Movie',
  coverUrl: null,
  type: 'movie',
  rating: 8.5,
  year: 2024,
  status: 'completed',
  episodeCount: 1,
  sourceCount: 2,
}

const MOCK_SERIES = {
  id: 'uuid-series-1',
  shortId: 'bC4lS0y2',
  slug: 'test-series-bC4lS0y2',
  title: '测试剧集',
  titleEn: 'Test Series',
  coverUrl: null,
  type: 'series',
  rating: 9.0,
  year: 2024,
  status: 'ongoing',
  episodeCount: 24,
  sourceCount: 1,
}

async function mockApiRoutes(page: import('@playwright/test').Page) {
  await page.route(`${API_BASE}/videos/trending*`, (route) => {
    const url = route.request().url()
    const type = new URL(url).searchParams.get('type')
    const item = type === 'series' ? MOCK_SERIES : MOCK_MOVIE

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [item],
        pagination: { total: 1, page: 1, limit: 10, hasNext: false },
      }),
    })
  })
}

// ═══════════════════════════════════════════════════════════════════
// 首页加载
// ═══════════════════════════════════════════════════════════════════

test.describe('首页', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/en')
  })

  test('首页正常加载，显示导航栏', async ({ page }) => {
    await expect(page.getByTestId('nav-logo')).toBeVisible()
    await expect(page.getByTestId('nav-logo')).toHaveText('Resovo')
  })

  test('导航栏显示分类标签', async ({ page }) => {
    await expect(page.getByTestId('nav-cat-movie')).toBeVisible()
    await expect(page.getByTestId('nav-cat-series')).toBeVisible()
    await expect(page.getByTestId('nav-cat-anime')).toBeVisible()
  })

  test('Hero Banner 区域存在', async ({ page }) => {
    await expect(page.getByTestId('hero-banner')).toBeVisible()
  })

  test('电影网格区域存在', async ({ page }) => {
    await expect(page.getByTestId('movie-grid')).toBeVisible()
  })

  test('剧集网格区域存在', async ({ page }) => {
    await expect(page.getByTestId('series-grid')).toBeVisible()
  })

  test('底部免责声明常驻显示', async ({ page }) => {
    await expect(page.getByTestId('footer-disclaimer')).toBeVisible()
  })

  test('未登录时显示"Sign In"按钮', async ({ page }) => {
    await expect(page.getByTestId('nav-login')).toBeVisible()
  })
})

// ═══════════════════════════════════════════════════════════════════
// 主题切换
// ═══════════════════════════════════════════════════════════════════

test.describe('主题切换', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/en')
  })

  test('主题切换按钮存在', async ({ page }) => {
    await expect(page.getByTestId('theme-toggle')).toBeVisible()
  })

  test('点击主题切换按钮改变主题', async ({ page }) => {
    const toggle = page.getByTestId('theme-toggle')
    const initialLabel = await toggle.getAttribute('aria-label')
    await toggle.click()
    const afterLabel = await toggle.getAttribute('aria-label')
    expect(afterLabel).not.toBe(initialLabel)
  })

  test('连续点击三次回到初始主题', async ({ page }) => {
    const toggle = page.getByTestId('theme-toggle')
    const initialLabel = await toggle.getAttribute('aria-label')
    await toggle.click()
    await toggle.click()
    await toggle.click()
    const finalLabel = await toggle.getAttribute('aria-label')
    expect(finalLabel).toBe(initialLabel)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 语言切换
// ═══════════════════════════════════════════════════════════════════

test.describe('语言切换', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/en')
  })

  test('切换到中文后页面为中文内容', async ({ page }) => {
    await page.getByTestId('nav-locale-trigger').click()
    await page.getByTestId('lang-zh-CN').click()
    await expect(page).toHaveURL('/zh-CN')
    await expect(page.getByTestId('nav-cat-movie')).toHaveText('电影')
  })

  test('切换回英文后页面为英文内容', async ({ page }) => {
    await page.getByTestId('nav-locale-trigger').click()
    await page.getByTestId('lang-zh-CN').click()
    await page.getByTestId('nav-locale-trigger').click()
    await page.getByTestId('lang-en').click()
    await expect(page).toHaveURL('/en')
    await expect(page.getByTestId('nav-cat-movie')).toHaveText('Movies')
  })
})

// ═══════════════════════════════════════════════════════════════════
// 导航跳转
// ═══════════════════════════════════════════════════════════════════

test.describe('导航跳转', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/en')
  })

  test('点击 Logo 返回首页', async ({ page }) => {
    await page.getByTestId('nav-logo').click()
    await expect(page).toHaveURL('/en')
  })

  test('点击"Sign In"跳转到登录页', async ({ page }) => {
    await page.getByTestId('nav-login').click()
    await expect(page).toHaveURL('/en/auth/login')
  })
})
