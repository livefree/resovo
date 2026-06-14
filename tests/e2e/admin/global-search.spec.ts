/**
 * tests/e2e/admin/global-search.spec.ts
 *
 * SEARCH-02-C：顶栏全局搜索浏览器级验收（ADR-200 Phase 1 MVP）
 *
 * 守护端到端链路（单测/集成无法覆盖的真实接线）：
 *   - ⌘K 触发器 → CommandPalette 打开 → 输入 → debounce 调 /admin/search（mock）→ prefilteredGroups 注入
 *   - **跳过本地过滤**：query 与本地 nav label 不含子串（拼音 query），结果仍展示（§4.1.6 AMENDMENT 核心价值）
 *   - 点击结果 → router.push 跳转目标 href
 *
 * 认证：context.addCookies refresh_token + user_role=admin（同 notifications-shell.spec 范式）
 * mock：installAdminShellMocks 基座 + GET /admin/search 覆盖（route.fallback 下沉基座）
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { installAdminShellMocks, API_BASE } from './_shared/shell-mocks'

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

async function setAdminCookies(context: BrowserContext) {
  await context.addCookies([
    { name: 'refresh_token', value: 'mock-admin-rt', domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Strict' },
    { name: 'user_role', value: 'admin', domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Strict' },
  ])
}

/** 基座 + /admin/search 覆盖：返回一条 video + 一条 user 结果（固定，不依赖 q） */
async function installSearchMocks(page: Page) {
  await installAdminShellMocks(page)
  await page.route(`${API_BASE}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/v1/admin/search' && route.request().method() === 'GET') {
      await route.fulfill(json({
        data: {
          query: 'gangtie',
          groups: [
            {
              kind: 'video',
              items: [{
                kind: 'video', id: 'v1', title: '钢铁侠 2008', href: '/admin/videos?v.f.q=%E9%92%A2%E9%93%81%E4%BE%A0',
                score: 2, reason: 'title-match',
                payload: { shortId: 'aB3kR9x1', type: 'movie', year: 2008, status: 'completed', reviewStatus: 'approved', visibilityStatus: 'public' },
              }],
            },
          ],
        },
      }))
      return
    }
    await route.fallback()
  })
}

const SEARCH_TRIGGER = '[data-topbar-search]'
const PALETTE_INPUT = '[data-command-palette-input]'
const VIDEO_GROUP = '[data-command-palette-group="search:video"]'
const VIDEO_ITEM = '[data-command-palette-item="search:video:v1"]'

test.describe('admin 顶栏全局搜索（SEARCH-02-C 验收）', () => {
  test('⌘K 触发器 → 输入 → 出 prefiltered 结果组（跳过本地过滤）', async ({ context, page }) => {
    await setAdminCookies(context)
    await installSearchMocks(page)
    await page.goto('/admin')

    await page.locator(SEARCH_TRIGGER).click()
    await expect(page.locator(PALETTE_INPUT)).toBeVisible({ timeout: 10000 })

    // 拼音 query：本地 nav label 不含 → 仅 prefiltered 命中（§4.1.6 AMENDMENT 不被误杀）
    await page.locator(PALETTE_INPUT).fill('gangtie')

    await expect(page.locator(VIDEO_GROUP)).toBeVisible({ timeout: 10000 })
    await expect(page.locator(VIDEO_ITEM)).toContainText('钢铁侠 2008')
    // 本地 nav 组被 query 过滤掉（label 不含 gangtie）
    await expect(page.locator('[data-command-palette-group="nav"]')).toHaveCount(0)
  })

  test('点击结果 → 跳转目标 href', async ({ context, page }) => {
    await setAdminCookies(context)
    await installSearchMocks(page)
    await page.goto('/admin')

    await page.locator(SEARCH_TRIGGER).click()
    await page.locator(PALETTE_INPUT).fill('gangtie')
    await expect(page.locator(VIDEO_ITEM)).toBeVisible({ timeout: 10000 })

    await page.locator(VIDEO_ITEM).click()
    await page.waitForURL(/\/admin\/videos/, { timeout: 10000 })
  })
})
