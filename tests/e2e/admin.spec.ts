/**
 * tests/e2e/admin.spec.ts
 * ADMIN-01: 三种角色的后台访问控制验证
 *
 * 使用 page.context().addCookies() 模拟不同角色 Cookie + context.route mock
 * 会话端点（/auth/refresh、/users/me），不依赖真实后端或数据库。
 *
 * CHG-E2E-GATE-AUDIT-B（2026-06-06，v1 冻结政策）：退役 7 个断言对象已不存在的
 * 测试（返回前台 ×2〔e601ea2b 移除〕/ 视频列表筛选器 / 投稿·字幕审核页〔已 307 归并
 * content tab〕/ 用户列表 / 采集触发按钮文案）——v1 多轮改版未同步断言；保留访问
 * 控制 + 现存结构断言为 v1 最小冒烟面。/auth/login → /admin/login 对齐 DEC-13 后
 * v1 实际登录路由（服务端守卫由 src/middleware.ts 恢复，详见该文件头注）。
 */

import { test, expect, type BrowserContext } from '@playwright/test'

const BASE_URL = ''  // 使用相对路径，Playwright 自动拼接 baseURL

// ── Cookie 辅助 ───────────────────────────────────────────────────

async function setCookies(
  context: BrowserContext,
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

  // CHG-E2E-GATE-AUDIT-B（-A 定界根因 (a) v1 同型）：v1 客户端启动即 tryRestoreSession
  // （POST /v1/auth/refresh → GET /v1/users/me）；真实 API（playwright webServer 恒起）
  // 对假 cookie 硬 401 → 客户端登出，角色门控 UI 全隐藏。统一在 context 级 mock 会话
  // 端点（page.route 优先于 context.route，不影响各测试自有业务 mock）。
  if (refreshToken) {
    await context.route('**/v1/auth/refresh', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'e2e-access-token' }),
    }))
    await context.route('**/v1/users/me', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'e2e-user',
          email: 'e2e@resovo.test',
          username: 'e2e',
          role: userRole ?? 'user',
          created_at: '2026-01-01T00:00:00Z',
        },
      }),
    }))
  }
}

// ── 未登录用户访问 /admin ─────────────────────────────────────────

test('未登录访问 /admin 重定向到登录页', async ({ context, page }) => {
  await setCookies(context, {})
  await page.goto(`${BASE_URL}/admin`)
  await expect(page).toHaveURL(/\/admin\/login/)
  await expect(page.url()).toContain('callbackUrl')
})

test('未登录访问 /admin/videos 重定向到登录页', async ({ context, page }) => {
  await setCookies(context, {})
  await page.goto(`${BASE_URL}/admin/videos`)
  await expect(page).toHaveURL(/\/admin\/login/)
})

// ── role=user 访问 /admin ─────────────────────────────────────────

test('role=user 访问 /admin 重定向到 403 页面', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'user' })
  await page.goto(`${BASE_URL}/admin`)
  await expect(page).toHaveURL(/\/admin\/403/)
  await expect(page.locator('[data-testid="admin-403-page"]')).toBeVisible()
})

test('role=user 访问 /admin/videos 重定向到 403 页面', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'user' })
  await page.goto(`${BASE_URL}/admin/videos`)
  await expect(page).toHaveURL(/\/admin\/403/)
})

// ── role=moderator 访问 /admin ────────────────────────────────────

test('role=moderator 访问 /admin/videos 可正常进入', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })
  await page.goto(`${BASE_URL}/admin/videos`)
  // 不被重定向到 403 或 login
  await expect(page).not.toHaveURL(/\/admin\/403/)
  await expect(page).not.toHaveURL(/\/admin\/login/)
})

test('role=moderator 访问 /admin/users 重定向到 403', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })
  await page.goto(`${BASE_URL}/admin/users`)
  await expect(page).toHaveURL(/\/admin\/403/)
})

test('role=moderator 访问 /admin/crawler 重定向到 403', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })
  await page.goto(`${BASE_URL}/admin/crawler`)
  await expect(page).toHaveURL(/\/admin\/403/)
})

test('role=moderator 访问 /admin/analytics 重定向到 403', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })
  await page.goto(`${BASE_URL}/admin/analytics`)
  await expect(page).toHaveURL(/\/admin\/403/)
})

// ── role=admin 访问 /admin ────────────────────────────────────────

test('role=admin 访问 /admin/videos 可正常进入', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })
  await page.goto(`${BASE_URL}/admin/videos`)
  await expect(page).not.toHaveURL(/\/admin\/403/)
  await expect(page).not.toHaveURL(/\/admin\/login/)
})

test('role=admin 访问 /admin/users 可正常进入', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })
  await page.goto(`${BASE_URL}/admin/users`)
  await expect(page).not.toHaveURL(/\/admin\/403/)
  await expect(page).not.toHaveURL(/\/admin\/login/)
})

test('role=admin 访问 /admin/analytics 可正常进入', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })
  await page.goto(`${BASE_URL}/admin/analytics`)
  await expect(page).not.toHaveURL(/\/admin\/403/)
  await expect(page).not.toHaveURL(/\/admin\/login/)
})

// ── 侧边栏菜单按角色渲染 ──────────────────────────────────────────

