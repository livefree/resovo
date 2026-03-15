/**
 * tests/e2e/admin.spec.ts
 * ADMIN-01: 三种角色的后台访问控制验证
 *
 * 使用 page.context().addCookies() 模拟不同角色 Cookie，
 * 不依赖真实后端或数据库。
 */

import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

// ── Cookie 辅助 ───────────────────────────────────────────────────

async function setCookies(
  context: Parameters<Parameters<typeof test>[1]>[0]['context'],
  {
    refreshToken,
    userRole,
  }: { refreshToken?: string; userRole?: string }
) {
  const cookies = []
  if (refreshToken) {
    cookies.push({
      name: 'refresh_token',
      value: refreshToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict' as const,
    })
  }
  if (userRole) {
    cookies.push({
      name: 'user_role',
      value: userRole,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Strict' as const,
    })
  }
  if (cookies.length > 0) {
    await context.addCookies(cookies)
  }
}

// ── 未登录用户访问 /admin ─────────────────────────────────────────

test('未登录访问 /admin 重定向到登录页', async ({ context, page }) => {
  await setCookies(context, {})
  await page.goto(`${BASE_URL}/en/admin`)
  await expect(page).toHaveURL(/\/auth\/login/)
  await expect(page.url()).toContain('callbackUrl')
})

test('未登录访问 /admin/videos 重定向到登录页', async ({ context, page }) => {
  await setCookies(context, {})
  await page.goto(`${BASE_URL}/en/admin/videos`)
  await expect(page).toHaveURL(/\/auth\/login/)
})

// ── role=user 访问 /admin ─────────────────────────────────────────

test('role=user 访问 /admin 重定向到 403 页面', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'user' })
  await page.goto(`${BASE_URL}/en/admin`)
  await expect(page).toHaveURL(/\/admin\/403/)
  await expect(page.locator('[data-testid="admin-403-page"]')).toBeVisible()
})

test('role=user 访问 /admin/videos 重定向到 403 页面', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'user' })
  await page.goto(`${BASE_URL}/en/admin/videos`)
  await expect(page).toHaveURL(/\/admin\/403/)
})

// ── role=moderator 访问 /admin ────────────────────────────────────

test('role=moderator 访问 /admin/videos 可正常进入', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })
  await page.goto(`${BASE_URL}/en/admin/videos`)
  // 不被重定向到 403 或 login
  await expect(page).not.toHaveURL(/\/admin\/403/)
  await expect(page).not.toHaveURL(/\/auth\/login/)
})

test('role=moderator 访问 /admin/users 重定向到 403', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })
  await page.goto(`${BASE_URL}/en/admin/users`)
  await expect(page).toHaveURL(/\/admin\/403/)
})

test('role=moderator 访问 /admin/crawler 重定向到 403', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })
  await page.goto(`${BASE_URL}/en/admin/crawler`)
  await expect(page).toHaveURL(/\/admin\/403/)
})

test('role=moderator 访问 /admin/analytics 重定向到 403', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })
  await page.goto(`${BASE_URL}/en/admin/analytics`)
  await expect(page).toHaveURL(/\/admin\/403/)
})

// ── role=admin 访问 /admin ────────────────────────────────────────

test('role=admin 访问 /admin/videos 可正常进入', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })
  await page.goto(`${BASE_URL}/en/admin/videos`)
  await expect(page).not.toHaveURL(/\/admin\/403/)
  await expect(page).not.toHaveURL(/\/auth\/login/)
})

test('role=admin 访问 /admin/users 可正常进入', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })
  await page.goto(`${BASE_URL}/en/admin/users`)
  await expect(page).not.toHaveURL(/\/admin\/403/)
  await expect(page).not.toHaveURL(/\/auth\/login/)
})

test('role=admin 访问 /admin/analytics 可正常进入', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })
  await page.goto(`${BASE_URL}/en/admin/analytics`)
  await expect(page).not.toHaveURL(/\/admin\/403/)
  await expect(page).not.toHaveURL(/\/auth\/login/)
})

