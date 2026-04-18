/**
 * tests/e2e/publish-flow.spec.ts
 * ADMIN-08: 内容流通端对端验证
 *
 * 场景：管理员发布视频 → 前台搜索可见 → 进入详情页 → 进入播放页
 * 使用 page.route() 拦截 API，不依赖真实后端/ES
 */

import { test, expect } from '@playwright/test'

// admin 路由用相对路径（baseURL = server:3001），web 路由用绝对 URL
const BASE_URL = ''
const WEB_URL  = 'http://localhost:3000'
const API_BASE = 'http://localhost:4000/v1'

// ── Mock 数据 ──────────────────────────────────────────────────────

const PENDING_VIDEO = {
  id: 'vid-flow-1',
  short_id: 'fLow1234',
  title: '流通测试电影',
  title_en: 'Flow Test Movie',
  type: 'movie',
  year: 2024,
  is_published: false,
  cover_url: null,
  source_count: 1,
  created_at: '2026-03-24T00:00:00Z',
}

const PUBLISHED_VIDEO_CARD = {
  id: 'vid-flow-1',
  shortId: 'fLow1234',
  slug: 'flow-test-movie-fLow1234',
  title: '流通测试电影',
  titleEn: 'Flow Test Movie',
  coverUrl: null,
  type: 'movie',
  rating: null,
  year: 2024,
  status: 'completed',
  episodeCount: 1,
  sourceCount: 1,
}

const VIDEO_DETAIL = {
  ...PUBLISHED_VIDEO_CARD,
  description: '这是一部流通测试电影',
  category: null,
  country: 'CN',
  director: [],
  cast: [],
  writers: [],
}

// ── Cookie 辅助 ────────────────────────────────────────────────────

async function setAdminCookies(context: Parameters<Parameters<typeof test>[1]>[0]['context']) {
  await context.addCookies([
    {
      name: 'refresh_token',
      value: 'mock-admin-rt',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    },
    {
      name: 'user_role',
      value: 'admin',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Strict',
    },
  ])
}

// ── 测试：管理员发布视频后状态更新 ───────────────────────────────

test('管理员在视频列表中发布待审核视频，状态变为已上架', async ({ context, page }) => {
  await setAdminCookies(context)

  // Mock 视频列表（初始为 pending）
  await page.route(`${API_BASE}/admin/videos*`, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: [PENDING_VIDEO],
          total: 1,
          page: 1,
          limit: 20,
        }),
      })
    } else {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {} }) })
    }
  })

  // Mock 发布请求
  let publishCalled = false
  await page.route(`${API_BASE}/admin/videos/vid-flow-1/publish`, (route) => {
    publishCalled = true
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'vid-flow-1', is_published: true } }),
    })
  })

  // Mock 爬虫站点（VideoFilters 需要）
  await page.route(`${API_BASE}/admin/crawler/sites`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })

  await page.goto(`${BASE_URL}/admin/videos`)
  await expect(page.locator('[data-testid="admin-videos-page"]')).toBeVisible()

  // 点击上架按钮
  const publishReq = page.waitForRequest(`${API_BASE}/admin/videos/vid-flow-1/publish`)
  await page.locator('[data-testid="admin-video-toggle-vid-flow-1"]').click()
  await publishReq

  expect(publishCalled).toBe(true)
})

// ── 测试：发布后搜索页可以找到内容 ──────────────────────────────

test('视频发布后，前台搜索页返回该视频', async ({ page }) => {
  // Mock 搜索 API 返回已发布视频
  await page.route(`${API_BASE}/search*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [PUBLISHED_VIDEO_CARD],
        pagination: { total: 1, page: 1, limit: 20, hasNext: false },
      }),
    })
  })

  await page.goto(`${WEB_URL}/en/search?q=流通测试`)

  // 搜索结果应出现
  await expect(page.locator('[data-testid="search-page"]')).toBeVisible()
  await expect(page.locator('text=流通测试电影').first()).toBeVisible()
})

// ── 测试：详情页加载视频信息 ─────────────────────────────────────

test('点击搜索结果进入详情页，基本信息可见', async ({ page }) => {
  // Mock 视频详情
  await page.route(`${API_BASE}/videos/fLow1234`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: VIDEO_DETAIL }),
    })
  })

  await page.goto(`${WEB_URL}/en/movie/flow-test-movie-fLow1234`)
  // 等待页面加载（VideoDetailClient CSR）
  await expect(page.locator('text=流通测试电影').first()).toBeVisible({ timeout: 8000 })
})

// ── 测试：播放页加载播放器组件 ───────────────────────────────────

test('进入播放页，播放器容器正常加载', async ({ page }) => {
  // Mock 视频数据
  await page.route(`${API_BASE}/videos/fLow1234`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: VIDEO_DETAIL }),
    })
  })

  // Mock 播放源（空列表，仅验证播放器加载）
  await page.route(`${API_BASE}/videos/fLow1234/sources*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })

  await page.goto(`${WEB_URL}/en/watch/flow-test-movie-fLow1234`)
  await expect(page.locator('[data-testid="watch-page"]')).toBeVisible()
})