test('moderator 侧边栏不显示系统管理区', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })
  // 访问某个内容管理页（需要 admin 布局渲染）
  await page.goto(`${BASE_URL}/admin/videos`)
  await expect(page).not.toHaveURL(/\/admin\/403/)
  // 系统管理菜单不可见
  const sidebar = page.locator('[data-testid="admin-sidebar"]')
  await expect(sidebar).toBeVisible()
  await expect(sidebar.getByText('用户管理')).not.toBeVisible()
  await expect(sidebar.getByText('采集控制台')).not.toBeVisible()
  await expect(sidebar.getByText('数据看板')).not.toBeVisible()
})

test('admin 侧边栏显示系统管理区', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })
  await page.goto(`${BASE_URL}/admin/videos`)
  await expect(page).not.toHaveURL(/\/admin\/403/)
  const sidebar = page.locator('[data-testid="admin-sidebar"]')
  await expect(sidebar).toBeVisible()
  await expect(sidebar.getByText('用户管理')).toBeVisible()
  await expect(sidebar.getByText('采集控制台')).toBeVisible()
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

  await page.goto(`${BASE_URL}/admin/videos`)
  const patchReq = page.waitForRequest(`${API_BASE}/admin/videos/vid-uuid-1/publish`)
  await page.locator('[data-testid="video-publish-toggle-vid-uuid-1"]').click()
  await patchReq
  expect(patchCalled).toBe(true)
})

test('手动添加视频页面渲染表单', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'admin' })
  await page.goto(`${BASE_URL}/admin/videos/new`)
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

  await page.goto(`${BASE_URL}/admin/videos/new`)
  await page.locator('[data-testid="admin-video-form"] input[name="title"]').fill('新测试电影')
  const postReq = page.waitForRequest(`${API_BASE}/admin/videos`)
  await page.locator('[data-testid="admin-video-form-submit"]').click()
  await postReq
  expect(postCalled).toBe(true)
})

// ── ADMIN-03: 投稿审核通过/拒绝流程 ───────────────────────────────

test('点击通过触发 approve 请求', async ({ context, page }) => {
  await setCookies(context, { refreshToken: 'mock-rt', userRole: 'moderator' })

  await page.route(`${API_BASE}/admin/videos/moderation-stats`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ pendingCount: 1, todayReviewedCount: 0, interceptRate: null }),
    })
  })

  await page.route(`${API_BASE}/admin/videos/pending-review*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 'vid-uuid-1',
          shortId: 'aB3kR9x',
          title: '测试电影',
          type: 'movie',
          coverUrl: null,
          year: 2024,
          siteKey: 'site-1',
          siteName: 'Site 1',
          firstSourceUrl: 'http://example.com/video.m3u8',
          createdAt: '2026-03-15T00:00:00Z',
          doubanStatus: 'pending',
          sourceCheckStatus: 'pending',
          metaScore: 0,
          activeSourceCount: 1,
        }],
        total: 1,
      }),
    })
  })

  await page.route(`${API_BASE}/admin/videos/vid-uuid-1`, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'vid-uuid-1',
            title: '测试电影',
            type: 'movie',
            year: 2024,
            description: '',
            cover_url: null,
            review_status: 'pending_review',
            visibility_status: 'internal',
            created_at: '2026-03-15T00:00:00Z',
            genres: [],
            director: [],
            cast: [],
            douban_status: 'pending',
            source_check_status: 'pending',
            meta_score: 0,
            douban_id: null,
            rating: null,
          },
        }),
      })
    }
  })

  await page.route(`${API_BASE}/admin/sources*`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [], total: 0 }),
    })
  })

  let approveCalled = false
  await page.route(`${API_BASE}/admin/videos/vid-uuid-1/review`, (route) => {
    approveCalled = true
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'vid-uuid-1', review_status: 'approved' } }),
    })
  })

  await page.goto(`${BASE_URL}/admin/moderation`)
  await expect(page.locator('[data-testid="admin-moderation-page"]')).toBeVisible()
  await page.locator('[data-testid="moderation-list-item-vid-uuid-1"]').click()
  await expect(page.locator('[data-testid="moderation-detail"]')).toBeVisible()
  const approveReq = page.waitForRequest(`${API_BASE}/admin/videos/vid-uuid-1/review`)
  await page.locator('[data-testid="moderation-approve-btn"]').click()
  await approveReq
  expect(approveCalled).toBe(true)
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

  await page.goto(`${BASE_URL}/admin/users`)
  const banReq = page.waitForRequest(`${API_BASE}/admin/users/user-uuid-1/ban`)
  await page.locator('[data-testid="user-actions-user-uuid-1"]').click()
  await page.getByRole('menuitem', { name: '封号' }).click()
  await page.locator('[data-testid="confirm-dialog-confirm"]').click()
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
      body: JSON.stringify({ data: { globalEnabled: false, scheduleType: 'daily', dailyTimes: ['03:00'], defaultMode: 'incremental', onlyEnabledSites: true, conflictPolicy: 'skip_running', perSiteOverrides: {} } }),
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

  await page.goto(`${BASE_URL}/admin/crawler`)
  await page.locator('[data-testid="admin-crawler-tab-tasks"]').click()
  await expect(page.locator('[data-testid="admin-crawler-page"]')).toBeVisible()
  await expect(page.locator('[data-testid="admin-crawler-trigger-full"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="admin-crawler-trigger-incremental"]')).toHaveCount(0)
})