// ── 侧边栏菜单按角色渲染 ──────────────────────────────────────────

test('moderator 侧边栏不显示系统管理区', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })
  // 访问某个内容管理页（需要 admin 布局渲染）
  await page.goto(`${BASE_URL}/en/admin/videos`)
  await expect(page).not.toHaveURL(/\/admin\/403/)
  // 系统管理菜单不可见
  const sidebar = page.locator('[data-testid="admin-sidebar"]')
  await expect(sidebar).toBeVisible()
  await expect(sidebar.getByText('用户管理')).not.toBeVisible()
  await expect(sidebar.getByText('爬虫管理')).not.toBeVisible()
  await expect(sidebar.getByText('数据看板')).not.toBeVisible()
})

test('admin 侧边栏显示系统管理区', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })
  await page.goto(`${BASE_URL}/en/admin/videos`)
  await expect(page).not.toHaveURL(/\/admin\/403/)
  const sidebar = page.locator('[data-testid="admin-sidebar"]')
  await expect(sidebar).toBeVisible()
  await expect(sidebar.getByText('用户管理')).toBeVisible()
  await expect(sidebar.getByText('爬虫管理')).toBeVisible()
  await expect(sidebar.getByText('数据看板')).toBeVisible()
})

// ── ADMIN-02: 视频列表上下架操作 ──────────────────────────────────

const API_BASE = 'http://localhost:4000/v1'

const MOCK_VIDEOS = [
  {
    id: 'vid-uuid-1',
    short_id: 'aB3kR9x',
    title: '测试电影',
    title_en: 'Test Movie',
    type: 'movie',
    year: 2024,
    is_published: false,
    source_count: 2,
    created_at: '2026-03-15T00:00:00Z',
  },
]

test('视频列表页渲染并显示状态筛选器', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })

  await page.route(`${API_BASE}/admin/videos*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_VIDEOS, total: 1, page: 1, limit: 20 }),
    })
  })

  await page.goto(`${BASE_URL}/en/admin/videos`)
  await expect(page.locator('[data-testid="admin-videos-page"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-videos-filter-all"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-videos-filter-pending"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-videos-filter-published"]')).toBeVisible()
})

test('点击上架触发 PATCH 请求', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })

  await page.route(`${API_BASE}/admin/videos*`, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_VIDEOS, total: 1, page: 1, limit: 20 }),
      })
    } else {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: {} }) })
    }
  })

  let patchCalled = false
  await page.route(`${API_BASE}/admin/videos/vid-uuid-1/publish`, (route) => {
    patchCalled = true
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'vid-uuid-1', is_published: true } }),
    })
  })

  await page.goto(`${BASE_URL}/en/admin/videos`)
  await page.locator('[data-testid="admin-video-toggle-vid-uuid-1"]').click()
  expect(patchCalled).toBe(true)
})

test('手动添加视频页面渲染表单', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })
  await page.goto(`${BASE_URL}/en/admin/videos/new`)
  await expect(page.locator('[data-testid="admin-videos-new-page"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-video-form"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-video-form-submit"]')).toHaveText('创建视频')
})

test('提交创建表单触发 POST 请求', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })

  let postCalled = false
  await page.route(`${API_BASE}/admin/videos`, (route) => {
    if (route.request().method() === 'POST') {
      postCalled = true
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'new-vid', is_published: false } }),
      })
    } else {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) })
    }
  })

  await page.goto(`${BASE_URL}/en/admin/videos/new`)
  await page.locator('[data-testid="admin-video-form"] input[name="title"]').fill('新测试电影')
  await page.locator('[data-testid="admin-video-form-submit"]').click()
  // 等待 API 被调用（导航可能会跳回列表页）
  await page.waitForTimeout(500)
  expect(postCalled).toBe(true)
})
