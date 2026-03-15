/**
 * tests/e2e/auth.spec.ts
 * AUTH-03: 登录/注册完整流程 E2E 测试
 * 使用 page.route() 拦截 API 请求，不依赖真实后端服务
 */

import { test, expect } from '@playwright/test'

// ── Mock 数据 ───────────────────────────────────────────────────────

const API_BASE = 'http://localhost:4000/v1'

const MOCK_USER = {
  id: 'uuid-test-1',
  username: 'testuser',
  email: 'test@example.com',
  avatarUrl: null,
  role: 'user',
  locale: 'en',
  createdAt: '2024-01-01T00:00:00Z',
  bannedAt: null,
}

const MOCK_ACCESS_TOKEN = 'mock.access.token.abc123'

// ── 辅助：注册 mock API 路由 ─────────────────────────────────────

async function mockAuthRoutes(page: Parameters<typeof test>[1] extends { page: infer P } ? P : never) {
  // POST /auth/login → 成功
  await page.route(`${API_BASE}/auth/login`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Set-Cookie': 'refresh_token=mock.refresh.token; HttpOnly; Path=/' },
      body: JSON.stringify({ data: { user: MOCK_USER, accessToken: MOCK_ACCESS_TOKEN } }),
    })
  })

  // POST /auth/register → 成功
  await page.route(`${API_BASE}/auth/register`, (route) => {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      headers: { 'Set-Cookie': 'refresh_token=mock.refresh.token; HttpOnly; Path=/' },
      body: JSON.stringify({ data: { user: MOCK_USER, accessToken: MOCK_ACCESS_TOKEN } }),
    })
  })

  // POST /auth/logout → 204
  await page.route(`${API_BASE}/auth/logout`, (route) => {
    route.fulfill({
      status: 204,
      headers: { 'Set-Cookie': 'refresh_token=; HttpOnly; Path=/; Max-Age=0' },
      body: '',
    })
  })

  // POST /auth/refresh → 返回新 token
  await page.route(`${API_BASE}/auth/refresh`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { accessToken: MOCK_ACCESS_TOKEN } }),
    })
  })
}

// ═══════════════════════════════════════════════════════════════════
// 测试套件
// ═══════════════════════════════════════════════════════════════════

test.describe('登录页', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthRoutes(page)
    await page.goto('/en/auth/login')
  })

  test('登录页正常加载，显示邮箱和密码输入框', async ({ page }) => {
    await expect(page.locator('#login-email')).toBeVisible()
    await expect(page.locator('#login-password')).toBeVisible()
    await expect(page.getByTestId('login-submit')).toBeVisible()
  })

  test('空表单提交：显示必填验证错误', async ({ page }) => {
    await page.getByTestId('login-submit').click()
    await expect(page.locator('#login-email-error')).toBeVisible()
  })

  test('无效邮箱格式：显示邮箱格式错误', async ({ page }) => {
    await page.locator('#login-email').fill('not-an-email')
    await page.locator('#login-password').fill('somepassword')
    await page.getByTestId('login-submit').click()
    await expect(page.locator('#login-email-error')).toBeVisible()
  })

  test('用户完成登录后跳转到首页', async ({ page }) => {
    await page.locator('#login-email').fill('test@example.com')
    await page.locator('#login-password').fill('password123')
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL('/en')
  })

  test('登录后导航栏显示用户名', async ({ page }) => {
    await page.locator('#login-email').fill('test@example.com')
    await page.locator('#login-password').fill('password123')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('nav-username')).toHaveText(MOCK_USER.username)
  })

  test('登录失败（401）：显示错误提示', async ({ page }) => {
    // 覆盖 login mock，返回 401
    await page.route(`${API_BASE}/auth/login`, (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'UNAUTHORIZED', message: '邮箱或密码错误', status: 401 },
        }),
      })
    })

    await page.locator('#login-email').fill('test@example.com')
    await page.locator('#login-password').fill('wrongpassword')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('login-error')).toBeVisible()
  })

  test('点击"注册"链接跳转到注册页', async ({ page }) => {
    await page.getByRole('link', { name: /create one|立即注册/i }).click()
    await expect(page).toHaveURL('/en/auth/register')
  })
})

test.describe('注册页', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthRoutes(page)
    await page.goto('/en/auth/register')
  })

  test('注册页正常加载，显示三个输入框', async ({ page }) => {
    await expect(page.locator('#register-username')).toBeVisible()
    await expect(page.locator('#register-email')).toBeVisible()
    await expect(page.locator('#register-password')).toBeVisible()
  })

  test('空表单提交：显示用户名必填错误', async ({ page }) => {
    await page.getByTestId('register-submit').click()
    await expect(page.locator('#register-username-error')).toBeVisible()
  })

  test('密码少于 8 位：显示密码长度错误', async ({ page }) => {
    await page.locator('#register-username').fill('newuser')
    await page.locator('#register-email').fill('new@example.com')
    await page.locator('#register-password').fill('short')
    await page.getByTestId('register-submit').click()
    await expect(page.locator('#register-password-error')).toBeVisible()
  })

  test('用户完成注册后跳转到首页', async ({ page }) => {
    await page.locator('#register-username').fill('newuser')
    await page.locator('#register-email').fill('new@example.com')
    await page.locator('#register-password').fill('password123')
    await page.getByTestId('register-submit').click()
    await expect(page).toHaveURL('/en')
  })

  test('注册后导航栏显示用户名', async ({ page }) => {
    await page.locator('#register-username').fill('newuser')
    await page.locator('#register-email').fill('new@example.com')
    await page.locator('#register-password').fill('password123')
    await page.getByTestId('register-submit').click()
    await expect(page.getByTestId('nav-username')).toHaveText(MOCK_USER.username)
  })

  test('重复邮箱（422 CONFLICT）：显示冲突错误', async ({ page }) => {
    await page.route(`${API_BASE}/auth/register`, (route) => {
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'CONFLICT', message: '该邮箱已被注册', status: 422 },
        }),
      })
    })

    await page.locator('#register-username').fill('newuser')
    await page.locator('#register-email').fill('existing@example.com')
    await page.locator('#register-password').fill('password123')
    await page.getByTestId('register-submit').click()
    await expect(page.getByTestId('register-error')).toBeVisible()
  })

  test('点击"登录"链接跳转到登录页', async ({ page }) => {
    await page.getByRole('link', { name: /sign in|立即登录/i }).click()
    await expect(page).toHaveURL('/en/auth/login')
  })
})

test.describe('登出流程', () => {
  test('登出后导航栏不显示用户名', async ({ page }) => {
    await mockAuthRoutes(page)

    // 先登录
    await page.goto('/en/auth/login')
    await page.locator('#login-email').fill('test@example.com')
    await page.locator('#login-password').fill('password123')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('nav-username')).toBeVisible()

    // 登出
    await page.getByTestId('nav-logout').click()
    await expect(page.getByTestId('nav-username')).not.toBeVisible()
  })
})
