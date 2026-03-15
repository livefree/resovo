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
