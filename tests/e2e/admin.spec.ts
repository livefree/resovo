/**
 * tests/e2e/admin.spec.ts
 * ADMIN-01: 三种角色的后台访问控制验证
 *
 * 使用 page.context().addCookies() 模拟不同角色 Cookie，
 * 不依赖真实后端或数据库。
 */

import { test, expect } from '@playwright/test'

const BASE_URL = ''  // 使用相对路径，Playwright 自动拼接 baseURL

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
  await expect(sidebar.getByText('源站与爬虫')).not.toBeVisible()
  await expect(sidebar.getByText('数据看板')).not.toBeVisible()
})

test('admin 侧边栏显示系统管理区', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })
  await page.goto(`${BASE_URL}/en/admin/videos`)
  await expect(page).not.toHaveURL(/\/admin\/403/)
  const sidebar = page.locator('[data-testid="admin-sidebar"]')
  await expect(sidebar).toBeVisible()
  await expect(sidebar.getByText('用户管理')).toBeVisible()
  await expect(sidebar.getByText('源站与爬虫')).toBeVisible()
  await expect(sidebar.getByText('数据看板')).toBeVisible()
})

// ── CHG-09: 侧边栏「返回前台」入口 ───────────────────────────────

test('admin 侧边栏有「返回前台」链接', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })
  await page.goto(`${BASE_URL}/en/admin/videos`)
  await expect(page).not.toHaveURL(/\/admin\/403/)
  const backLink = page.locator('[data-testid="admin-back-to-site"]')
  await expect(backLink).toBeVisible()
  await expect(backLink).toHaveAttribute('href', '/')
})

test('moderator 侧边栏同样有「返回前台」链接', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })
  await page.goto(`${BASE_URL}/en/admin/videos`)
  await expect(page).not.toHaveURL(/\/admin\/403/)
  const backLink = page.locator('[data-testid="admin-back-to-site"]')
  await expect(backLink).toBeVisible()
  await expect(backLink).toHaveAttribute('href', '/')
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
  const patchReq = page.waitForRequest(`${API_BASE}/admin/videos/vid-uuid-1/publish`)
  await page.locator('[data-testid="admin-video-toggle-vid-uuid-1"]').click()
  await patchReq
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
  const postReq = page.waitForRequest(`${API_BASE}/admin/videos`)
  await page.locator('[data-testid="admin-video-form-submit"]').click()
  await postReq
  expect(postCalled).toBe(true)
})

// ── ADMIN-03: 投稿审核通过/拒绝流程 ───────────────────────────────

const MOCK_SUBMISSION = {
  id: 'sub-uuid-1',
  video_id: 'vid-uuid-1',
  video_title: '测试电影',
  source_url: 'http://example.com/video.m3u8',
  source_name: '用户投稿',
  type: 'hls',
  submitted_by: 'user-uuid-1',
  submitted_by_username: 'testuser',
  created_at: '2026-03-15T00:00:00Z',
}

test('投稿审核页面显示待审列表', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })

  await page.route(`${API_BASE}/admin/submissions*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [MOCK_SUBMISSION], total: 1, page: 1, limit: 20 }),
    })
  })

  await page.goto(`${BASE_URL}/en/admin/submissions`)
  await expect(page.locator('[data-testid="admin-submissions-page"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-submission-list"]')).toBeVisible()
  await expect(page.locator(`[data-testid="admin-submission-row-sub-uuid-1"]`)).toBeVisible()
})

test('点击通过触发 approve 请求', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })

  await page.route(`${API_BASE}/admin/submissions*`, (route) => {
    if (route.request().url().includes('/approve')) {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { approved: true } }),
      })
    } else {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_SUBMISSION], total: 1, page: 1, limit: 20 }),
      })
    }
  })

  let approveCalled = false
  await page.route(`${API_BASE}/admin/submissions/sub-uuid-1/approve`, (route) => {
    approveCalled = true
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { approved: true } }),
    })
  })

  await page.goto(`${BASE_URL}/en/admin/submissions`)
  const approveReq = page.waitForRequest(`${API_BASE}/admin/submissions/sub-uuid-1/approve`)
  await page.locator('[data-testid="admin-submission-approve-sub-uuid-1"]').click()
  await approveReq
  expect(approveCalled).toBe(true)
})

test('字幕审核页面显示待审列表', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })

  await page.route(`${API_BASE}/admin/subtitles*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 'subtitle-uuid-1',
          video_id: 'vid-uuid-1',
          video_title: '测试电影',
          language: 'zh-CN',
          label: '中文简体',
          format: 'vtt',
          file_url: 'https://r2.resovo.dev/subtitles/vid-1/zh-CN.vtt',
          is_verified: false,
          created_at: '2026-03-15T00:00:00Z',
        }],
        total: 1,
        page: 1,
        limit: 20,
      }),
    })
  })

  await page.goto(`${BASE_URL}/en/admin/subtitles`)
  await expect(page.locator('[data-testid="admin-subtitles-page"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-subtitle-row-subtitle-uuid-1"]')).toBeVisible()
})

