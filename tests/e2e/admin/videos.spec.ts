/**
 * tests/e2e/admin/videos.spec.ts
 * CHG-SN-3-10: 视频库 E2E 黄金路径验证
 *
 * 前提：apps/server-next 运行于 localhost:3003（baseURL 由 admin-next-chromium project 注入）
 * API：全部由 page.route() 拦截 localhost:4000/v1，不依赖真实后端
 * 认证：context.addCookies() 注入 refresh_token + user_role=moderator
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'

const API_BASE = 'http://localhost:4000/v1'

// ── Mock 数据 ──────────────────────────────────────────────────────

const VIDEO_ID = 'vid-e2e-01'
const VIDEO_SHORT_ID = 'e2E01234'
const VIDEO_TITLE = 'E2E 黄金路径测试片'

interface VideoRow {
  id: string
  short_id: string
  title: string
  title_en: string | null
  cover_url: string | null
  type: string
  year: number
  is_published: boolean
  source_count: string
  active_source_count: string
  total_source_count: string
  visibility_status: string
  review_status: string
  created_at: string
}

function makeVideoRow(overrides: Partial<VideoRow> = {}): VideoRow {
  return {
    id: VIDEO_ID,
    short_id: VIDEO_SHORT_ID,
    title: VIDEO_TITLE,
    title_en: null,
    cover_url: null,
    type: 'movie',
    year: 2025,
    is_published: false,
    source_count: '1',
    active_source_count: '1',
    total_source_count: '1',
    visibility_status: 'internal',
    review_status: 'approved',
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

function makeVideoDetail(row: VideoRow) {
  return {
    ...row,
    description: '黄金路径测试用视频描述',
    genres: [],
    country: 'CN',
    episode_count: 1,
    status: 'completed',
    rating: null,
    director: [],
    cast: [],
    writers: [],
    douban_id: null,
  }
}

// ── 辅助函数 ───────────────────────────────────────────────────────

async function setModeratorCookies(context: BrowserContext) {
  await context.addCookies([
    {
      name: 'refresh_token',
      value: 'mock-mod-rt',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    },
    {
      name: 'user_role',
      value: 'moderator',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Strict',
    },
  ])
}

interface MockState {
  rows: VideoRow[]
}

async function installVideosMocks(page: Page, state: MockState) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    // GET /admin/crawler/sites — sidebar site filter
    if (path === '/v1/admin/crawler/sites' && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0 }),
      })
      return
    }

    // GET /admin/videos/moderation-stats — dashboard（may load）
    // CHG-DESIGN-07 7C 步骤 1：契约对齐到后端真实字段
    // { pendingCount, todayReviewedCount, interceptRate }
    if (path === '/v1/admin/videos/moderation-stats' && method === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { pendingCount: 0, todayReviewedCount: 0, interceptRate: null } }),
      })
      return
    }

    // GET /admin/videos — list (supports q filter)
    if (path === '/v1/admin/videos' && method === 'GET') {
      const q = url.searchParams.get('q')
      const filtered = q
        ? state.rows.filter((r) => r.title.includes(q) || r.short_id.includes(q))
        : state.rows
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: filtered, total: filtered.length, page: 1, limit: 20 }),
      })
      return
    }

    // GET /admin/videos/:id — detail for edit drawer
    if (path.startsWith('/v1/admin/videos/') && method === 'GET' && !path.includes('/state-transition') && !path.includes('/visibility')) {
      const id = path.split('/').pop()
      const row = state.rows.find((r) => r.id === id)
      if (row) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ data: makeVideoDetail(row) }),
        })
      } else {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) })
      }
      return
    }

    // PATCH /admin/videos/:id — metadata patch
    if (path.startsWith('/v1/admin/videos/') && method === 'PATCH' && !path.includes('/visibility')) {
      const id = path.split('/').pop()
      const body = request.postDataJSON() as Record<string, unknown>
      state.rows = state.rows.map((r) =>
        r.id === id ? { ...r, ...(body.title ? { title: body.title as string } : {}) } : r,
      )
      const updated = state.rows.find((r) => r.id === id)!
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: updated, skippedFields: [] }),
      })
      return
    }

    // PATCH /admin/videos/:id/visibility
    if (path.includes('/visibility') && method === 'PATCH') {
      const id = path.split('/')[4]
      const body = request.postDataJSON() as { visibility: string }
      state.rows = state.rows.map((r) =>
        r.id === id ? { ...r, visibility_status: body.visibility } : r,
      )
      const updated = state.rows.find((r) => r.id === id)!
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { visibility_status: updated.visibility_status, is_published: updated.is_published } }),
      })
      return
    }

    // POST /admin/videos/:id/state-transition
    if (path.includes('/state-transition') && method === 'POST') {
      const id = path.split('/')[4]
      const body = request.postDataJSON() as { action: string }
      const patch: Partial<VideoRow> =
        body.action === 'publish' ? { is_published: true }
        : body.action === 'unpublish' ? { is_published: false }
        : {}
      state.rows = state.rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: state.rows.find((r) => r.id === id) }),
      })
      return
    }

    // POST /admin/videos/batch-unpublish
    if (path === '/v1/admin/videos/batch-unpublish' && method === 'POST') {
      const body = request.postDataJSON() as { ids: string[] }
      state.rows = state.rows.map((r) => (body.ids.includes(r.id) ? { ...r, is_published: false } : r))
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { updated: body.ids.length } }),
      })
      return
    }

    await route.continue()
  })
}

// ── 测试套件 ──────────────────────────────────────────────────────

test.describe('视频库黄金路径', () => {
  test('列表加载 — 视频行渲染正确', async ({ context, page }) => {
    await setModeratorCookies(context)
    const state: MockState = { rows: [makeVideoRow()] }
    await installVideosMocks(page, state)

    await page.goto('/admin/videos')
    await expect(page.getByTestId('video-list-table')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(VIDEO_TITLE)).toBeVisible()
  })

  test('搜索过滤 — 输入 q 后列表更新，URL 含 q 参数', async ({ context, page }) => {
    await setModeratorCookies(context)
    const extraRow = makeVideoRow({ id: 'vid-e2e-02', short_id: 'e2E02345', title: '另一部电影' })
    const state: MockState = { rows: [makeVideoRow(), extraRow] }
    await installVideosMocks(page, state)

    await page.goto('/admin/videos')
    await expect(page.getByTestId('video-list-table')).toBeVisible({ timeout: 10000 })

    const listReq = page.waitForRequest((req) =>
      req.url().includes('/admin/videos') && req.url().includes('q=E2E'),
    )
    await page.getByTestId('filter-q').fill('E2E')
    await listReq

    // 只剩包含 "E2E" 的行
    await expect(page.getByText(VIDEO_TITLE)).toBeVisible()
    await expect(page.getByText('另一部电影')).not.toBeVisible()

    // URL 含 q 参数（namespace 'v' 下的 f.q 键）
    await expect(page).toHaveURL(/q=E2E/)
  })

  test('编辑 Drawer — 打开、修改标题、保存', async ({ context, page }) => {
    await setModeratorCookies(context)
    const state: MockState = { rows: [makeVideoRow()] }
    await installVideosMocks(page, state)

    await page.goto('/admin/videos')
    await expect(page.getByTestId('video-list-table')).toBeVisible({ timeout: 10000 })

    // 打开操作菜单
    await page.getByTestId('row-actions-trigger').first().click()
    // 点击"编辑基础信息"
    await page.locator('[data-key="edit"]').click()

    // Drawer 出现
    const drawer = page.getByTestId('data-video-edit-drawer')
    await expect(drawer).toBeVisible({ timeout: 5000 })

    // 修改标题
    const titleInput = page.getByTestId('edit-title')
    await titleInput.fill('更新后的标题')

    // 提交
    const patchReq = page.waitForRequest(
      (req) => req.url().includes(`/admin/videos/${VIDEO_ID}`) && req.method() === 'PATCH',
    )
    await page.getByTestId('data-video-edit-submit').click()
    await patchReq

    // Drawer 关闭
    await expect(drawer).not.toBeVisible({ timeout: 5000 })
  })

  test('上架操作 — 乐观更新后行状态改变', async ({ context, page }) => {
    await setModeratorCookies(context)
    const state: MockState = { rows: [makeVideoRow({ is_published: false })] }
    await installVideosMocks(page, state)

    await page.goto('/admin/videos')
    await expect(page.getByTestId('video-list-table')).toBeVisible({ timeout: 10000 })

    // 打开操作菜单
    await page.getByTestId('row-actions-trigger').first().click()

    const transReq = page.waitForRequest(
      (req) => req.url().includes(`/admin/videos/${VIDEO_ID}/state-transition`) && req.method() === 'POST',
    )
    // 点击"上架"
    await page.locator('[data-key="publish"]').click()
    await transReq
    // 触发器按钮恢复可用（pending 消失）
    await expect(page.getByTestId('row-actions-trigger').first()).not.toBeDisabled({ timeout: 5000 })
  })

  test('批量下架 — 全选 → confirm → bulk bar 消失', async ({ context, page }) => {
    await setModeratorCookies(context)
    const state: MockState = { rows: [makeVideoRow({ is_published: true })] }
    await installVideosMocks(page, state)

    await page.goto('/admin/videos')
    await expect(page.getByTestId('video-list-table')).toBeVisible({ timeout: 10000 })

    // 全选当前页
    await page.getByLabel('全选当前页').check()
    // CHG-DESIGN-02 Step 7B：bulk bar 已从外置 SelectionActionBar
    // (`[data-selection-action-bar]`) 迁移到 DataTable 内置 .dt__bulk
    // (`[data-table-bulk]`)；selection 非空时渲染。
    const bulkBar = page.locator('[data-table-bulk]')
    await expect(bulkBar).toBeVisible({ timeout: 3000 })

    // 点击"批量隐藏"
    await page.locator('[data-action-key="batch-unpublish"]').click()

    // confirm prompt 出现
    await expect(page.locator('[data-confirm-prompt="batch-unpublish"]')).toBeVisible()

    const batchReq = page.waitForRequest(
      (req) => req.url().includes('/admin/videos/batch-unpublish') && req.method() === 'POST',
    )
    // 确认
    await page.locator('[data-confirm-prompt="batch-unpublish"]').getByText('确认').click()
    await batchReq

    // bulk bar 消失（selection 已清除，DataTable 自动卸载 .dt__bulk）
    await expect(bulkBar).not.toBeVisible({ timeout: 5000 })
  })
})
