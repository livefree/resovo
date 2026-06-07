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
  await page.locator('[data-testid="video-publish-toggle-vid-flow-1"]').click()
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
// CHG-E2E-GATE-AUDIT-B2（2026-06-06）：退役「详情页基本信息」与「播放页播放器容器」——
// 断言写于 apps/web CSR 时代（page.route 浏览器拦截）；CUTOVER 后 web-next 详情/播放
// 为 SSR 取数，浏览器 mock 到不了服务端 fetch，结构性失效。该覆盖由 tests/e2e-next/
// detail.spec + player.spec（web 域真源套件）承担；跨应用金路径保留前两测试。