// ── ADMIN-04: 用户封号/解封、爬虫手动触发 ────────────────────────

const MOCK_USERS = [
  {
    id: 'user-uuid-1',
    username: 'regularuser',
    email: 'user@example.com',
    role: 'user',
    banned_at: null,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user-uuid-2',
    username: 'banneduser',
    email: 'banned@example.com',
    role: 'user',
    banned_at: '2026-02-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  },
]

test('用户管理页面显示用户列表', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })

  await page.route(`${API_BASE}/admin/users*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_USERS, total: 2, page: 1, limit: 20 }),
    })
  })

  await page.goto(`${BASE_URL}/en/admin/users`)
  await expect(page.locator('[data-testid="admin-users-page"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-user-list"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-user-row-user-uuid-1"]')).toBeVisible()
})

test('点击封号触发 ban 请求', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })

  await page.route(`${API_BASE}/admin/users*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_USERS, total: 2, page: 1, limit: 20 }),
    })
  })

  let banCalled = false
  await page.route(`${API_BASE}/admin/users/user-uuid-1/ban`, (route) => {
    banCalled = true
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'user-uuid-1', banned_at: '2026-03-15T00:00:00Z' } }),
    })
  })

  await page.goto(`${BASE_URL}/en/admin/users`)
  // 模拟 confirm 对话框
  page.on('dialog', (dialog) => dialog.accept())
  const banReq = page.waitForRequest(`${API_BASE}/admin/users/user-uuid-1/ban`)
  await page.locator('[data-testid="admin-user-ban-user-uuid-1"]').click()
  await banReq
  expect(banCalled).toBe(true)
})

test('采集任务记录页为只读模式（无触发按钮）', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })

  await page.route(`${API_BASE}/admin/crawler/overview*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { siteTotal: 0, connected: 0, running: 0, paused: 0, failed: 0, todayVideos: 0, todayDurationMs: 0 } }),
    })
  })
  await page.route(`${API_BASE}/admin/crawler/runs*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })
  await page.route(`${API_BASE}/admin/crawler/auto-config*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { globalEnabled: false, scheduleType: 'daily', dailyTime: '03:00', defaultMode: 'incremental', onlyEnabledSites: true, conflictPolicy: 'skip_running', perSiteOverrides: {} } }),
    })
  })
  await page.route(`${API_BASE}/admin/crawler/sites*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })
  await page.route(`${API_BASE}/admin/crawler/tasks/latest*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { tasks: [] } }),
    })
  })
  await page.route(`${API_BASE}/admin/crawler/tasks*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [], total: 0, page: 1, limit: 20 }),
    })
  })

  await page.goto(`${BASE_URL}/en/admin/crawler`)
  await page.locator('[data-testid="admin-crawler-tab-tasks"]').click()
  await expect(page.locator('[data-testid="admin-crawler-page"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-crawler-trigger-full"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="admin-crawler-trigger-incremental"]')).toHaveCount(0)
})

test('采集控制台触发入口位于 sites tab', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })

  await page.route(`${API_BASE}/admin/crawler/overview*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { siteTotal: 0, connected: 0, running: 0, paused: 0, failed: 0, todayVideos: 0, todayDurationMs: 0 } }),
    })
  })
  await page.route(`${API_BASE}/admin/crawler/runs*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })
  await page.route(`${API_BASE}/admin/crawler/auto-config*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { globalEnabled: false, scheduleType: 'daily', dailyTime: '03:00', defaultMode: 'incremental', onlyEnabledSites: true, conflictPolicy: 'skip_running', perSiteOverrides: {} } }),
    })
  })
  await page.route(`${API_BASE}/admin/crawler/sites*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })

  await page.goto(`${BASE_URL}/en/admin/crawler`)
  await expect(page.locator('button:has-text("全站增量采集")')).toBeVisible()
  await expect(page.locator('button:has-text("全站全量采集")')).toBeVisible()
})
